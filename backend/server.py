from fastapi import FastAPI, APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import asyncio
import random
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Helper function to convert MongoDB ObjectId to string
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

# ==================== MODELS ====================

class CharacterNeeds(BaseModel):
    hunger: float = Field(default=100.0, ge=0, le=100)
    energy: float = Field(default=100.0, ge=0, le=100)
    social: float = Field(default=100.0, ge=0, le=100)
    hygiene: float = Field(default=100.0, ge=0, le=100)
    fun: float = Field(default=100.0, ge=0, le=100)
    bladder: float = Field(default=100.0, ge=0, le=100)
    comfort: float = Field(default=100.0, ge=0, le=100)

class CharacterPersonality(BaseModel):
    extroversion: float = Field(default=50.0, ge=0, le=100)  # Social vs Solitary
    creativity: float = Field(default=50.0, ge=0, le=100)     # Artistic vs Practical
    ambition: float = Field(default=50.0, ge=0, le=100)       # Career-driven vs Relaxed
    kindness: float = Field(default=50.0, ge=0, le=100)       # Generous vs Selfish
    humor: float = Field(default=50.0, ge=0, le=100)          # Playful vs Serious

class CharacterSkills(BaseModel):
    cooking: float = Field(default=10.0, ge=0, le=100)
    fitness: float = Field(default=10.0, ge=0, le=100)
    creativity: float = Field(default=10.0, ge=0, le=100)
    charisma: float = Field(default=10.0, ge=0, le=100)
    logic: float = Field(default=10.0, ge=0, le=100)
    handiness: float = Field(default=10.0, ge=0, le=100)

class Relationship(BaseModel):
    character_id: str
    character_name: str
    friendship: float = Field(default=0.0, ge=-100, le=100)
    romance: float = Field(default=0.0, ge=-100, le=100)

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    age: int
    occupation: str
    bio: str
    avatar_emoji: str = "😊"
    location_id: str = "paris_cafe"
    needs: CharacterNeeds = Field(default_factory=CharacterNeeds)
    personality: CharacterPersonality = Field(default_factory=CharacterPersonality)
    skills: CharacterSkills = Field(default_factory=CharacterSkills)
    relationships: List[Relationship] = Field(default_factory=list)
    current_action: str = "Idle"
    action_queue: List[str] = Field(default_factory=list)
    money: float = 1000.0
    mood: str = "Happy"
    thoughts: List[str] = Field(default_factory=list)
    memory: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    type: str  # cafe, apartment, office, park, gym, restaurant, club, etc.
    city: str
    country: str
    emoji: str
    available_actions: List[str] = Field(default_factory=list)
    objects: List[str] = Field(default_factory=list)

class WorldState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    game_time: datetime = Field(default_factory=datetime.utcnow)
    time_speed: float = 1.0  # 1.0 = real time, 60.0 = 1 hour per minute
    is_paused: bool = False
    current_weather: str = "sunny"
    events: List[str] = Field(default_factory=list)

class ActionLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character_id: str
    character_name: str
    action: str
    location: str
    result: str
    thought: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class PlayerCommand(BaseModel):
    character_id: str
    command: str
    priority: bool = False

# ==================== DEFAULT DATA ====================

