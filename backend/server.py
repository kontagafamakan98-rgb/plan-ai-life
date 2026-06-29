from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random
import json
import bcrypt
import jwt
import httpx
import stripe
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'life_simulator')]

JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret_change_me')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Create the main app
app = FastAPI(title="Life - Simulateur de Vie")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def serialize_doc(doc):
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

# ==================== TRANSLATIONS ====================

TRANSLATIONS = {
    "en": {
        "app_name": "Life",
        "create_character": "Create Character",
        "name": "Name",
        "age": "Age",
        "gender": "Gender",
        "male": "Male",
        "female": "Female",
        "other": "Other",
        "skin_color": "Skin Color",
        "hair_color": "Hair Color",
        "height": "Height",
        "occupation": "Occupation",
        "student": "Student",
        "unemployed": "Unemployed",
        "employed": "Employed",
        "retired": "Retired",
        "child": "Child",
        "attributes": "Attributes",
        "intelligence": "Intelligence",
        "strength": "Strength",
        "charisma": "Charisma",
        "beauty": "Beauty",
        "creativity": "Creativity",
        "luck": "Luck",
        "objectives": "Life Objectives",
        "hobbies": "Hobbies",
        "needs": {"hunger": "Hunger", "energy": "Energy", "social": "Social", "hygiene": "Hygiene", "fun": "Fun", "bladder": "Bladder", "comfort": "Comfort"},
        "login": "Login",
        "register": "Register",
        "logout": "Logout",
        "settings": "Settings",
        "language": "Language",
        "travel": "Travel",
        "simulate": "Simulate Life",
        "have_baby": "Have a Baby"
    },
    "fr": {
        "app_name": "Life",
        "create_character": "Créer un personnage",
        "name": "Nom",
        "age": "Âge",
        "gender": "Genre",
        "male": "Homme",
        "female": "Femme",
        "other": "Autre",
        "skin_color": "Couleur de peau",
        "hair_color": "Couleur de cheveux",
        "height": "Taille",
        "occupation": "Occupation",
        "student": "Étudiant",
        "unemployed": "Sans emploi",
        "employed": "Employé",
        "retired": "Retraité",
        "child": "Enfant",
        "attributes": "Attributs",
        "intelligence": "Intelligence",
        "strength": "Force",
        "charisma": "Charisme",
        "beauty": "Beauté",
        "creativity": "Créativité",
        "luck": "Chance",
        "objectives": "Objectifs de vie",
        "hobbies": "Loisirs",
        "needs": {"hunger": "Faim", "energy": "Énergie", "social": "Social", "hygiene": "Hygiène", "fun": "Divertissement", "bladder": "Vessie", "comfort": "Confort"},
        "login": "Connexion",
        "register": "S'inscrire",
        "logout": "Déconnexion",
        "settings": "Paramètres",
        "language": "Langue",
        "travel": "Voyager",
        "simulate": "Simuler la vie",
        "have_baby": "Avoir un bébé"
    },
    "es": {
        "app_name": "Life",
        "create_character": "Crear personaje",
        "name": "Nombre",
        "age": "Edad",
        "gender": "Género",
        "male": "Hombre",
        "female": "Mujer",
        "other": "Otro",
        "attributes": "Atributos",
        "intelligence": "Inteligencia",
        "strength": "Fuerza",
        "charisma": "Carisma",
        "beauty": "Belleza",
        "objectives": "Objetivos de vida",
        "hobbies": "Pasatiempos",
        "needs": {"hunger": "Hambre", "energy": "Energía", "social": "Social", "hygiene": "Higiene", "fun": "Diversión", "bladder": "Vejiga", "comfort": "Comodidad"},
        "login": "Iniciar sesión",
        "logout": "Cerrar sesión",
        "settings": "Ajustes",
        "language": "Idioma",
        "travel": "Viajar",
        "simulate": "Simular vida"
    },
    "de": {
        "app_name": "Life",
        "create_character": "Charakter erstellen",
        "name": "Name",
        "age": "Alter",
        "gender": "Geschlecht",
        "male": "Mann",
        "female": "Frau",
        "other": "Andere",
        "attributes": "Attribute",
        "intelligence": "Intelligenz",
        "strength": "Stärke",
        "charisma": "Charisma",
        "beauty": "Schönheit",
        "objectives": "Lebensziele",
        "hobbies": "Hobbys",
        "needs": {"hunger": "Hunger", "energy": "Energie", "social": "Sozial", "hygiene": "Hygiene", "fun": "Spaß", "bladder": "Blase", "comfort": "Komfort"},
        "login": "Anmelden",
        "logout": "Abmelden",
        "settings": "Einstellungen",
        "language": "Sprache",
        "travel": "Reisen",
        "simulate": "Leben simulieren"
    }
}

# ==================== MODELS ====================

class CharacterNeeds(BaseModel):
    hunger: float = Field(default=100.0, ge=0, le=100)
    energy: float = Field(default=100.0, ge=0, le=100)
    social: float = Field(default=100.0, ge=0, le=100)
    hygiene: float = Field(default=100.0, ge=0, le=100)
    fun: float = Field(default=100.0, ge=0, le=100)
    bladder: float = Field(default=100.0, ge=0, le=100)
    comfort: float = Field(default=100.0, ge=0, le=100)

