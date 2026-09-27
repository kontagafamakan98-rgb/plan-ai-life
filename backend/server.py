from fastapi import FastAPI, APIRouter, Body, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import hashlib
import hmac
import os
import logging
import secrets
import sys
from base64 import urlsafe_b64decode, urlsafe_b64encode
from contextlib import asynccontextmanager
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random
import json

ROOT_DIR = Path(__file__).parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / '.env')

from arcadia import api as arcadia_api  # noqa: E402
from arcadia import content as arcadia_content  # noqa: E402
from arcadia import engine as arcadia_engine  # noqa: E402
from arcadia import legacy as arcadia_legacy  # noqa: E402
from arcadia import store as arcadia_store  # noqa: E402

# ---------------------------------------------------------------------------
# Optional third-party integrations.
# The game must boot and be fully playable without any of them, so each import
# degrades gracefully instead of crashing the process at start-up.
# ---------------------------------------------------------------------------
try:  # pragma: no cover - depends on the deployment image
    import bcrypt

    HAS_BCRYPT = True
except ImportError:  # pragma: no cover
    bcrypt = None
    HAS_BCRYPT = False

try:  # pragma: no cover
    import jwt

    HAS_PYJWT = True
except ImportError:  # pragma: no cover
    jwt = None
    HAS_PYJWT = False

try:  # pragma: no cover
    import httpx

    HAS_HTTPX = True
except ImportError:  # pragma: no cover
    httpx = None
    HAS_HTTPX = False

try:  # pragma: no cover
    import stripe

    HAS_STRIPE = True
except ImportError:  # pragma: no cover
    stripe = None
    HAS_STRIPE = False

try:  # pragma: no cover
    from bson import ObjectId

    HAS_BSON = True
except ImportError:  # pragma: no cover

    class ObjectId(str):  # type: ignore[misc]
        """Fallback used only for ``isinstance`` checks in ``serialize_doc``."""

    HAS_BSON = False

# ---------------------------------------------------------------------------
# Persistence.
# Default is an atomic local JSON save file, so `uvicorn server:app` works with
# nothing else installed. Set MONGO_URL to switch to MongoDB; if it is set but
# unreachable we log a warning and keep playing on the local save.
# ---------------------------------------------------------------------------
db = arcadia_store.json_store()

JWT_SECRET = os.environ.get('JWT_SECRET') or secrets.token_urlsafe(32)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')