DEFAULT_LOCATIONS = [
    Location(
        id="paris_cafe", name="Le Petit Parisien", description="A cozy Parisian cafe with vintage decor and the aroma of fresh croissants",
        type="cafe", city="Paris", country="France", emoji="☕",
        available_actions=["drink_coffee", "eat_croissant", "read_newspaper", "chat_with_others", "work_on_laptop", "people_watch"],
        objects=["espresso_machine", "pastry_display", "vintage_chairs", "newspapers", "wifi"]
    ),
    Location(
        id="tokyo_apartment", name="Shibuya Apartment", description="A modern minimalist apartment with a view of the Tokyo skyline",
        type="apartment", city="Tokyo", country="Japan", emoji="🏠",
        available_actions=["sleep", "cook_meal", "watch_tv", "take_shower", "use_toilet", "relax", "clean_house", "exercise"],
        objects=["futon", "kitchen", "smart_tv", "bathroom", "gaming_console", "yoga_mat"]
    ),
    Location(
        id="nyc_office", name="Manhattan Tech Hub", description="A modern open-plan office in a skyscraper with stunning views",
        type="office", city="New York", country="USA", emoji="💼",
        available_actions=["work", "attend_meeting", "coffee_break", "network", "brainstorm", "lunch_with_colleagues"],
        objects=["standing_desks", "meeting_rooms", "coffee_machine", "whiteboards", "ergonomic_chairs"]
    ),
    Location(
        id="london_park", name="Hyde Park", description="A beautiful green oasis in the heart of London",
        type="park", city="London", country="UK", emoji="🌳",
        available_actions=["jog", "walk", "have_picnic", "feed_ducks", "read_book", "meet_friends", "yoga", "meditate"],
        objects=["benches", "lake", "pathways", "flower_gardens", "ice_cream_cart"]
    ),
    Location(
        id="barcelona_gym", name="FitLife Barcelona", description="A state-of-the-art fitness center near the beach",
        type="gym", city="Barcelona", country="Spain", emoji="💪",
        available_actions=["lift_weights", "cardio", "swim", "yoga_class", "sauna", "personal_training"],
        objects=["weights", "treadmills", "pool", "yoga_studio", "locker_rooms", "juice_bar"]
    ),
    Location(
        id="rome_restaurant", name="Trattoria Da Nonna", description="An authentic Italian family restaurant in Trastevere",
        type="restaurant", city="Rome", country="Italy", emoji="🍝",
        available_actions=["eat_dinner", "drink_wine", "romantic_date", "family_gathering", "celebrate"],
        objects=["tables", "wine_cellar", "wood_oven", "outdoor_terrace"]
    ),
    Location(
        id="berlin_club", name="Berghain Underground", description="A legendary techno club in a converted power plant",
        type="club", city="Berlin", country="Germany", emoji="🎵",
        available_actions=["dance", "drink", "meet_people", "enjoy_music", "vip_lounge"],
        objects=["dance_floor", "bars", "dj_booth", "dark_rooms", "terrace"]
    ),
    Location(
        id="sydney_beach", name="Bondi Beach", description="The iconic Australian beach with golden sand and perfect waves",
        type="beach", city="Sydney", country="Australia", emoji="🏖️",
        available_actions=["swim", "surf", "sunbathe", "beach_volleyball", "build_sandcastle", "ocean_watch"],
        objects=["beach_umbrellas", "surf_boards", "lifeguard_tower", "beach_cafe"]
    )
]

DEFAULT_CHARACTERS = [
    Character(
        id="char_1", name="Sophie Laurent", age=28, occupation="Fashion Designer",
        bio="A creative soul from Paris who dreams of launching her own fashion line. She loves art, coffee, and meaningful conversations.",
        avatar_emoji="👩‍🎨", location_id="paris_cafe",
        personality=CharacterPersonality(extroversion=75, creativity=90, ambition=80, kindness=70, humor=60),
        skills=CharacterSkills(cooking=40, fitness=30, creativity=85, charisma=70, logic=45, handiness=25)
    ),
    Character(
        id="char_2", name="Kenji Tanaka", age=32, occupation="Software Engineer",
        bio="A tech genius from Tokyo who balances his coding passion with traditional martial arts. Quietly brilliant with a dry wit.",
        avatar_emoji="👨‍💻", location_id="tokyo_apartment",
        personality=CharacterPersonality(extroversion=35, creativity=65, ambition=85, kindness=60, humor=40),
        skills=CharacterSkills(cooking=60, fitness=70, creativity=55, charisma=40, logic=95, handiness=75)
    ),
    Character(
        id="char_3", name="Marcus Johnson", age=35, occupation="Marketing Director",
        bio="A charismatic New Yorker with big dreams and an even bigger heart. He's the life of every party but values deep friendships.",
        avatar_emoji="👨‍💼", location_id="nyc_office",
        personality=CharacterPersonality(extroversion=90, creativity=55, ambition=95, kindness=75, humor=85),
        skills=CharacterSkills(cooking=25, fitness=55, creativity=50, charisma=90, logic=70, handiness=30)
    )
]