class CharacterAppearance(BaseModel):
    skin_color: str = "#F5D0C5"
    hair_color: str = "#4A3728"
    eye_color: str = "#6B4423"
    height: int = 170
    body_type: str = "average"

class CharacterAttributes(BaseModel):
    intelligence: float = Field(default=50.0, ge=0, le=100)
    strength: float = Field(default=50.0, ge=0, le=100)
    charisma: float = Field(default=50.0, ge=0, le=100)
    beauty: float = Field(default=50.0, ge=0, le=100)
    creativity: float = Field(default=50.0, ge=0, le=100)
    luck: float = Field(default=50.0, ge=0, le=100)
    fitness: float = Field(default=50.0, ge=0, le=100)
    cooking: float = Field(default=30.0, ge=0, le=100)

class CharacterPersonality(BaseModel):
    extroversion: float = Field(default=50.0, ge=0, le=100)
    kindness: float = Field(default=50.0, ge=0, le=100)
    humor: float = Field(default=50.0, ge=0, le=100)
    ambition: float = Field(default=50.0, ge=0, le=100)

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    name: str
    age: int
    gender: str = "male"
    occupation: str = "unemployed"
    education: str = "none"
    bio: str = ""
    avatar_emoji: str = "😊"
    appearance: CharacterAppearance = Field(default_factory=CharacterAppearance)
    attributes: CharacterAttributes = Field(default_factory=CharacterAttributes)
    personality: CharacterPersonality = Field(default_factory=CharacterPersonality)
    objectives: List[str] = Field(default_factory=list)  # Life goals
    hobbies: List[str] = Field(default_factory=list)  # Hobbies/interests
    location_id: str = "paris_cafe"
    position_x: float = 50.0
    position_y: float = 50.0
    target_x: float = 50.0
    target_y: float = 50.0
    is_moving: bool = False
    move_speed: float = 2.0
    needs: CharacterNeeds = Field(default_factory=CharacterNeeds)
    relationships: List[Dict] = Field(default_factory=list)
    family: List[str] = Field(default_factory=list)
    children: List[str] = Field(default_factory=list)
    partner_id: Optional[str] = None
    current_action: str = "Idle"
    action_queue: List[str] = Field(default_factory=list)
    money: float = 1000.0
    mood: str = "Happy"
    thoughts: List[str] = Field(default_factory=list)
    memory: List[str] = Field(default_factory=list)
    is_npc: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CharacterCreate(BaseModel):
    name: str
    age: int
    gender: str = "male"
    occupation: str = "unemployed"
    education: str = "none"
    bio: str = ""
    skin_color: str = "#F5D0C5"
    hair_color: str = "#4A3728"
    eye_color: str = "#6B4423"
    height: int = 170
    body_type: str = "average"
    # Attributes
    intelligence: float = 50.0
    strength: float = 50.0
    charisma: float = 50.0
    beauty: float = 50.0
    creativity: float = 50.0
    luck: float = 50.0
    # Personality
    extroversion: float = 50.0
    kindness: float = 50.0
    humor: float = 50.0
    ambition: float = 50.0
    # Life setup
    objectives: List[str] = Field(default_factory=list)
    hobbies: List[str] = Field(default_factory=list)

class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    type: str
    city: str
    country: str
    emoji: str
    available_actions: List[str] = Field(default_factory=list)
    objects: List[str] = Field(default_factory=list)
    is_premium: bool = False

class User(BaseModel):
    id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str = ""
    picture: str = ""
    password_hash: Optional[str] = None
    language: str = "en"
    is_premium: bool = False
    characters: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserRegister(BaseModel):
    email: str
    password: str
    name: str = ""
    language: str = "en"

class UserLogin(BaseModel):
    email: str
    password: str

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class WorldState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    game_time: datetime = Field(default_factory=datetime.utcnow)
    time_speed: float = 1.0
    is_paused: bool = False
    current_weather: str = "sunny"
    online_users: int = 0

# ==================== DEFAULT DATA ====================

OBJECTIVES_LIST = [
    "become_rich", "find_love", "have_family", "become_famous", 
    "travel_world", "master_career", "stay_healthy", "help_others",
    "learn_everything", "live_simply", "become_artist", "become_athlete"
]

HOBBIES_LIST = [
    "reading", "gaming", "cooking", "sports", "music", "art",
    "dancing", "photography", "gardening", "yoga", "swimming",
    "hiking", "movies", "socializing", "coding", "writing"
]