if HAS_STRIPE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Resolve persistence, make sure the world exists, release on shutdown.

    Declared before the app so it can be handed straight to ``FastAPI``; the
    helpers it calls live further down the module and are resolved at runtime.
    """
    global db
    resolved = await arcadia_store.get_db()
    if resolved is not None:
        db = resolved
    await _seed_locations()
    state = await db.game_state.find_one({"id": "main"})
    if not state:
        locations = await db.locations.find().to_list(100)
        await db.game_state.update_one(
            {"id": "main"},
            {"$set": arcadia_engine.new_state(locations)},
            upsert=True,
        )
        logger.info("[startup] New iteration created.")
    logger.info("[startup] %s ready.", arcadia_content.BRAND["name"])
    try:
        yield
    finally:
        arcadia_store.close_mongo_client()


# Create the main app
app = FastAPI(
    title=arcadia_content.BRAND["name"] + " — simulateur de vies",
    lifespan=lifespan,
)
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorldState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    game_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    ),
    # ---- New countries / iconic landmarks (20+ countries world map) ----
    Location(
        id="dubai_mall", name="Dubai Mall", description="The world's largest shopping mall",
        type="market", city="Dubai", country="UAE", emoji="🏬",
        available_actions=["shopping", "watch_fountain", "luxury_dining", "skating", "people_watch"],
        objects=["boutiques", "aquarium", "fountain", "food_court"], is_premium=True
    ),
    Location(
        id="rio_beach", name="Copacabana Beach", description="Iconic Brazilian beach",
        type="beach", city="Rio de Janeiro", country="Brazil", emoji="🏝️",
        available_actions=["sunbathe", "samba_dance", "volleyball", "drink_caipirinha", "surf"],
        objects=["sand", "kiosks", "umbrellas"]
    ),
    Location(
        id="mumbai_market", name="Crawford Market", description="A bustling Indian bazaar",
        type="market", city="Mumbai", country="India", emoji="🧺",
        available_actions=["bargain", "buy_spices", "eat_street_food", "chai_break", "people_watch"],
        objects=["stalls", "spices", "fabrics", "street_food"]
    ),
    Location(
        id="cairo_museum", name="Egyptian Museum", description="Home to ancient pharaohs",
        type="museum", city="Cairo", country="Egypt", emoji="🏛️",
        available_actions=["admire_art", "study_history", "guided_tour", "photograph", "meditate"],
        objects=["mummies", "sarcophagi", "papyrus", "artifacts"]
    ),
    Location(
        id="seoul_cinema", name="CGV Yongsan", description="A massive Korean cinema complex",
        type="cinema", city="Seoul", country="South Korea", emoji="🎬",
        available_actions=["watch_movie", "eat_popcorn", "first_date", "discuss_film", "vr_experience"],
        objects=["screens", "snack_bar", "vr_room"]
    ),
    Location(
        id="kyoto_temple", name="Kinkaku-ji", description="The Golden Pavilion",
        type="temple", city="Kyoto", country="Japan", emoji="⛩️",
        available_actions=["meditate", "pray", "tea_ceremony", "garden_walk", "photograph"],
        objects=["pagoda", "koi_pond", "bonsai", "incense"]
    ),
    Location(
        id="himalaya_mountain", name="Everest Base Camp", description="The roof of the world",
        type="mountain", city="Khumbu", country="Nepal", emoji="🏔️",
        available_actions=["hike", "climb", "stargaze", "meditate", "yak_ride"],
        objects=["tents", "prayer_flags", "yaks", "summit"], is_premium=True
    ),
    Location(
        id="amsterdam_park", name="Vondelpark", description="The lungs of Amsterdam",
        type="park", city="Amsterdam", country="Netherlands", emoji="🌷",
        available_actions=["cycle", "picnic", "feed_swans", "rollerblade", "open_air_concert"],
        objects=["canals", "tulips", "bikes", "windmill"]
    ),
    Location(
        id="bangkok_market", name="Chatuchak Market", description="Asia's largest weekend market",
        type="market", city="Bangkok", country="Thailand", emoji="🍜",
        available_actions=["eat_pad_thai", "haggle", "buy_silk", "drink_coconut", "explore"],
        objects=["stalls", "street_food", "souvenirs"]
    ),
    Location(
        id="mexico_cathedral", name="Metropolitan Cathedral", description="Heart of Mexico City",
        type="temple", city="Mexico City", country="Mexico", emoji="⛪",
        available_actions=["pray", "light_candle", "tour_architecture", "reflect", "confession"],
        objects=["altars", "frescoes", "bells"]
    ),
    Location(
        id="capetown_safari", name="Table Mountain", description="A South African natural wonder",
        type="mountain", city="Cape Town", country="South Africa", emoji="🦁",
        available_actions=["hike", "cable_car", "spot_wildlife", "photograph", "picnic"],
        objects=["cable_car", "rocks", "viewpoint"]
    ),
    Location(
        id="istanbul_bazaar", name="Grand Bazaar", description="A historic Turkish bazaar",
        type="market", city="Istanbul", country="Turkey", emoji="🕌",
        available_actions=["drink_tea", "buy_rugs", "haggle", "smoke_hookah", "eat_baklava"],
        objects=["lamps", "carpets", "spices", "tea"]
    ),
    Location(
        id="toronto_office", name="CN Tower Offices", description="A skyscraper office in Canada",
        type="office", city="Toronto", country="Canada", emoji="🏙️",
        available_actions=["work", "skyline_view", "coffee_break", "elevator_ride", "network"],
        objects=["desks", "glass_floor", "telescope"]
    ),
    Location(
        id="buenos_aires_club", name="Tango Milonga", description="A passionate tango club",
        type="club", city="Buenos Aires", country="Argentina", emoji="💃",
        available_actions=["dance_tango", "drink_malbec", "flirt", "live_music", "romance"],
        objects=["dance_floor", "stage", "bar"]
    ),
    Location(
        id="stockholm_park", name="Djurgården", description="A royal island of nature",
        type="park", city="Stockholm", country="Sweden", emoji="❄️",
        available_actions=["walk", "ski", "fika_break", "ice_skate", "spot_moose"],
        objects=["forest", "lake", "deer"]
    ),
    Location(
        id="lisbon_cafe", name="A Brasileira", description="A historic Portuguese cafe",
        type="cafe", city="Lisbon", country="Portugal", emoji="🍷",
        available_actions=["drink_espresso", "eat_pastel_de_nata", "read_poetry", "people_watch", "chat"],
        objects=["pastries", "tiles", "patio"]
    ),
    Location(
        id="alps_mountain", name="Matterhorn", description="The iconic Swiss Alps",
        type="mountain", city="Zermatt", country="Switzerland", emoji="⛰️",
        available_actions=["ski", "snowboard", "hike", "fondue_dinner", "stargaze"],
        objects=["snow", "chalets", "cable_car"]
    ),
    Location(
        id="athens_temple", name="Parthenon", description="An ancient Greek wonder",
        type="temple", city="Athens", country="Greece", emoji="🏛️",
        available_actions=["admire_history", "philosophize", "photograph", "study", "reflect"],
        objects=["columns", "ruins", "view"]
    ),
    Location(
        id="bali_beach", name="Kuta Beach", description="A tropical Indonesian paradise",
        type="beach", city="Bali", country="Indonesia", emoji="🌴",
        available_actions=["surf", "yoga_sunset", "drink_coconut", "scuba_dive", "spa"],
        objects=["waves", "palms", "loungers"]
    ),
    Location(
        id="moscow_museum", name="Bolshoi Theatre", description="A legendary Russian theatre",
        type="museum", city="Moscow", country="Russia", emoji="🎭",
        available_actions=["watch_ballet", "opera", "applaud", "champagne_intermission", "admire_art"],
        objects=["stage", "balconies", "chandeliers"], is_premium=True
    ),
    # User-owned buildable location
    Location(
        id="my_home", name="My Home", description="Your personal home you can fully customize",
        type="apartment", city="Anywhere", country="Yours", emoji="🏡",
        available_actions=["sleep", "cook_meal", "watch_tv", "take_shower", "use_toilet", "relax", "exercise", "play_games", "read", "host_party"],
        objects=["sofa", "bed", "kitchen", "tv", "garden"]
    ),
]

# ==================== BUILDABLE OBJECTS CATALOG ====================
BUILD_CATALOG = [
    # Free items
    {"id": "sofa", "name": "Sofa", "emoji": "🛋️", "category": "furniture", "size": 2, "cost": 100, "premium": False},
    {"id": "bed", "name": "Bed", "emoji": "🛏️", "category": "furniture", "size": 2, "cost": 150, "premium": False},
    {"id": "chair", "name": "Chair", "emoji": "🪑", "category": "furniture", "size": 1, "cost": 30, "premium": False},
    {"id": "table", "name": "Table", "emoji": "🪟", "category": "furniture", "size": 2, "cost": 80, "premium": False},
    {"id": "lamp", "name": "Lamp", "emoji": "💡", "category": "decor", "size": 1, "cost": 25, "premium": False},
    {"id": "plant", "name": "Plant", "emoji": "🪴", "category": "decor", "size": 1, "cost": 20, "premium": False},
    {"id": "tv", "name": "TV", "emoji": "📺", "category": "electronics", "size": 2, "cost": 250, "premium": False},
    {"id": "kitchen", "name": "Kitchen", "emoji": "🍳", "category": "appliance", "size": 3, "cost": 500, "premium": False},
    {"id": "bathroom", "name": "Bathroom", "emoji": "🚽", "category": "appliance", "size": 2, "cost": 350, "premium": False},
    {"id": "bookshelf", "name": "Bookshelf", "emoji": "📚", "category": "furniture", "size": 1, "cost": 90, "premium": False},
    {"id": "tree", "name": "Tree", "emoji": "🌳", "category": "outdoor", "size": 2, "cost": 50, "premium": False},
    {"id": "flowers", "name": "Flowers", "emoji": "🌷", "category": "outdoor", "size": 1, "cost": 15, "premium": False},
    {"id": "fence", "name": "Fence", "emoji": "🚧", "category": "outdoor", "size": 1, "cost": 40, "premium": False},
    {"id": "rug", "name": "Rug", "emoji": "🟫", "category": "decor", "size": 2, "cost": 60, "premium": False},
    # Premium items 👑
    {"id": "pool", "name": "Swimming Pool", "emoji": "🏊", "category": "luxury", "size": 4, "cost": 2500, "premium": True},
    {"id": "jacuzzi", "name": "Jacuzzi", "emoji": "🛁", "category": "luxury", "size": 2, "cost": 1500, "premium": True},
    {"id": "piano", "name": "Grand Piano", "emoji": "🎹", "category": "luxury", "size": 3, "cost": 1800, "premium": True},
    {"id": "fireplace", "name": "Fireplace", "emoji": "🔥", "category": "luxury", "size": 2, "cost": 900, "premium": True},
    {"id": "aquarium", "name": "Aquarium", "emoji": "🐠", "category": "luxury", "size": 2, "cost": 1100, "premium": True},
    {"id": "billiard", "name": "Billiard Table", "emoji": "🎱", "category": "luxury", "size": 3, "cost": 1200, "premium": True},
    {"id": "bar", "name": "Home Bar", "emoji": "🍸", "category": "luxury", "size": 2, "cost": 1300, "premium": True},
    {"id": "gym_equipment", "name": "Home Gym", "emoji": "🏋️", "category": "luxury", "size": 3, "cost": 1700, "premium": True},
    {"id": "art", "name": "Modern Art", "emoji": "🖼️", "category": "luxury", "size": 1, "cost": 800, "premium": True},
    {"id": "robot", "name": "Robot Butler", "emoji": "🤖", "category": "luxury", "size": 1, "cost": 3000, "premium": True},
]

# ==================== BUILDING (USER-PLACED ITEMS) ====================
class BuildingItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "guest"
    location_id: str = "my_home"
    catalog_id: str
    emoji: str
    name: str
    x: float  # grid x (0-100)
    y: float  # grid y (0-100)
    placed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== AUTH ====================

def hash_password(password: str) -> str:
    """bcrypt when available, otherwise PBKDF2-SHA256 from the standard library."""
    if HAS_BCRYPT:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2${salt}${digest.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    if hashed.startswith("pbkdf2$"):
        _, salt, expected = hashed.split("$", 2)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
        return hmac.compare_digest(digest.hex(), expected)
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(password.encode(), hashed.encode())
        except ValueError:
            return False
    return False


def _b64(data: bytes) -> str:
    return urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return urlsafe_b64decode(data + padding)


def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    }
    if HAS_PYJWT:
        return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = _b64(
        hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    )
    return f"{header}.{body}.{signature}"


def decode_token(token: str) -> Optional[dict]:
    try:
        if HAS_PYJWT:
            return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        header, body, signature = token.split(".")
        expected = _b64(
            hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(expected, signature):
            return None
        payload = json.loads(_unb64(body))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return payload
    except Exception:
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
    """World summary. Backed by the real iteration state, not a decorative stub."""
    state = await load_game_state()
    world = await db.world_state.find_one()
    if not world:
        world = WorldState().model_dump()
        world["id"] = "main"
        await db.world_state.update_one({"id": "main"}, {"$set": world}, upsert=True)
        world = await db.world_state.find_one({"id": "main"})
    world = dict(world or {})
    world["online_users"] = await db.users.count_documents({})
    world["game_time"] = state.get("updated_at") or world.get("game_time")
    world["cycle"] = state.get("cycle", 1)
    world["max_cycles"] = state.get("max_cycles", arcadia_engine.MAX_CYCLES)
    world["chapter"] = state.get("chapter", 1)
    world["stability"] = state.get("stability", 100.0)
    world["lucidity"] = round(arcadia_engine.global_lucidity(state), 2)
    world["flux"] = state.get("flux", 0.0)
    world["is_paused"] = bool(state.get("paused", False))
    world["current_weather"] = state.get("weather", "clear")
    world["ending"] = state.get("ending")
    return serialize_doc(world)


@api_router.post("/world/pause")
async def toggle_pause(payload: Optional[dict] = Body(default=None)):
    """Pause/resume the live iteration.

    The flag lives on the game state itself, so the legacy world document and the
    game API can never disagree about whether the world is moving.
    """
    state = await load_game_state()
    current = bool(state.get("paused", False))
    requested = (payload or {}).get("paused")
    new_paused = (not current) if requested is None else bool(requested)
    state["paused"] = new_paused
    await save_game_state(state)
    await db.world_state.update_one(
        {"id": "main"}, {"$set": {"id": "main", "is_paused": new_paused}}, upsert=True
    )
    return {"is_paused": new_paused, "paused": new_paused}

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

# Characters: projections of the live iteration, so the roster can never drift
# out of sync with what the simulation is actually doing.
def _average(first: dict, second: dict, key: str) -> float:
    """Average one attribute across two parents (used for inherited stats)."""
    a = float((first.get("attributes") or {}).get(key, 50.0))
    b = float((second.get("attributes") or {}).get(key, 50.0))
    return round((a + b) / 2.0, 2)


def clamp01(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


async def load_game_state() -> dict:
    state = await db.game_state.find_one({"id": "main"})
    if state:
        state.pop("_id", None)
        return state
    locations = await db.locations.find().to_list(100)
    state = arcadia_engine.new_state(locations)
    await db.game_state.update_one({"id": "main"}, {"$set": state}, upsert=True)
    return state


async def save_game_state(state: dict) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.game_state.update_one({"id": "main"}, {"$set": state}, upsert=True)


@api_router.get("/characters")
async def get_characters():
    state = await load_game_state()
    return arcadia_legacy.project_characters(state)

@api_router.get("/characters/{character_id}")
async def get_character(character_id: str):
    state = await load_game_state()
    for resident in state.get("residents", []):
        if resident.get("id") == character_id:
            return arcadia_legacy.project_character(resident, state)
    raise HTTPException(status_code=404, detail="Character not found")

@api_router.post("/characters/create")
async def create_character(data: CharacterCreate, user: dict = Depends(get_current_user)):
    """Create a playable character that joins the live iteration.

    Guests are allowed so the sandbox is immediately playable; logged-in users
    get the character attached to their account.
    """
    user_id = user["id"] if user else f"guest_{uuid.uuid4().hex[:8]}"
    state = await load_game_state()

    payload = data.model_dump()
    payload["location_id"] = "my_home" if user else "paris_cafe"
    resident = arcadia_engine.make_custom_resident(payload, user_id=user_id)
    state.setdefault("residents", []).append(resident)

    entry = {
        "id": f"chr_new_{uuid.uuid4().hex[:6]}",
        "cycle": state.get("cycle", 1),
        "kind": "newcomer",
        "icon": "🌱",
        "text": arcadia_content.t(
            f"Une nouvelle vie s'installe à ARCADIA-9 : {resident['name']}.",
            f"A new life moves into ARCADIA-9: {resident['name']}.",
        ),
        "residents": [resident["id"]],
        "resident_name": resident["name"],
        "location_id": resident["location_id"],
    }
    state["chronicle"] = (state.get("chronicle") or []) + [entry]
    await save_game_state(state)

    if user:
        await db.users.update_one(
            {"id": user["id"]}, {"$push": {"characters": resident["id"]}}
        )

    return arcadia_legacy.project_character(resident, state)


@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str, user: dict = Depends(get_current_user)):
    state = await load_game_state()
    resident = next(
        (r for r in state.get("residents", []) if r.get("id") == character_id), None
    )
    if not resident:
        raise HTTPException(status_code=404, detail="Character not found")
    if not user or (resident.get("is_npc", True) and resident.get("user_id") != user["id"]):
        raise HTTPException(status_code=403, detail="Cannot delete")
    state["residents"] = [r for r in state["residents"] if r.get("id") != character_id]
    state["relationships"] = {
        key: value
        for key, value in (state.get("relationships") or {}).items()
        if character_id not in key.split("|")
    }
    await save_game_state(state)
    return {"message": "Deleted"}


@api_router.post("/characters/{character_id}/move")
async def move_character(character_id: str, location_id: str):
    state = await load_game_state()
    location = next(
        (loc for loc in await db.locations.find().to_list(200) if loc.get("id") == location_id),
        None,
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    resident = next(
        (r for r in state.get("residents", []) if r.get("id") == character_id), None
    )
    if not resident:
        raise HTTPException(status_code=404, detail="Character not found")

    resident["location_id"] = location_id
    resident["position"] = {
        "x": round(random.uniform(0.15, 0.85), 3),
        "y": round(random.uniform(0.25, 0.85), 3),
    }
    resident["current_action"] = {
        "id": "idle",
        "raw": "arrived",
        "label": arcadia_content.t(
            f"Arrivé·e à {location['name']}", f"Arrived at {location['name']}"
        ),
        "icon": "📍",
    }
    await save_game_state(state)
    return {"status": "success", "location": location_id}


@api_router.post("/characters/{character_id}/walk")
async def walk_character(character_id: str, target_x: float, target_y: float):
    state = await load_game_state()
    resident = next(
        (r for r in state.get("residents", []) if r.get("id") == character_id), None
    )
    if not resident:
        raise HTTPException(status_code=404, detail="Character not found")
    position = resident.get("position") or {"x": 0.5, "y": 0.5}
    position["x"] = round(max(0.05, min(0.95, target_x / 100.0)), 3)
    position["y"] = round(max(0.05, min(0.95, target_y / 100.0)), 3)
    resident["position"] = position
    await save_game_state(state)
    return {"status": "success"}


@api_router.post("/characters/{character_id}/have-baby")
async def have_baby(character_id: str, partner_id: str, baby_name: str, baby_gender: str = "male", user: dict = Depends(get_current_user)):
    """Two residents become parents; the child is a real resident of the world."""
    user_id = user["id"] if user else f"guest_{uuid.uuid4().hex[:8]}"
    state = await load_game_state()
    residents = state.get("residents", [])
    parent1 = next((r for r in residents if r.get("id") == character_id), None)
    parent2 = next((r for r in residents if r.get("id") == partner_id), None)
    if not parent1 or not parent2:
        raise HTTPException(status_code=404, detail="Character not found")
    if parent1["id"] == parent2["id"]:
        raise HTTPException(status_code=400, detail="Two different parents are required")

    first_look = parent1.get("look") or {}
    second_look = parent2.get("look") or {}
    baby = arcadia_engine.make_custom_resident(
        {
            "name": baby_name,
            "age": 0,
            "gender": baby_gender,
            "occupation": "child",
            "bio": f"Child of {parent1['name']} and {parent2['name']}",
            "skin_color": random.choice([first_look.get("skin"), second_look.get("skin")]),
            "hair_color": random.choice([first_look.get("hair"), second_look.get("hair")]),
            "height": 50,
            "location_id": parent1.get("location_id") or "my_home",
            "intelligence": _average(parent1, parent2, "intelligence"),
            "strength": _average(parent1, parent2, "strength"),
            "charisma": _average(parent1, parent2, "charisma"),
            "beauty": clamp01(_average(parent1, parent2, "beauty") + random.uniform(-10, 10)),
            "objectives": ["have_family", "stay_healthy"],
            "hobbies": [],
        },
        user_id=user_id,
    )
    baby["family"] = [character_id, partner_id]
    baby["partner_id"] = None
    baby["avatar_emoji"] = "👶"
    residents.append(baby)
    parent1.setdefault("children", []).append(baby["id"])
    parent2.setdefault("children", []).append(baby["id"])
    await save_game_state(state)
    return arcadia_legacy.project_character(baby, state)

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

# Logs: the chronicle of the iteration, in the historical response shape.
@api_router.get("/logs")
async def get_logs(limit: int = 50):
    limit = max(1, min(200, int(limit)))
    state = await load_game_state()
    return arcadia_legacy.project_logs(state, limit=limit)

# Simulation - FREE AI
@api_router.post("/simulate")
async def simulate_tick():
    """Advance the world one cycle.

    Historically this endpoint had its own bespoke logic. It now drives the same
    engine as ``POST /api/game/cycle`` so the two can never disagree, and the
    response keeps its original shape for existing clients.
    """
    state = await load_game_state()
    if state.get("paused"):
        return {"status": "paused", "message": "Iteration en pause."}

    locations = await db.locations.find().to_list(200)
    try:
        state, report = arcadia_engine.advance_cycle(state, locations)
    except arcadia_engine.GameRuleError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await save_game_state(state)
    return {
        "status": "success",
        "results": arcadia_legacy.report_to_legacy_results(report),
        "cycle": report.get("cycle"),
        "world": report.get("world"),
    }


# Reset
@api_router.post("/reset")
async def reset_game():
    """Start a brand-new iteration, keeping the location catalogue intact."""
    await db.locations.delete_many({})
    await db.chat_messages.delete_many({})
    await db.action_logs.delete_many({})
    await db.world_state.delete_many({})

    for loc in DEFAULT_LOCATIONS:
        await db.locations.insert_one(loc.model_dump())

    locations = [loc.model_dump() for loc in DEFAULT_LOCATIONS]
    state = arcadia_engine.new_state(locations)
    await db.game_state.delete_many({})
    await db.game_state.update_one({"id": "main"}, {"$set": state}, upsert=True)
    await db.world_state.update_one(
        {"id": "main"}, {"$set": {"id": "main", "is_paused": False}}, upsert=True
    )
    return {"status": "success", "message": "Game reset!", "cycle": state["cycle"]}

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

# ==================== BUILD MODE ====================
@api_router.get("/build/catalog")
async def get_build_catalog():
    """List all objects that can be placed in build mode."""
    return BUILD_CATALOG

@api_router.get("/build/items")
async def get_user_buildings(user: dict = Depends(get_current_user), location_id: str = "my_home"):
    """List items the user has placed in a given location."""
    user_id = user["id"] if user else "guest"
    items = await db.buildings.find({"user_id": user_id, "location_id": location_id}).to_list(500)
    return serialize_doc(items)

@api_router.post("/build/place")
async def place_building_item(payload: Dict, user: dict = Depends(get_current_user)):
    """Place an item from the catalog onto the user's grid."""
    catalog_id = payload.get("catalog_id")
    x = float(payload.get("x") or 50)
    y = float(payload.get("y") or 50)
    location_id = payload.get("location_id") or "my_home"
    
    catalog_item = next((c for c in BUILD_CATALOG if c["id"] == catalog_id), None)
    if not catalog_item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    
    # Premium gating
    if catalog_item["premium"] and (not user or not user.get("is_premium")):
        raise HTTPException(status_code=402, detail=f"'{catalog_item['name']}' is a Premium item. Upgrade to unlock.")
    
    user_id = user["id"] if user else "guest"
    item = BuildingItem(
        user_id=user_id,
        location_id=location_id,
        catalog_id=catalog_id,
        emoji=catalog_item["emoji"],
        name=catalog_item["name"],
        x=max(5, min(95, x)),
        y=max(5, min(95, y)),
    )
    await db.buildings.insert_one(item.model_dump())
    return serialize_doc(item.model_dump())