# ==================== AI DECISION ENGINE ====================

async def get_ai_decision(character: Character, location: Location, other_characters: List[Character]) -> dict:
    """Use AI to decide what the character should do next"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"sim_{character.id}_{datetime.utcnow().timestamp()}",
            system_message="""You are the brain of an autonomous AI character in a life simulation game. 
You must decide the next action for this character based on their personality, needs, current location, and situation.
You should make realistic, human-like decisions that reflect the character's personality.
Always respond in valid JSON format with these fields:
- action: string (the action to take from available actions)
- thought: string (what the character is thinking, 1-2 sentences, emotional and personal)
- mood: string (current emotional state: Happy, Sad, Excited, Tired, Anxious, Content, Romantic, Focused, Social, Bored)
- need_changes: object with needs to change (e.g., {"energy": -5, "social": 10})
- should_move: boolean (should the character go somewhere else?)
- target_location: string (if should_move is true, which location_id to go to)
"""
        ).with_model("openai", "gpt-4o")

        # Build context about the character
        needs_status = []
        if character.needs.hunger < 30:
            needs_status.append("VERY HUNGRY")
        elif character.needs.hunger < 50:
            needs_status.append("hungry")
        if character.needs.energy < 30:
            needs_status.append("EXHAUSTED")
        elif character.needs.energy < 50:
            needs_status.append("tired")
        if character.needs.social < 30:
            needs_status.append("LONELY")
        elif character.needs.social < 50:
            needs_status.append("craving social interaction")
        if character.needs.hygiene < 30:
            needs_status.append("NEEDS SHOWER URGENTLY")
        elif character.needs.hygiene < 50:
            needs_status.append("feeling unclean")
        if character.needs.fun < 30:
            needs_status.append("EXTREMELY BORED")
        elif character.needs.fun < 50:
            needs_status.append("needs entertainment")
        if character.needs.bladder < 30:
            needs_status.append("DESPERATELY NEEDS BATHROOM")
        elif character.needs.bladder < 50:
            needs_status.append("needs to use bathroom soon")

        others_present = [c.name for c in other_characters if c.location_id == character.location_id and c.id != character.id]

        prompt = f"""CHARACTER: {character.name}, {character.age}yo {character.occupation}
PERSONALITY: Extroversion {character.personality.extroversion}%, Creativity {character.personality.creativity}%, Ambition {character.personality.ambition}%, Kindness {character.personality.kindness}%, Humor {character.personality.humor}%
BIO: {character.bio}

CURRENT LOCATION: {location.name} ({location.city}, {location.country}) - {location.description}
AVAILABLE ACTIONS: {', '.join(location.available_actions)}

NEEDS STATUS:
- Hunger: {character.needs.hunger}/100 {'⚠️' if character.needs.hunger < 40 else ''}
- Energy: {character.needs.energy}/100 {'⚠️' if character.needs.energy < 40 else ''}
- Social: {character.needs.social}/100 {'⚠️' if character.needs.social < 40 else ''}
- Hygiene: {character.needs.hygiene}/100 {'⚠️' if character.needs.hygiene < 40 else ''}
- Fun: {character.needs.fun}/100 {'⚠️' if character.needs.fun < 40 else ''}
- Bladder: {character.needs.bladder}/100 {'⚠️' if character.needs.bladder < 40 else ''}
- Comfort: {character.needs.comfort}/100