DEFAULT_LOCATIONS = [
    Location(
        id="paris_cafe", name="Le Petit Parisien", description="A cozy Parisian cafe",
        type="cafe", city="Paris", country="France", emoji="☕",
        available_actions=["drink_coffee", "eat_croissant", "read_newspaper", "chat_with_others", "work_on_laptop", "people_watch", "flirt"],
        objects=["espresso_machine", "pastry_display", "chairs", "newspapers"]
    ),
    Location(
        id="tokyo_apartment", name="Shibuya Apartment", description="A modern Tokyo apartment",
        type="apartment", city="Tokyo", country="Japan", emoji="🏠",
        available_actions=["sleep", "cook_meal", "watch_tv", "take_shower", "use_toilet", "relax", "exercise", "study", "play_games"],
        objects=["futon", "kitchen", "tv", "bathroom", "gaming_console"]
    ),
    Location(
        id="nyc_office", name="Manhattan Tech Hub", description="A modern office building",
        type="office", city="New York", country="USA", emoji="💼",
        available_actions=["work", "attend_meeting", "coffee_break", "network", "brainstorm", "lunch"],
        objects=["desks", "meeting_rooms", "coffee_machine"]
    ),
    Location(
        id="london_park", name="Hyde Park", description="A beautiful green park",
        type="park", city="London", country="UK", emoji="🌳",
        available_actions=["jog", "walk", "have_picnic", "feed_ducks", "read_book", "meet_friends", "yoga", "play_frisbee"],
        objects=["benches", "lake", "pathways", "gardens"]
    ),
    Location(
        id="barcelona_gym", name="FitLife Barcelona", description="A modern fitness center",
        type="gym", city="Barcelona", country="Spain", emoji="💪",
        available_actions=["lift_weights", "cardio", "swim", "yoga_class", "sauna", "boxing"],
        objects=["weights", "treadmills", "pool", "sauna"]
    ),
    Location(
        id="rome_restaurant", name="Trattoria Da Nonna", description="An Italian restaurant",
        type="restaurant", city="Rome", country="Italy", emoji="🍝",
        available_actions=["eat_dinner", "drink_wine", "romantic_date", "celebrate", "socialize"],
        objects=["tables", "wine_cellar", "kitchen"]
    ),
    Location(
        id="berlin_club", name="Berghain Underground", description="A legendary techno club",
        type="club", city="Berlin", country="Germany", emoji="🎵",
        available_actions=["dance", "drink", "meet_people", "enjoy_music", "flirt", "party"],
        objects=["dance_floor", "bars", "dj_booth"],
        is_premium=True
    ),
    Location(
        id="sydney_beach", name="Bondi Beach", description="The iconic Australian beach",
        type="beach", city="Sydney", country="Australia", emoji="🏖️",
        available_actions=["swim", "surf", "sunbathe", "volleyball", "build_sandcastle", "relax"],
        objects=["beach", "surf_boards", "umbrellas"]
    ),
    Location(
        id="school", name="International School", description="A school for learning",
        type="school", city="Various", country="International", emoji="🏫",
        available_actions=["study", "attend_class", "homework", "make_friends", "sports", "lunch"],
        objects=["classrooms", "library", "cafeteria"]
    ),
    Location(
        id="hospital", name="City Hospital", description="A medical center",
        type="hospital", city="Various", country="International", emoji="🏥",
        available_actions=["checkup", "visit_patient", "have_baby", "rest"],
        objects=["rooms", "pharmacy", "maternity_ward"]
    )
]

DEFAULT_NPCS = [
    Character(
        id="npc_sophie", name="Sophie Laurent", age=28, gender="female", occupation="Fashion Designer",
        bio="A creative fashion designer from Paris.", avatar_emoji="👩‍🎨", location_id="paris_cafe",
        appearance=CharacterAppearance(skin_color="#F5D0C5", hair_color="#4A3728", height=165),
        attributes=CharacterAttributes(intelligence=70, strength=30, charisma=75, beauty=80, creativity=90, luck=50),
        personality=CharacterPersonality(extroversion=75, kindness=70, humor=60, ambition=80),
        objectives=["become_famous", "find_love"], hobbies=["art", "photography", "socializing"],
        position_x=30, position_y=40, is_npc=True
    ),
    Character(
        id="npc_kenji", name="Kenji Tanaka", age=32, gender="male", occupation="Software Engineer",
        bio="A tech genius from Tokyo.", avatar_emoji="👨‍💻", location_id="tokyo_apartment",
        appearance=CharacterAppearance(skin_color="#E8C4A0", hair_color="#1A1A1A", height=175),
        attributes=CharacterAttributes(intelligence=95, strength=40, charisma=40, beauty=50, creativity=70, luck=60),
        personality=CharacterPersonality(extroversion=35, kindness=60, humor=40, ambition=85),
        objectives=["become_rich", "master_career"], hobbies=["coding", "gaming", "reading"],
        position_x=60, position_y=50, is_npc=True
    ),
    Character(
        id="npc_marcus", name="Marcus Johnson", age=35, gender="male", occupation="Marketing Director",
        bio="A charismatic businessman from New York.", avatar_emoji="👨‍💼", location_id="nyc_office",
        appearance=CharacterAppearance(skin_color="#8D5524", hair_color="#1A1A1A", height=185),
        attributes=CharacterAttributes(intelligence=75, strength=55, charisma=90, beauty=65, creativity=55, luck=70),
        personality=CharacterPersonality(extroversion=90, kindness=75, humor=85, ambition=95),
        objectives=["become_rich", "have_family", "become_famous"], hobbies=["sports", "socializing", "music"],
        position_x=70, position_y=30, is_npc=True
    )
]

# ==================== FREE AI DECISION ENGINE ====================