@api_router.delete("/build/items/{item_id}")
async def remove_building_item(item_id: str, user: dict = Depends(get_current_user)):
    user_id = user["id"] if user else "guest"
    result = await db.buildings.delete_one({"id": item_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "deleted"}

@api_router.post("/build/clear")
async def clear_user_buildings(user: dict = Depends(get_current_user), location_id: str = "my_home"):
    user_id = user["id"] if user else "guest"
    result = await db.buildings.delete_many({"user_id": user_id, "location_id": location_id})
    return {"status": "cleared", "removed": result.deleted_count}

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
app.include_router(arcadia_api.create_game_router(db, lambda: DEFAULT_LOCATIONS))
app.include_router(arcadia_api.create_support_router())
# CORS: the browser build of the client is served from a different origin
# (Expo web on :8081) than the API (:8000). Authentication uses a Bearer token,
# not cookies, so credentials can stay off -- which also keeps `Allow-Origin: *`
# spec-legal and prevents the browser from rejecting the response.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _seed_locations():
    """Upsert all DEFAULT_LOCATIONS so existing saves pick up new countries."""
    try:
        with_batch = db.batch() if isinstance(db, arcadia_store.JsonStore) else None
        if with_batch is None:
            for loc in DEFAULT_LOCATIONS:
                await db.locations.update_one(
                    {"id": loc.id}, {"$set": loc.model_dump()}, upsert=True
                )
        else:
            # One atomic write for the whole seed instead of one per location.
            async with with_batch:
                for loc in DEFAULT_LOCATIONS:
                    await db.locations.update_one(
                        {"id": loc.id}, {"$set": loc.model_dump()}, upsert=True
                    )
        count = await db.locations.count_documents({})
        logger.info("[startup] Locations seeded/upserted. Total: %s", count)
    except Exception as e:
        logger.error("[startup] Failed to seed locations: %s", e)