URGENT NEEDS: {', '.join(needs_status) if needs_status else 'None - all needs are satisfied'}

OTHER CHARACTERS PRESENT: {', '.join(others_present) if others_present else 'No one else here'}
CURRENT MOOD: {character.mood}
MONEY: ${character.money}
CURRENT ACTION: {character.current_action}

RECENT THOUGHTS: {character.thoughts[-3:] if character.thoughts else 'None'}

What should {character.name} do next? Consider their personality, urgent needs, and the situation. Be creative and realistic!
Respond with JSON only."""

        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse JSON response - send_message returns string directly
        response_text = response.strip() if isinstance(response, str) else response.text.strip()
        # Clean up markdown if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        decision = json.loads(response_text.strip())
        return decision
    except Exception as e:
        logger.error(f"AI decision error for {character.name}: {e}")
        # Fallback to random action
        return {
            "action": random.choice(location.available_actions),
            "thought": "I should do something...",
            "mood": character.mood,
            "need_changes": {},
            "should_move": False,
            "target_location": None
        }

# ==================== GAME LOGIC ====================

async def apply_time_decay(character: Character) -> Character:
    """Apply natural decay to character needs over time"""
    decay_rates = {
        "hunger": -2.0,
        "energy": -1.5,
        "social": -1.0,
        "hygiene": -0.5,
        "fun": -1.5,
        "bladder": -3.0,
        "comfort": -0.5
    }
    
    character.needs.hunger = max(0, min(100, character.needs.hunger + decay_rates["hunger"]))
    character.needs.energy = max(0, min(100, character.needs.energy + decay_rates["energy"]))
    character.needs.social = max(0, min(100, character.needs.social + decay_rates["social"]))
    character.needs.hygiene = max(0, min(100, character.needs.hygiene + decay_rates["hygiene"]))
    character.needs.fun = max(0, min(100, character.needs.fun + decay_rates["fun"]))
    character.needs.bladder = max(0, min(100, character.needs.bladder + decay_rates["bladder"]))
    character.needs.comfort = max(0, min(100, character.needs.comfort + decay_rates["comfort"]))
    
    return character

def apply_action_effects(character: Character, action: str, need_changes: dict) -> Character:
    """Apply the effects of an action on character needs"""
    # Default action effects
    action_effects = {
        "sleep": {"energy": 40, "comfort": 20},
        "eat_croissant": {"hunger": 25, "fun": 10},
        "eat_dinner": {"hunger": 40, "social": 10, "fun": 15},
        "cook_meal": {"hunger": 35, "fun": 10},
        "drink_coffee": {"energy": 15, "bladder": -10},
        "drink_wine": {"fun": 20, "social": 15, "bladder": -15},
        "drink": {"fun": 15, "social": 10, "bladder": -10},
        "work": {"energy": -15, "hunger": -10, "fun": -10},
        "work_on_laptop": {"energy": -10, "fun": -5},
        "chat_with_others": {"social": 25, "fun": 10},
        "meet_people": {"social": 30, "fun": 15},
        "meet_friends": {"social": 35, "fun": 20},
        "take_shower": {"hygiene": 50, "comfort": 20},
        "use_toilet": {"bladder": 60, "comfort": 10},
        "exercise": {"energy": -20, "fitness": 5, "fun": 10, "hygiene": -15},
        "jog": {"energy": -25, "fun": 15, "hygiene": -20},
        "swim": {"energy": -15, "fun": 25, "hygiene": 10},
        "yoga": {"energy": 10, "comfort": 20, "fun": 15},
        "yoga_class": {"energy": 10, "comfort": 25, "fun": 15, "social": 10},
        "meditate": {"energy": 15, "comfort": 30, "fun": 5},
        "dance": {"fun": 35, "social": 20, "energy": -20},
        "enjoy_music": {"fun": 25, "comfort": 15},
        "watch_tv": {"fun": 20, "energy": 5, "comfort": 10},
        "relax": {"energy": 15, "comfort": 25, "fun": 10},
        "read_book": {"fun": 15, "energy": 5, "comfort": 10},
        "read_newspaper": {"fun": 10, "comfort": 5},
        "romantic_date": {"social": 40, "fun": 35, "comfort": 20},
        "sunbathe": {"fun": 20, "comfort": 15, "energy": 10},
        "surf": {"fun": 30, "energy": -25, "hygiene": -10},
    }
    
    # Apply default effects if action is known
    if action in action_effects:
        for need, change in action_effects[action].items():
            if hasattr(character.needs, need):
                current = getattr(character.needs, need)
                setattr(character.needs, need, max(0, min(100, current + change)))
    
    # Apply AI-specified changes
    for need, change in need_changes.items():
        if hasattr(character.needs, need):
            current = getattr(character.needs, need)
            setattr(character.needs, need, max(0, min(100, current + change)))
    
    return character

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "SimAI - Life Simulator API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# World State
@api_router.get("/world")
async def get_world_state():
    world = await db.world_state.find_one()
    if not world:
        world = WorldState().model_dump()
        await db.world_state.insert_one(world)
        world = await db.world_state.find_one()
    return serialize_doc(world)

@api_router.post("/world/pause")
async def toggle_pause():
    world = await db.world_state.find_one()
    if world:
        new_paused = not world.get("is_paused", False)
        await db.world_state.update_one({}, {"$set": {"is_paused": new_paused}})
        return {"is_paused": new_paused}
    return {"is_paused": False}

@api_router.post("/world/speed")
async def set_speed(speed: float):
    await db.world_state.update_one({}, {"$set": {"time_speed": speed}})
    return {"time_speed": speed}

# Locations
@api_router.get("/locations")
async def get_locations():
    locations = await db.locations.find().to_list(100)
    if not locations:
        # Initialize default locations
        for loc in DEFAULT_LOCATIONS:
            await db.locations.insert_one(loc.model_dump())
        locations = [loc.model_dump() for loc in DEFAULT_LOCATIONS]
    return serialize_doc(locations)

@api_router.get("/locations/{location_id}")
async def get_location(location_id: str):
    location = await db.locations.find_one({"id": location_id})
    if not location:
        return {"error": "Location not found"}
    return serialize_doc(location)

# Characters
@api_router.get("/characters")
async def get_characters():
    characters = await db.characters.find().to_list(100)
    if not characters:
        # Initialize default characters with relationships
        for char in DEFAULT_CHARACTERS:
            char.relationships = [
                Relationship(
                    character_id=other.id,
                    character_name=other.name,
                    friendship=random.randint(10, 40),
                    romance=0
                )
                for other in DEFAULT_CHARACTERS if other.id != char.id
            ]
            await db.characters.insert_one(char.model_dump())
        characters = [char.model_dump() for char in DEFAULT_CHARACTERS]
    return serialize_doc(characters)

@api_router.get("/characters/{character_id}")
async def get_character(character_id: str):
    character = await db.characters.find_one({"id": character_id})
    if not character:
        return {"error": "Character not found"}
    return serialize_doc(character)

# Action Logs
@api_router.get("/logs")
async def get_action_logs(limit: int = 50):
    logs = await db.action_logs.find().sort("timestamp", -1).limit(limit).to_list(limit)
    return serialize_doc(logs)

@api_router.get("/logs/{character_id}")
async def get_character_logs(character_id: str, limit: int = 20):
    logs = await db.action_logs.find({"character_id": character_id}).sort("timestamp", -1).limit(limit).to_list(limit)
    return serialize_doc(logs)

# Game Simulation Tick
@api_router.post("/simulate")
async def simulate_tick():
    """Run one simulation tick for all characters"""
    world = await db.world_state.find_one()
    if world and world.get("is_paused", False):
        return {"status": "paused", "message": "Simulation is paused"}
    
    characters = await db.characters.find().to_list(100)
    locations = await db.locations.find().to_list(100)
    location_map = {loc["id"]: loc for loc in locations}
    
    results = []
    
    for char_data in characters:
        character = Character(**char_data)
        location = location_map.get(character.location_id)
        
        if not location:
            continue
        
        location_obj = Location(**location)
        other_chars = [Character(**c) for c in characters if c["id"] != character.id]
        
        # Apply time decay
        character = await apply_time_decay(character)
        
        # Get AI decision
        decision = await get_ai_decision(character, location_obj, other_chars)
        
        # Apply action effects
        character = apply_action_effects(character, decision.get("action", ""), decision.get("need_changes", {}))
        
        # Update character state
        character.current_action = decision.get("action", "Idle")
        character.mood = decision.get("mood", character.mood)
        
        thought = decision.get("thought", "")
        if thought:
            character.thoughts = (character.thoughts + [thought])[-10:]  # Keep last 10 thoughts
        
        # Handle location change
        if decision.get("should_move") and decision.get("target_location"):
            target_loc = decision.get("target_location")
            if target_loc in location_map:
                character.location_id = target_loc
                character.current_action = f"Traveling to {location_map[target_loc]['name']}"
        
        # Save character state
        await db.characters.update_one(
            {"id": character.id},
            {"$set": character.model_dump()}
        )
        
        # Log the action
        log = ActionLog(
            character_id=character.id,
            character_name=character.name,
            action=character.current_action,
            location=location_obj.name,
            result="success",
            thought=thought
        )
        await db.action_logs.insert_one(log.model_dump())
        
        results.append({
            "character_id": character.id,
            "name": character.name,
            "action": character.current_action,
            "thought": thought,
            "mood": character.mood,
            "location": character.location_id
        })
    
    return {"status": "success", "results": results}

# Player Commands
@api_router.post("/command")
async def send_command(command: PlayerCommand):
    """Send a command to a character from the player"""
    character = await db.characters.find_one({"id": command.character_id})
    if not character:
        return {"error": "Character not found"}
    
    # Add command to queue or execute immediately
    if command.priority:
        # Interrupt current action
        await db.characters.update_one(
            {"id": command.character_id},
            {
                "$set": {"current_action": command.command},
                "$push": {"memory": f"Player commanded: {command.command}"}
            }
        )
    else:
        await db.characters.update_one(
            {"id": command.character_id},
            {"$push": {"action_queue": command.command}}
        )
    
    return {"status": "success", "command": command.command}

@api_router.post("/characters/{character_id}/move")
async def move_character(character_id: str, location_id: str):
    """Move a character to a new location"""
    location = await db.locations.find_one({"id": location_id})
    if not location:
        return {"error": "Location not found"}
    
    await db.characters.update_one(
        {"id": character_id},
        {
            "$set": {
                "location_id": location_id,
                "current_action": f"Arrived at {location['name']}"
            },
            "$push": {"memory": f"Traveled to {location['name']}"}
        }
    )
    
    return {"status": "success", "location": location_id}

# Reset Game
@api_router.post("/reset")
async def reset_game():
    """Reset the game to initial state"""
    await db.characters.delete_many({})
    await db.locations.delete_many({})
    await db.action_logs.delete_many({})
    await db.world_state.delete_many({})
    
    # Reinitialize
    for loc in DEFAULT_LOCATIONS:
        await db.locations.insert_one(loc.model_dump())
    
    for char in DEFAULT_CHARACTERS:
        char.relationships = [
            Relationship(
                character_id=other.id,
                character_name=other.name,
                friendship=random.randint(10, 40),
                romance=0
            )
            for other in DEFAULT_CHARACTERS if other.id != char.id
        ]
        await db.characters.insert_one(char.model_dump())
    
    world = WorldState()
    await db.world_state.insert_one(world.model_dump())
    
    return {"status": "success", "message": "Game reset complete"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