def get_free_ai_decision(character_dict: dict, location: dict, other_characters: list) -> dict:
    """FREE AI - No LLM API calls needed! Uses smart rules."""
    
    needs = character_dict.get("needs", {})
    personality = character_dict.get("personality", {})
    attributes = character_dict.get("attributes", {})
    hobbies = character_dict.get("hobbies", [])
    available_actions = location.get("available_actions", ["idle"])
    
    # Priority needs
    urgent_needs = []
    if needs.get("bladder", 100) < 30:
        urgent_needs.append(("bladder", ["use_toilet", "toilet"]))
    if needs.get("hunger", 100) < 30:
        urgent_needs.append(("hunger", ["eat", "cook", "dinner", "croissant", "lunch"]))
    if needs.get("energy", 100) < 25:
        urgent_needs.append(("energy", ["sleep", "rest", "relax", "nap"]))
    if needs.get("hygiene", 100) < 25:
        urgent_needs.append(("hygiene", ["shower", "swim"]))
    
    action = None
    
    # Handle urgent needs first
    for need_name, keywords in urgent_needs:
        for action_name in available_actions:
            if any(kw in action_name.lower() for kw in keywords):
                action = action_name
                break
        if action:
            break
    
    # If no urgent need, choose based on personality, attributes and hobbies
    if not action:
        weighted_actions = []
        
        # Social personality prefers social activities
        if personality.get("extroversion", 50) > 60:
            social_keywords = ["chat", "meet", "social", "dance", "network", "flirt", "party", "friends"]
            for a in available_actions:
                if any(kw in a.lower() for kw in social_keywords):
                    weighted_actions.extend([a] * 3)
        
        # High charisma = better at social stuff
        if attributes.get("charisma", 50) > 70:
            for a in available_actions:
                if any(kw in a.lower() for kw in ["flirt", "network", "socialize"]):
                    weighted_actions.extend([a] * 2)
        
        # High intelligence prefers learning
        if attributes.get("intelligence", 50) > 70:
            for a in available_actions:
                if any(kw in a.lower() for kw in ["read", "study", "work", "brainstorm"]):
                    weighted_actions.extend([a] * 2)
        
        # High strength prefers physical
        if attributes.get("strength", 50) > 60:
            for a in available_actions:
                if any(kw in a.lower() for kw in ["exercise", "lift", "jog", "swim", "sports", "boxing"]):
                    weighted_actions.extend([a] * 2)
        
        # Match hobbies to actions
        hobby_keywords = {
            "reading": ["read", "book"],
            "gaming": ["game", "play"],
            "cooking": ["cook", "meal"],
            "sports": ["jog", "swim", "volleyball", "sports", "exercise"],
            "music": ["music", "dance"],
            "art": ["art", "creative"],
            "dancing": ["dance"],
            "photography": ["photo"],
            "yoga": ["yoga", "meditate"],
            "swimming": ["swim"],
            "socializing": ["chat", "meet", "friends", "social"],
        }
        
        for hobby in hobbies:
            keywords = hobby_keywords.get(hobby, [])
            for a in available_actions:
                if any(kw in a.lower() for kw in keywords):
                    weighted_actions.extend([a] * 3)
        
        # Check moderate needs
        if needs.get("fun", 100) < 50:
            for a in available_actions:
                if any(kw in a.lower() for kw in ["dance", "music", "tv", "game", "swim", "surf", "party"]):
                    weighted_actions.append(a)
        
        if needs.get("social", 100) < 50:
            for a in available_actions:
                if any(kw in a.lower() for kw in ["chat", "meet", "friend", "date", "flirt"]):
                    weighted_actions.append(a)
        
        # Add all available with lower weight
        weighted_actions.extend(available_actions)
        action = random.choice(weighted_actions) if weighted_actions else "idle"
    
    # Generate thought
    thoughts_map = {
        "eat": ["I'm getting hungry...", "Time for food!", "Yummy!"],
        "sleep": ["So tired...", "Need rest.", "Zzz..."],
        "work": ["Let's be productive!", "Focus time!", "Work hard!"],
        "chat": ["Who's around?", "Let's talk!", "I need company."],
        "dance": ["Feel the beat!", "Let's dance!", "Party time!"],
        "exercise": ["Gotta stay fit!", "Workout time!", "Feel the burn!"],
        "coffee": ["Need caffeine!", "Coffee time!", "Ah, coffee..."],
        "shower": ["Time to freshen up!", "Clean time!", "A shower sounds nice."],
        "read": ["Learning time!", "What's new?", "Books are life."],
        "flirt": ["Someone cute here?", "Feeling romantic...", "Let's mingle!"],
        "swim": ["Water feels great!", "Splash!", "Swimming is fun!"],
        "study": ["Time to learn!", "Education matters!", "Study hard!"],
        "game": ["Gaming time!", "Let's play!", "Level up!"],
    }
    
    thought = "Hmm, what should I do..."
    for key, templates in thoughts_map.items():
        if key in action.lower():
            thought = random.choice(templates)
            break
    
    # Mood based on needs
    avg_needs = sum([needs.get(k, 100) for k in ["hunger", "energy", "social", "fun", "comfort"]]) / 5
    if avg_needs > 70:
        mood = random.choice(["Happy", "Excited", "Content"])
    elif avg_needs > 40:
        mood = random.choice(["Focused", "Content", "Social"])
    else:
        mood = random.choice(["Tired", "Anxious", "Bored", "Sad"])
    
    # Movement
    current_x = character_dict.get("position_x", 50)
    current_y = character_dict.get("position_y", 50)
    
    # Move towards a random spot, but influenced by personality
    if personality.get("extroversion", 50) > 60:
        # Extroverts move more towards center (where people are)
        target_x = random.uniform(30, 70)
        target_y = random.uniform(30, 70)
    else:
        # Introverts might stay more to the sides
        target_x = random.uniform(10, 90)
        target_y = random.uniform(10, 80)
    
    # Should change location?
    should_move = False
    target_location = None
    
    if needs.get("energy", 100) < 20 and "sleep" not in str(available_actions):
        should_move = True
        target_location = "tokyo_apartment"
    elif needs.get("hunger", 100) < 20 and not any("eat" in a for a in available_actions):
        should_move = True
        target_location = random.choice(["rome_restaurant", "paris_cafe"])
    elif needs.get("fun", 100) < 20:
        should_move = True
        target_location = random.choice(["berlin_club", "sydney_beach", "london_park"])
    elif needs.get("social", 100) < 30 and personality.get("extroversion", 50) > 60:
        should_move = True
        target_location = random.choice(["paris_cafe", "berlin_club", "rome_restaurant"])
    
    return {
        "action": action,
        "thought": thought,
        "mood": mood,
        "need_changes": {},
        "should_move": should_move,
        "target_location": target_location,
        "target_x": target_x,
        "target_y": target_y
    }

# ==================== GAME LOGIC ====================

async def apply_time_decay(character_dict: dict) -> dict:
    needs = character_dict.get("needs", {})
    needs["hunger"] = max(0, min(100, needs.get("hunger", 100) - 2.0))
    needs["energy"] = max(0, min(100, needs.get("energy", 100) - 1.5))
    needs["social"] = max(0, min(100, needs.get("social", 100) - 1.0))
    needs["hygiene"] = max(0, min(100, needs.get("hygiene", 100) - 0.5))
    needs["fun"] = max(0, min(100, needs.get("fun", 100) - 1.5))
    needs["bladder"] = max(0, min(100, needs.get("bladder", 100) - 3.0))
    needs["comfort"] = max(0, min(100, needs.get("comfort", 100) - 0.5))
    character_dict["needs"] = needs
    return character_dict

def apply_action_effects(character_dict: dict, action: str) -> dict:
    effects = {
        "sleep": {"energy": 40, "comfort": 20},
        "eat": {"hunger": 30, "fun": 5},
        "croissant": {"hunger": 25, "fun": 10},
        "dinner": {"hunger": 40, "social": 10},
        "cook": {"hunger": 35, "fun": 10},
        "coffee": {"energy": 15, "bladder": -10},
        "work": {"energy": -15, "hunger": -10},
        "chat": {"social": 25, "fun": 10},
        "meet": {"social": 30, "fun": 15},
        "flirt": {"social": 20, "fun": 25},
        "shower": {"hygiene": 50, "comfort": 20},
        "toilet": {"bladder": 60, "comfort": 10},
        "exercise": {"energy": -20, "fun": 10, "hygiene": -15},
        "jog": {"energy": -25, "fun": 15, "hygiene": -20},
        "lift": {"energy": -20, "fun": 10},
        "dance": {"fun": 35, "social": 20, "energy": -20},
        "swim": {"fun": 25, "hygiene": 10, "energy": -15},
        "surf": {"fun": 30, "energy": -25},
        "yoga": {"energy": 10, "comfort": 25, "fun": 15},
        "tv": {"fun": 20, "energy": 5},
        "relax": {"energy": 15, "comfort": 25, "fun": 10},
        "read": {"fun": 15, "energy": 5},
        "study": {"energy": -10, "fun": -5},
        "game": {"fun": 30, "energy": -5},
        "music": {"fun": 25, "comfort": 15},
        "party": {"fun": 35, "social": 30, "energy": -25},
        "date": {"social": 40, "fun": 35},
        "picnic": {"hunger": 20, "social": 15, "fun": 20},
        "sunbathe": {"fun": 20, "comfort": 15},
    }
    
    needs = character_dict.get("needs", {})
    action_lower = action.lower()
    
    for key, changes in effects.items():
        if key in action_lower:
            for need, change in changes.items():
                if need in needs:
                    needs[need] = max(0, min(100, needs.get(need, 100) + change))
            break
    
    character_dict["needs"] = needs
    return character_dict

def move_character_towards_target(character_dict: dict) -> dict:
    """Move character towards target position"""
    current_x = character_dict.get("position_x", 50)
    current_y = character_dict.get("position_y", 50)
    target_x = character_dict.get("target_x", 50)
    target_y = character_dict.get("target_y", 50)
    speed = character_dict.get("move_speed", 3.0)
    
    dx = target_x - current_x
    dy = target_y - current_y
    dist = (dx**2 + dy**2)**0.5
    
    if dist > 2:
        # Move towards target
        character_dict["position_x"] = current_x + (dx / dist) * min(speed, dist)
        character_dict["position_y"] = current_y + (dy / dist) * min(speed, dist)
        character_dict["is_moving"] = True
    else:
        # Arrived at target, pick new random target
        character_dict["is_moving"] = False
        character_dict["target_x"] = random.uniform(10, 90)
        character_dict["target_y"] = random.uniform(10, 80)
    
    return character_dict

# ==================== AUTH ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return None
    user = await db.users.find_one({"id": payload["user_id"]})
    return serialize_doc(user)

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Life Simulator API", "version": "3.0", "ai": "FREE (no LLM cost)"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

@api_router.get("/translations/{lang}")
async def get_translations(lang: str):
    return TRANSLATIONS.get(lang, TRANSLATIONS["en"])

@api_router.get("/translations")
async def get_all_translations():
    return TRANSLATIONS

@api_router.get("/objectives")
async def get_objectives():
    return OBJECTIVES_LIST

@api_router.get("/hobbies")
async def get_hobbies():
    return HOBBIES_LIST

# Auth
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=data.email, name=data.name or data.email.split("@")[0], password_hash=hash_password(data.password), language=data.language)
    await db.users.insert_one(user.model_dump())
    return {"token": create_token(user.id, user.email), "user": serialize_doc(user.model_dump())}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user["id"], user["email"]), "user": serialize_doc(user)}

@api_router.post("/auth/google")
async def google_auth(session_id: str):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": session_id})
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            data = response.json()
            email = data.get("email")
            name = data.get("name", "")
            user = await db.users.find_one({"email": email})
            if not user:
                new_user = User(email=email, name=name, picture=data.get("picture", ""))
                await db.users.insert_one(new_user.model_dump())
                user = new_user.model_dump()
            return {"token": create_token(user["id"], user["email"]), "user": serialize_doc(user)}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Auth failed")

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.put("/auth/language")
async def update_language(lang: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": lang}})
    return {"language": lang}

# World
@api_router.get("/world")
async def get_world_state():
    world = await db.world_state.find_one()
    if not world:
        world = WorldState().model_dump()
        await db.world_state.insert_one(world)
        world = await db.world_state.find_one()
    world["online_users"] = await db.users.count_documents({})
    return serialize_doc(world)

@api_router.post("/world/pause")
async def toggle_pause():
    world = await db.world_state.find_one()
    if world:
        new_paused = not world.get("is_paused", False)
        await db.world_state.update_one({}, {"$set": {"is_paused": new_paused}})
        return {"is_paused": new_paused}
    return {"is_paused": False}

# Locations
@api_router.get("/locations")
async def get_locations():
    locations = await db.locations.find().to_list(100)
    if not locations:
        for loc in DEFAULT_LOCATIONS:
            await db.locations.insert_one(loc.model_dump())
        locations = [loc.model_dump() for loc in DEFAULT_LOCATIONS]
    return serialize_doc(locations)

@api_router.get("/locations/{location_id}")
async def get_location(location_id: str):
    location = await db.locations.find_one({"id": location_id})
    return serialize_doc(location) if location else {"error": "Not found"}

# Characters
@api_router.get("/characters")
async def get_characters():
    characters = await db.characters.find().to_list(100)
    if not characters:
        for char in DEFAULT_NPCS:
            await db.characters.insert_one(char.model_dump())
        characters = [char.model_dump() for char in DEFAULT_NPCS]
    return serialize_doc(characters)

@api_router.get("/characters/{character_id}")
async def get_character(character_id: str):
    character = await db.characters.find_one({"id": character_id})
    return serialize_doc(character) if character else {"error": "Not found"}

@api_router.post("/characters/create")
async def create_character(data: CharacterCreate, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Must be logged in")
    
    # Avatar based on age/gender
    if data.age < 3:
        avatar = "👶"
    elif data.age < 13:
        avatar = "👧" if data.gender == "female" else "👦"
    else:
        avatar = "👩" if data.gender == "female" else ("👨" if data.gender == "male" else "🧑")
    
    character = Character(
        user_id=user["id"],
        name=data.name,
        age=data.age,
        gender=data.gender,
        occupation=data.occupation,
        education=data.education,
        bio=data.bio,
        avatar_emoji=avatar,
        appearance=CharacterAppearance(
            skin_color=data.skin_color,
            hair_color=data.hair_color,
            eye_color=data.eye_color,
            height=data.height,
            body_type=data.body_type
        ),
        attributes=CharacterAttributes(
            intelligence=data.intelligence,
            strength=data.strength,
            charisma=data.charisma,
            beauty=data.beauty,
            creativity=data.creativity,
            luck=data.luck
        ),
        personality=CharacterPersonality(
            extroversion=data.extroversion,
            kindness=data.kindness,
            humor=data.humor,
            ambition=data.ambition
        ),
        objectives=data.objectives,
        hobbies=data.hobbies,
        is_npc=False,
        location_id="tokyo_apartment",
        position_x=random.uniform(30, 70),
        position_y=random.uniform(30, 70)
    )
    
    await db.characters.insert_one(character.model_dump())
    await db.users.update_one({"id": user["id"]}, {"$push": {"characters": character.id}})
    
    return serialize_doc(character.model_dump())

@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    character = await db.characters.find_one({"id": character_id})
    if not character or character.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete")
    await db.characters.delete_one({"id": character_id})
    return {"message": "Deleted"}

@api_router.post("/characters/{character_id}/move")
async def move_character(character_id: str, location_id: str):
    location = await db.locations.find_one({"id": location_id})
    if not location:
        return {"error": "Location not found"}
    
    new_x = random.uniform(20, 80)
    new_y = random.uniform(20, 70)
    
    await db.characters.update_one(
        {"id": character_id},
        {"$set": {
            "location_id": location_id,
            "current_action": f"Arrived at {location['name']}",
            "position_x": new_x,
            "position_y": new_y,
            "target_x": new_x,
            "target_y": new_y,
            "is_moving": False
        }}
    )
    return {"status": "success", "location": location_id}

@api_router.post("/characters/{character_id}/walk")
async def walk_character(character_id: str, target_x: float, target_y: float):
    await db.characters.update_one(
        {"id": character_id},
        {"$set": {"target_x": max(5, min(95, target_x)), "target_y": max(5, min(85, target_y)), "is_moving": True}}
    )
    return {"status": "success"}

@api_router.post("/characters/{character_id}/have-baby")
async def have_baby(character_id: str, partner_id: str, baby_name: str, baby_gender: str = "male", user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    parent1 = await db.characters.find_one({"id": character_id})
    parent2 = await db.characters.find_one({"id": partner_id})
    if not parent1 or not parent2:
        raise HTTPException(status_code=404, detail="Character not found")
    
    baby = Character(
        user_id=user["id"],
        name=baby_name,
        age=0,
        gender=baby_gender,
        occupation="child",
        bio=f"Child of {parent1['name']} and {parent2['name']}",
        avatar_emoji="👶",
        appearance=CharacterAppearance(
            skin_color=random.choice([parent1["appearance"]["skin_color"], parent2["appearance"]["skin_color"]]),
            hair_color=random.choice([parent1["appearance"]["hair_color"], parent2["appearance"]["hair_color"]]),
            height=50
        ),
        attributes=CharacterAttributes(
            intelligence=(parent1.get("attributes", {}).get("intelligence", 50) + parent2.get("attributes", {}).get("intelligence", 50)) / 2,
            strength=(parent1.get("attributes", {}).get("strength", 50) + parent2.get("attributes", {}).get("strength", 50)) / 2,
            charisma=(parent1.get("attributes", {}).get("charisma", 50) + parent2.get("attributes", {}).get("charisma", 50)) / 2,
            beauty=(parent1.get("attributes", {}).get("beauty", 50) + parent2.get("attributes", {}).get("beauty", 50)) / 2 + random.uniform(-10, 10),
        ),
        family=[character_id, partner_id],
        location_id=parent1["location_id"],
        is_npc=False
    )
    
    await db.characters.insert_one(baby.model_dump())
    await db.characters.update_one({"id": character_id}, {"$push": {"children": baby.id}})
    await db.characters.update_one({"id": partner_id}, {"$push": {"children": baby.id}})
    
    return serialize_doc(baby.model_dump())

# Chat
@api_router.get("/chat")
async def get_chat(limit: int = 50):
    messages = await db.chat_messages.find().sort("timestamp", -1).limit(limit).to_list(limit)
    return serialize_doc(messages)

@api_router.post("/chat")
async def send_chat(content: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Must be logged in")
    message = ChatMessage(sender_id=user["id"], sender_name=user.get("name", user["email"]), content=content)
    await db.chat_messages.insert_one(message.model_dump())
    return serialize_doc(message.model_dump())

# Logs
@api_router.get("/logs")
async def get_logs(limit: int = 50):
    logs = await db.action_logs.find().sort("timestamp", -1).limit(limit).to_list(limit)
    return serialize_doc(logs)

# Simulation - FREE AI
@api_router.post("/simulate")
async def simulate_tick():
    world = await db.world_state.find_one()
    if world and world.get("is_paused", False):
        return {"status": "paused"}
    
    characters = await db.characters.find().to_list(100)
    locations = await db.locations.find().to_list(100)
    location_map = {loc["id"]: loc for loc in locations}
    
    results = []
    
    for char_data in characters:
        location = location_map.get(char_data.get("location_id"))
        if not location:
            continue
        
        # Apply time decay
        char_data = await apply_time_decay(char_data)
        
        # Move character towards target
        char_data = move_character_towards_target(char_data)
        
        # Get FREE AI decision
        decision = get_free_ai_decision(char_data, location, characters)
        
        # Apply action effects
        char_data = apply_action_effects(char_data, decision.get("action", ""))
        
        # Update state
        char_data["current_action"] = decision.get("action", "Idle")
        char_data["mood"] = decision.get("mood", char_data.get("mood", "Happy"))
        char_data["target_x"] = decision.get("target_x", char_data.get("target_x", 50))
        char_data["target_y"] = decision.get("target_y", char_data.get("target_y", 50))
        
        thought = decision.get("thought", "")
        if thought:
            thoughts = char_data.get("thoughts", [])
            thoughts.append(thought)
            char_data["thoughts"] = thoughts[-10:]
        
        # Handle location change
        if decision.get("should_move") and decision.get("target_location"):
            target_loc = decision.get("target_location")
            if target_loc in location_map:
                char_data["location_id"] = target_loc
                char_data["current_action"] = f"Going to {location_map[target_loc]['name']}"
                char_data["position_x"] = random.uniform(20, 80)
                char_data["position_y"] = random.uniform(20, 70)
        
        # Save
        await db.characters.update_one({"id": char_data["id"]}, {"$set": char_data})
        
        # Log
        await db.action_logs.insert_one({
            "id": str(uuid.uuid4()),
            "character_id": char_data["id"],
            "character_name": char_data["name"],
            "action": char_data["current_action"],
            "location": location["name"],
            "thought": thought,
            "timestamp": datetime.utcnow()
        })
        
        results.append({
            "character_id": char_data["id"],
            "name": char_data["name"],
            "action": char_data["current_action"],
            "thought": thought,
            "mood": char_data["mood"],
            "location": char_data["location_id"],
            "position_x": char_data.get("position_x"),
            "position_y": char_data.get("position_y"),
            "is_moving": char_data.get("is_moving")
        })
    
    return {"status": "success", "results": results}

# Reset
@api_router.post("/reset")
async def reset_game():
    await db.characters.delete_many({})
    await db.locations.delete_many({})
    await db.action_logs.delete_many({})
    await db.world_state.delete_many({})
    await db.chat_messages.delete_many({})
    
    for loc in DEFAULT_LOCATIONS:
        await db.locations.insert_one(loc.model_dump())
    for char in DEFAULT_NPCS:
        await db.characters.insert_one(char.model_dump())
    
    await db.world_state.insert_one(WorldState().model_dump())
    return {"status": "success", "message": "Game reset!"}

# ==================== STRIPE PAYMENT ROUTES ====================

class SubscriptionRequest(BaseModel):
    price_id: str = "price_premium_monthly"  # Default premium price

# Premium pricing
PREMIUM_PRICES = {
    "monthly": {"amount": 499, "currency": "usd", "interval": "month", "name": "Premium Monthly"},
    "yearly": {"amount": 3999, "currency": "usd", "interval": "year", "name": "Premium Yearly"}
}

@api_router.get("/stripe/prices")
async def get_stripe_prices():
    """Get available subscription prices"""
    return {
        "prices": [
            {"id": "monthly", "name": "Premium Monthly", "amount": 4.99, "currency": "USD", "interval": "month"},
            {"id": "yearly", "name": "Premium Yearly", "amount": 39.99, "currency": "USD", "interval": "year", "savings": "33%"}
        ]
    }

@api_router.post("/stripe/create-checkout-session")
async def create_checkout_session(plan: str = "monthly", user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription"""
    if not user:
        raise HTTPException(status_code=401, detail="Must be logged in")
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    try:
        price_info = PREMIUM_PRICES.get(plan, PREMIUM_PRICES["monthly"])
        
        # Create or get Stripe customer
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=user["email"],
                name=user.get("name", ""),
                metadata={"user_id": user["id"]}
            )
            customer_id = customer.id
            await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_customer_id": customer_id}})
        
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price_data": {
                    "currency": price_info["currency"],
                    "unit_amount": price_info["amount"],
                    "recurring": {"interval": price_info["interval"]},
                    "product_data": {"name": f"Life Premium - {price_info['name']}"}
                },
                "quantity": 1
            }],
            success_url=os.environ.get("FRONTEND_URL", "https://example.com") + "/?subscription=success",
            cancel_url=os.environ.get("FRONTEND_URL", "https://example.com") + "/?subscription=cancelled",
            metadata={"user_id": user["id"], "plan": plan}
        )
        
        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Payment error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing failed")

@api_router.post("/stripe/webhook")
async def stripe_webhook(request):
    """Handle Stripe webhooks for subscription events"""
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")
        
        # In production, verify webhook signature with endpoint secret
        # event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        
        event = json.loads(payload)
        event_type = event.get("type", "")
        
        if event_type == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session.get("metadata", {}).get("user_id")
            if user_id:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "is_premium": True,
                        "premium_until": datetime.now(timezone.utc) + timedelta(days=30),
                        "stripe_subscription_id": session.get("subscription")
                    }}
                )
                logger.info(f"User {user_id} upgraded to premium")
        
        elif event_type == "customer.subscription.deleted":
            subscription = event["data"]["object"]
            customer_id = subscription.get("customer")
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            if user:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"is_premium": False, "premium_until": None}}
                )
                logger.info(f"User {user['id']} subscription cancelled")
        
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")

@api_router.get("/stripe/subscription-status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Get user's subscription status"""
    if not user:
        return {"is_premium": False, "subscription": None}
    
    return {
        "is_premium": user.get("is_premium", False),
        "premium_until": user.get("premium_until"),
        "stripe_customer_id": user.get("stripe_customer_id"),
        "subscription_id": user.get("stripe_subscription_id")
    }

@api_router.post("/stripe/cancel-subscription")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """Cancel user's subscription"""
    if not user:
        raise HTTPException(status_code=401, detail="Must be logged in")
    
    subscription_id = user.get("stripe_subscription_id")
    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    
    try:
        stripe.Subscription.delete(subscription_id)
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"is_premium": False, "premium_until": None, "stripe_subscription_id": None}}
        )
        return {"status": "cancelled", "message": "Subscription cancelled successfully"}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Mock payment for testing without real Stripe
@api_router.post("/stripe/mock-subscribe")
async def mock_subscribe(user: dict = Depends(get_current_user)):
    """Mock subscription for testing (activates premium for 30 days)"""
    if not user:
        raise HTTPException(status_code=401, detail="Must be logged in")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "is_premium": True,
            "premium_until": datetime.now(timezone.utc) + timedelta(days=30)
        }}
    )
    return {"status": "success", "message": "Premium activated for 30 days (mock)"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
