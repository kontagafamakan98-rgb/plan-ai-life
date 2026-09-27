"""Original identity and content for ARCADIA-9.

Provenance / originality note
-----------------------------
The repository owner cited the WEBTOON *"My Virtual God is a Teenage Girl"* as a
high-level mood reference. Only the broad, unprotectable premise was reused as
inspiration: "a simulated world watched from above by an operator, whose
inhabitants may begin to suspect the nature of their reality".

Every element here -- world name, premise, residents, goals, dilemmas, events and
all text -- was written from scratch for this project. No characters, names,
dialogue, artwork or assets from that work (or any other) are copied or adapted.

Text is emitted in both French and English so the client never has to keep a
second copy of the narrative dictionary.
"""

from __future__ import annotations

from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

BRAND = {
    "slug": "arcadia-9",
    "name": "ARCADIA-9",
    "tagline": {
        "fr": "Le monde est un programme. Vous en êtes le Veilleur.",
        "en": "The world is a program. You are its Watcher.",
    },
    "premise": {
        "fr": (
            "ARCADIA-9 est la neuvième itération d'une cité simulée. Le Veilleur "
            "précédent a disparu sans laisser de rapport. Six habitants y vivent "
            "leur vie, convaincus qu'elle est réelle. Vous disposez de Flux pour "
            "intervenir, mais chaque geste laisse une trace : plus vous aidez, "
            "plus ils doutent."
        ),
        "en": (
            "ARCADIA-9 is the ninth iteration of a simulated city. Its previous "
            "Watcher vanished without leaving a report. Six residents live their "
            "lives here, certain it is real. You have Flux to intervene, but "
            "every gesture leaves a trace: the more you help, the more they doubt."
        ),
    },
    "role": {"fr": "Veilleur", "en": "Watcher"},
    "license_note": {
        "fr": "Œuvre originale. Inspiration de haut niveau uniquement.",
        "en": "Original work. High-level inspiration only.",
    },
}


def t(fr: str, en: str) -> Dict[str, str]:
    return {"fr": fr, "en": en}


# ---------------------------------------------------------------------------
# Action lexicon
# ---------------------------------------------------------------------------
# Locations expose snake_case action ids (kept from the original project so no
# fun content was lost). Each id is matched, in declaration order, against the
# keyword lists below and resolved to a canonical *family*. Families carry the
# gameplay meaning: needs moved, goal tags credited, and display labels.

ACTION_FAMILIES: List[Dict[str, Any]] = [
    {
        "id": "toilet",
        "keywords": ["toilet", "bathroom", "bladder"],
        "label": t("Passer aux toilettes", "Use the bathroom"),
        "icon": "🚽",
        "needs": {"bladder": 65, "comfort": 10, "hygiene": 5},
        "tags": ["routine"],
    },
    {
        "id": "sleep",
        "keywords": ["sleep", "nap", "futon"],
        "label": t("Dormir", "Sleep"),
        "icon": "💤",
        "needs": {"energy": 42, "comfort": 18, "bladder": -8},
        "tags": ["rest", "health"],
    },
    {
        "id": "shower",
        "keywords": ["shower", "sauna", "spa"],
        "label": t("Se laver", "Take a shower"),
        "icon": "🚿",
        "needs": {"hygiene": 55, "comfort": 20, "energy": 5},
        "tags": ["hygiene", "health"],
    },
    {
        "id": "cook",
        "keywords": ["cook_meal", "cook", "kitchen", "fondue"],
        "label": t("Cuisiner", "Cook a meal"),
        "icon": "🍳",
        "needs": {"hunger": 38, "fun": 12, "comfort": 8},
        "tags": ["food", "creative", "family"],
    },
    {
        "id": "eat",
        "keywords": [
            "eat", "croissant", "dinner", "lunch", "breakfast", "pastel",
            "baklava", "pad_thai", "street_food", "popcorn", "luxury_dining",
            "food",
        ],
        "label": t("Manger", "Eat"),
        "icon": "🍜",
        "needs": {"hunger": 40, "fun": 8},
        "tags": ["food"],
    },
    {
        "id": "drink",
        "keywords": ["coffee", "espresso", "chai", "coconut", "wine", "drink", "tea", "malbec", "spices"],
        "label": t("Boire un verre", "Have a drink"),
        "icon": "☕",
        "needs": {"hunger": 8, "energy": 14, "fun": 8, "bladder": -12},
        "tags": ["food", "social"],
    },
    {
        "id": "work",
        "keywords": [
            "work", "meeting", "laptop", "brainstorm", "desk", "elevator",
            "skyline_view", "guided_tour", "operation",
        ],
        "label": t("Travailler", "Work"),
        "icon": "🖥️",
        "needs": {"energy": -18, "hunger": -12, "fun": -6, "comfort": 6},
        "tags": ["career", "money", "fame"],
        "money": 26,
    },
    {
        "id": "network",
        "keywords": ["network", "applaud", "celebrate", "intermission"],
        "label": t("Créer des contacts", "Build a network"),
        "icon": "🤝",
        "needs": {"social": 24, "fun": 12, "energy": -8},
        "tags": ["social", "career", "money", "fame"],
        "money": 14,
    },
    {
        "id": "study",
        "keywords": [
            "study", "read", "newspaper", "homework", "class", "library",
            "history", "philosophize", "poetry", "architecture", "training",
        ],
        "label": t("Étudier", "Study"),
        "icon": "📚",
        "needs": {"energy": -10, "fun": 4, "comfort": 6},
        "tags": ["study", "culture", "career"],
    },
    {
        "id": "create",
        "keywords": [
            "photo", "photograph", "art", "paint", "music", "creative",
            "garden", "vr_experience", "build_sandcastle", "opera", "ballet",
            "live_music", "film",
        ],
        "label": t("Créer", "Create"),
        "icon": "🎨",
        "needs": {"fun": 22, "comfort": 10, "energy": -8},
        "tags": ["creative", "culture", "fame"],
    },
    {
        "id": "game",
        "keywords": ["game", "play_games", "console", "frisbee", "skating", "ice_skate"],
        "label": t("Jouer", "Play"),
        "icon": "🎮",
        "needs": {"fun": 32, "comfort": 8, "energy": -6},
        "tags": ["fun", "sport"],
    },
    {
        "id": "perform",
        "keywords": ["applaud", "opera", "ballet", "tango", "samba", "dance", "sing", "concert", "dj"],
        "label": t("Monter sur scène", "Perform"),
        "icon": "🎭",
        "needs": {"fun": 34, "social": 22, "energy": -20},
        "tags": ["creative", "fame", "social"],
    },
    {
        "id": "flirt",
        "keywords": ["flirt", "first_date", "romantic", "romance", "date"],
        "label": t("Se rapprocher de quelqu'un", "Get closer to someone"),
        "icon": "💗",
        "needs": {"social": 30, "fun": 26, "energy": -6},
        "tags": ["romance", "social"],
    },
    {
        "id": "chat",
        "keywords": ["chat", "socialize", "people_watch", "meet", "friends", "talk", "confession", "feed_swans", "feed_ducks"],
        "label": t("Discuter", "Chat"),
        "icon": "💬",
        "needs": {"social": 28, "fun": 12, "comfort": 6},
        "tags": ["social"],
    },
    {
        "id": "party",
        "keywords": ["party", "club", "hookah", "host_party"],
        "label": t("Faire la fête", "Party"),
        "icon": "🪩",
        "needs": {"fun": 38, "social": 28, "energy": -24, "hygiene": -10},
        "tags": ["social", "fun"],
    },
    {
        "id": "exercise",
        "keywords": ["lift", "cardio", "boxing", "gym", "exercise", "sports", "volleyball", "climb", "yak_ride"],
        "label": t("S'entraîner", "Train"),
        "icon": "🏋️",
        "needs": {"energy": -22, "fun": 14, "hygiene": -16, "comfort": -6},
        "tags": ["sport", "health", "fame"],
    },
    {
        "id": "jog",
        "keywords": ["jog", "cycle", "rollerblade", "cardio_run"],
        "label": t("Courir", "Go for a run"),
        "icon": "🏃",
        "needs": {"energy": -24, "fun": 16, "hygiene": -20},
        "tags": ["sport", "health"],
    },
    {
        "id": "walk",
        "keywords": ["walk", "garden_walk", "explore", "tour", "cable_car", "elevator"],
        "label": t("Flâner", "Wander"),
        "icon": "🚶",
        "needs": {"comfort": 18, "fun": 12, "energy": -6},
        "tags": ["calm", "culture"],
    },
    {
        "id": "calm",
        "keywords": ["relax", "rest", "observe", "meditate", "reflect", "pray", "candle", "ceremony", "stargaze", "sunbathe", "sauna"],
        "label": t("Se poser", "Slow down"),
        "icon": "🌿",
        "needs": {"comfort": 26, "energy": 14, "fun": 8},
        "tags": ["calm", "health", "culture"],
    },
    {
        "id": "swim",
        "keywords": ["swim", "surf", "scuba", "sail"],
        "label": t("Nager", "Swim"),
        "icon": "🏊",
        "needs": {"fun": 26, "hygiene": 14, "energy": -18},
        "tags": ["sport", "health", "fun"],
    },
    {
        "id": "hike",
        "keywords": ["hike", "ski", "snowboard", "spot_wildlife", "spot_moose", "mountain"],
        "label": t("Randonner", "Hike"),
        "icon": "🥾",
        "needs": {"energy": -26, "fun": 24, "comfort": -10},
        "tags": ["sport", "health", "calm", "travel"],
    },
    {
        "id": "travel",
        "keywords": ["travel", "picnic", "fountain", "yak", "bazaar", "market", "tour_architecture"],
        "label": t("Explorer", "Explore"),
        "icon": "🧭",
        "needs": {"fun": 22, "social": 10, "energy": -12},
        "tags": ["travel", "culture", "calm"],
    },
    {
        "id": "shop",
        "keywords": ["shop", "bargain", "haggle", "buy", "rugs", "silk", "mall"],
        "label": t("Faire du shopping", "Go shopping"),
        "icon": "🛍️",
        "needs": {"fun": 20, "comfort": 10},
        "tags": ["money", "fun"],
        "money": -18,
    },
    {
        "id": "care",
        "keywords": ["visit_patient", "checkup", "pharmacy", "hospital", "help", "maternity"],
        "label": t("Prendre soin", "Care for others"),
        "icon": "🩺",
        "needs": {"energy": -10, "social": 18, "comfort": 6},
        "tags": ["care", "health", "social"],
    },
    {
        "id": "family",
        "keywords": ["have_baby", "baby", "child", "home"],
        "label": t("Vie de famille", "Family life"),
        "icon": "🏡",
        "needs": {"comfort": 22, "social": 20, "fun": 10, "energy": -8},
        "tags": ["family", "romance"],
    },
    {
        "id": "watch",
        "keywords": ["watch", "tv", "movie", "cinema", "screen"],
        "label": t("Regarder", "Watch something"),
        "icon": "📺",
        "needs": {"fun": 22, "energy": 6, "comfort": 10},
        "tags": ["fun", "culture"],
    },
    {
        "id": "stream",
        "keywords": ["stream", "esport", "tournament", "match"],
        "label": t("Diffuser en direct", "Stream"),
        "icon": "🎙️",
        "needs": {"fun": 26, "social": 18, "energy": -14},
        "tags": ["fame", "sport", "fun"],
        "money": 30,
    },
]

FALLBACK_FAMILY = {
    "id": "idle",
    "label": t("Souffler", "Take a breather"),
    "icon": "🌀",
    "needs": {"comfort": 8, "fun": 4},
    "tags": [],
}


def resolve_action(action_id: str) -> Dict[str, Any]:
    """Map a location action id onto a gameplay family (deterministic order)."""
    needle = (action_id or "").lower()
    best: Dict[str, Any] = FALLBACK_FAMILY
    best_len = 0
    for family in ACTION_FAMILIES:
        for keyword in family["keywords"]:
            if keyword in needle and len(keyword) > best_len:
                best = family
                best_len = len(keyword)
    return best


# ---------------------------------------------------------------------------
# Life goals (ids reused from the original project, now fully specified)
# ---------------------------------------------------------------------------

GOALS: Dict[str, Dict[str, Any]] = {
    "become_rich": {
        "label": t("Devenir riche", "Become wealthy"),
        "tags": ["money", "career", "fame"],
        "milestones": [
            t("Premier vrai salaire", "First real paycheck"),
            t("Un matelas de sécurité", "A safety cushion"),
            t("Indépendance financière", "Financial independence"),
        ],
    },
    "find_love": {
        "label": t("Trouver l'amour", "Find love"),
        "tags": ["romance", "social"],
        "milestones": [
            t("Une rencontre", "A first spark"),
            t("Première confidence", "A first confession"),
            t("Une relation stable", "A steady bond"),
        ],
    },
    "have_family": {
        "label": t("Fonder une famille", "Start a family"),
        "tags": ["family", "romance", "social"],
        "milestones": [
            t("Un foyer chaleureux", "A warm home"),
            t("Le projet d'un enfant", "Talking about a child"),
            t("Une famille", "A family"),
        ],
    },
    "become_famous": {
        "label": t("Devenir connu", "Become known"),
        "tags": ["fame", "creative", "social"],
        "milestones": [
            t("Un public fidèle", "A small following"),
            t("Un moment marquant", "A defining moment"),
            t("Reconnu par ses pairs", "Recognised by peers"),
        ],
    },
    "travel_world": {
        "label": t("Voyager", "See the world"),
        "tags": ["travel", "culture"],
        "milestones": [
            t("Premier départ", "First departure"),
            t("Trois pays", "Three countries"),
            t("Tour du monde", "Around the world"),
        ],
    },
    "master_career": {
        "label": t("Réussir sa carrière", "Master a career"),
        "tags": ["career", "money"],
        "milestones": [
            t("Respecté au travail", "Respected at work"),
            t("Prise de responsabilité", "Trusted with more"),
            t("Référence dans son domaine", "A reference in the field"),
        ],
    },
    "stay_healthy": {
        "label": t("Rester en bonne santé", "Stay healthy"),
        "tags": ["health", "sport", "rest", "hygiene"],
        "milestones": [
            t("Une routine tenue", "A routine that holds"),
            t("Corps plus solide", "A stronger body"),
            t("Équilibre durable", "Lasting balance"),
        ],
    },
    "help_others": {
        "label": t("Aider les autres", "Help others"),
        "tags": ["care", "social"],
        "milestones": [
            t("Premier geste gratuit", "A first selfless act"),
            t("Une communauté autour", "A community gathers"),
            t("Une œuvre utile", "Something that lasts"),
        ],
    },
    "learn_everything": {
        "label": t("Tout apprendre", "Learn everything"),
        "tags": ["study", "culture"],
        "milestones": [
            t("Une obsession choisie", "A chosen obsession"),
            t("Savoir transmissible", "Knowledge worth sharing"),
            t("Une œuvre savante", "A work of scholarship"),
        ],
    },
    "live_simply": {
        "label": t("Vivre simplement", "Live simply"),
        "tags": ["calm", "health", "culture"],
        "milestones": [
            t("Tri dans sa vie", "Decluttering a life"),
            t("Rythme apaisé", "A gentler pace"),
            t("Paix intérieure", "Inner peace"),
        ],
    },
    "become_artist": {
        "label": t("Créer une œuvre", "Make a work of art"),
        "tags": ["creative", "culture", "fame"],
        "milestones": [
            t("Première pièce finie", "First finished piece"),
            t("Un style à soi", "A voice of one's own"),
            t("Œuvre présentée", "Work presented"),
        ],
    },
    "become_athlete": {
        "label": t("Viser le sommet sportif", "Reach the top in sport"),
        "tags": ["sport", "health", "fame"],
        "milestones": [
            t("Discipline installée", "Discipline installed"),
            t("Première compétition", "First competition"),
            t("Podium", "On the podium"),
        ],
    },
}


# ---------------------------------------------------------------------------
# Residents (all original)
# ---------------------------------------------------------------------------

RESIDENTS: List[Dict[str, Any]] = [
    {
        "id": "res_aya",
        "name": "Aya Sow",
        "age": 24,
        "gender": "female",
        "occupation": t("Relieuse de livres anciens", "Antiquarian bookbinder"),
        "home": "lisbon_cafe",
        "city": "Lisbonne",
        "bio": t(
            "Restaure des livres que plus personne ne sait lire. Parle peu, "
            "corrige beaucoup, s'attache d'un coup.",
            "Restores books nobody can read any more. Says little, notices "
            "everything, attaches suddenly and completely.",
        ),
        "quote": t("Un livre abîmé, ça reste un livre.", "A damaged book is still a book."),
        "look": {
            "skin": "#8A5A3B",
            "hair": "#1C1410",
            "hairstyle": "braids",
            "eyes": "#3E2A1E",
            "outfit": {"top": "#C9A227", "bottom": "#3C3B58", "accent": "#E8D7A8"},
            "accessory": "satchel",
        },
        "attributes": {"intelligence": 82, "strength": 34, "charisma": 52, "beauty": 71, "creativity": 88, "luck": 44},
        "personality": {"extroversion": 28, "kindness": 78, "humor": 42, "ambition": 74, "curiosity": 91},
        "goals": ["learn_everything", "find_love"],
        "hobbies": ["reading", "writing", "art"],
        "needs": {"hunger": 88, "energy": 82, "social": 46, "hygiene": 90, "fun": 62, "bladder": 92, "comfort": 76},
        "lucidity": 12,
    },
    {
        "id": "res_tobias",
        "name": "Tobias Lenz",
        "age": 31,
        "gender": "male",
        "occupation": t("Ingénieur du son", "Sound engineer"),
        "home": "berlin_club",
        "city": "Berlin",
        "bio": t(
            "Passe ses nuits à traquer une fréquence parfaite. Ironique, "
            "nocturne, incapable de dire merci.",
            "Spends his nights hunting a perfect frequency. Wry, nocturnal, "
            "structurally incapable of saying thank you.",
        ),
        "quote": t("Le silence, c'est juste du bruit mal placé.", "Silence is just misplaced noise."),
        "look": {
            "skin": "#E9C6A8",
            "hair": "#5B3A1E",
            "hairstyle": "undercut",
            "eyes": "#4C6B8A",
            "outfit": {"top": "#2E2E38", "bottom": "#1F1F26", "accent": "#FF6B57"},
            "accessory": "headphones",
        },
        "attributes": {"intelligence": 76, "strength": 48, "charisma": 61, "beauty": 63, "creativity": 84, "luck": 52},
        "personality": {"extroversion": 46, "kindness": 55, "humor": 72, "ambition": 88, "curiosity": 70},
        "goals": ["become_artist", "become_rich"],
        "hobbies": ["music", "coding", "movies"],
        "needs": {"hunger": 74, "energy": 58, "social": 66, "hygiene": 80, "fun": 70, "bladder": 88, "comfort": 64},
        "lucidity": 24,
    },
    {
        "id": "res_priya",
        "name": "Priya Raman",
        "age": 27,
        "gender": "female",
        "occupation": t("Médecin urgentiste", "Emergency physician"),
        "home": "mumbai_market",
        "city": "Mumbai",
        "bio": t(
            "Enchaîne les gardes sans compter. Dit que ça va, et le pense "
            "sincèrement, ce qui inquiète tout le monde.",
            "Chains night shifts without counting. Says she's fine, and means "
            "it, which is exactly what worries everyone.",
        ),
        "quote": t("On verra après. On voit toujours après.", "We'll deal with it later. We always do."),
        "look": {
            "skin": "#9C6134",
            "hair": "#221510",
            "hairstyle": "bun",
            "eyes": "#2E1B12",
            "outfit": {"top": "#E8F1F5", "bottom": "#2C4A6E", "accent": "#3FA9A0"},
            "accessory": "stethoscope",
        },
        "attributes": {"intelligence": 88, "strength": 58, "charisma": 68, "beauty": 72, "creativity": 51, "luck": 49},
        "personality": {"extroversion": 62, "kindness": 94, "humor": 58, "ambition": 79, "curiosity": 76},
        "goals": ["help_others", "stay_healthy"],
        "hobbies": ["yoga", "reading", "socializing"],
        "needs": {"hunger": 61, "energy": 44, "social": 72, "hygiene": 84, "fun": 41, "bladder": 90, "comfort": 55},
        "lucidity": 16,
    },
    {
        "id": "res_elias",
        "name": "Elias Moreau",
        "age": 34,
        "gender": "male",
        "occupation": t("Chef cuisinier", "Head chef"),
        "home": "paris_cafe",
        "city": "Paris",
        "bio": t(
            "Se bat pour une étoile qu'il n'aura peut-être jamais. Chaleureux "
            "avec les autres, impitoyable avec lui-même.",
            "Fights for a star he may never get. Warm with everyone else, "
            "merciless with himself.",
        ),
        "quote": t("Un bon plat, ça se termine en silence.", "A good dish ends in silence."),
        "look": {
            "skin": "#F0D3B4",
            "hair": "#8A5A2B",
            "hairstyle": "curls",
            "eyes": "#5B6B3A",
            "outfit": {"top": "#F5F1E8", "bottom": "#33343D", "accent": "#B8452F"},
            "accessory": "apron",
        },
        "attributes": {"intelligence": 69, "strength": 66, "charisma": 74, "beauty": 66, "creativity": 79, "luck": 57},
        "personality": {"extroversion": 71, "kindness": 73, "humor": 64, "ambition": 92, "curiosity": 62},
        "goals": ["master_career", "have_family"],
        "hobbies": ["cooking", "music", "socializing"],
        "needs": {"hunger": 70, "energy": 52, "social": 78, "hygiene": 86, "fun": 58, "bladder": 86, "comfort": 68},
        "lucidity": 9,
    },
    {
        "id": "res_mika",
        "name": "Mika Ono",
        "age": 22,
        "gender": "female",
        "occupation": t("Joueuse esport", "Esports player"),
        "home": "seoul_cinema",
        "city": "Séoul",
        "bio": t(
            "Vit à 240 images par seconde. Impulsive, loyale, incapable de "
            "rester assise plus de dix minutes.",
            "Lives at 240 frames per second. Impulsive, loyal, unable to sit "
            "still for ten minutes straight.",
        ),
        "quote": t("Si je respire, je perds la manche.", "If I breathe, I drop the round."),
        "look": {
            "skin": "#F2D2B6",
            "hair": "#2B2F4A",
            "hairstyle": "ponytail",
            "eyes": "#7A3F5B",
            "outfit": {"top": "#4FC3F7", "bottom": "#1B2233", "accent": "#FFD54F"},
            "accessory": "visor",
        },
        "attributes": {"intelligence": 71, "strength": 43, "charisma": 77, "beauty": 74, "creativity": 66, "luck": 68},
        "personality": {"extroversion": 84, "kindness": 64, "humor": 81, "ambition": 86, "curiosity": 55},
        "goals": ["become_famous", "become_rich"],
        "hobbies": ["gaming", "music", "dancing"],
        "needs": {"hunger": 66, "energy": 71, "social": 82, "hygiene": 78, "fun": 84, "bladder": 84, "comfort": 60},
        "lucidity": 31,
    },
    {
        "id": "res_simon",
        "name": "Simón Ortega",
        "age": 40,
        "gender": "male",
        "occupation": t("Professeur de tango", "Tango teacher"),
        "home": "buenos_aires_club",
        "city": "Buenos Aires",
        "bio": t(
            "A dansé sur les plus grandes scènes, puis a tout arrêté pour "
            "enseigner dans une salle sans climatisation. Ne regrette rien.",
            "Danced on the biggest stages, then quit it all to teach in a room "
            "without air conditioning. Regrets nothing.",
        ),
        "quote": t("On danse pour se souvenir, pas pour gagner.", "We dance to remember, not to win."),
        "look": {
            "skin": "#C98C5E",
            "hair": "#6E6E6E",
            "hairstyle": "swept",
            "eyes": "#3B2B20",
            "outfit": {"top": "#2F3A4A", "bottom": "#232A34", "accent": "#C0556B"},
            "accessory": "scarf",
        },
        "attributes": {"intelligence": 64, "strength": 61, "charisma": 86, "beauty": 70, "creativity": 75, "luck": 47},
        "personality": {"extroversion": 68, "kindness": 82, "humor": 69, "ambition": 41, "curiosity": 66},
        "goals": ["find_love", "live_simply"],
        "hobbies": ["dancing", "music", "movies"],
        "needs": {"hunger": 82, "energy": 74, "social": 88, "hygiene": 88, "fun": 76, "bladder": 90, "comfort": 80},
        "lucidity": 6,
    },
]

# The story hook: a remnant of iteration 8 that occasionally bleeds through.
ANOMALY = {
    "id": "res_residu",
    "name": "RÉSIDU-08",
    "label": t("Anomalie détectée", "Anomaly detected"),
    "description": t(
        "Un fragment de l'itération précédente. Il n'a pas de vie propre, mais "
        "il sait ce que vous êtes. Il apparaît quand la Stabilité chute.",
        "A fragment of the previous iteration. It has no life of its own, but it "
        "knows what you are. It surfaces when Stability drops.",
    ),
}


# ---------------------------------------------------------------------------
# Interventions: the player's verbs
# ---------------------------------------------------------------------------

INTERVENTIONS: List[Dict[str, Any]] = [
    {
        "id": "lumiere",
        "label": t("Un peu de lumière", "A little light"),
        "description": t(
            "Éclaircit les pensées d'un habitant : il prend une meilleure décision ce cycle.",
            "Clears a resident's head: they make a better decision this cycle.",
        ),
        "icon": "✨",
        "cost": 2,
        "target": "resident",
        "chapter_min": 1,
        "effects": {"attributes.intelligence": 8, "needs.energy": 10},
        "lucidity": 3,
    },
    {
        "id": "elan",
        "label": t("Élan", "Updraft"),
        "description": t(
            "Rend le corps plus léger : les besoins physiques se dégradent moins vite.",
            "Makes the body lighter: physical needs decay more slowly.",
        ),
        "icon": "🌬️",
        "cost": 2,
        "target": "resident",
        "chapter_min": 1,
        "effects": {"needs.hunger": 18, "needs.comfort": 18, "attributes.strength": 6},
        "lucidity": 3,
    },
    {
        "id": "cafe",
        "label": t("Café improbable", "Improbable coffee"),
        "description": t(
            "Aucune explication fournie, mais l'énergie revient d'un coup.",
            "No explanation offered, but the energy comes right back.",
        ),
        "icon": "☕",
        "cost": 1,
        "target": "resident",
        "chapter_min": 1,
        "effects": {"needs.energy": 34, "needs.hunger": 10},
        "lucidity": 5,
    },
    {
        "id": "faveur",
        "label": t("Coup de pouce", "Nudge"),
        "description": t(
            "Un objectif avance comme par hasard. Efficace, et très visible.",
            "A goal advances, apparently by chance. Effective, and very visible.",
        ),
        "icon": "🎯",
        "cost": 4,
        "target": "resident",
        "chapter_min": 1,
        "effects": {"goal_boost": 14},
        "lucidity": 12,
    },
    {
        "id": "eclair",
        "label": t("Éclair de lucidité", "Flash of insight"),
        "description": t(
            "L'habitant comprend quelque chose qu'il ignorait. Sa lucidité monte fort.",
            "The resident understands something they didn't. Their lucidity climbs hard.",
        ),
        "icon": "⚡",
        "cost": 3,
        "target": "resident",
        "chapter_min": 2,
        "effects": {"attributes.intelligence": 16, "goal_boost": 9},
        "lucidity": 18,
    },
    {
        "id": "rencontre",
        "label": t("Croiser un chemin", "Crossed paths"),
        "description": t(
            "Organise une rencontre : deux habitants se retrouvent au même endroit.",
            "Arranges an encounter: two residents end up in the same place.",
        ),
        "icon": "🔗",
        "cost": 3,
        "target": "pair",
        "chapter_min": 2,
        "effects": {"relationship": 12, "needs.social": 22},
        "lucidity": 6,
    },
    {
        "id": "meteo",
        "label": t("Retoucher la météo", "Retouch the weather"),
        "description": t(
            "Un ciel parfait pour tout le monde : ambiance et stabilité remontent.",
            "A perfect sky for everyone: mood and stability climb.",
        ),
        "icon": "🌤️",
        "cost": 3,
        "target": "world",
        "chapter_min": 1,
        "effects": {"stability": 9, "needs.fun": 8},
        "lucidity": 4,
    },
    {
        "id": "silence",
        "label": t("Silence radio", "Radio silence"),
        "description": t(
            "On efface prudemment les traces : la lucidité baisse, mais les habitants "
            "s'oublient un peu eux-mêmes.",
            "Traces are carefully erased: lucidity drops, but residents forget a "
            "little of themselves.",
        ),
        "icon": "🔇",
        "cost": 5,
        "target": "world",
        "chapter_min": 2,
        "effects": {"lucidity": -22, "needs.fun": -6, "needs.social": -6},
        "lucidity": -22,
    },
    {
        "id": "bug",
        "label": t("Fracture assumée", "Deliberate fracture"),
        "description": t(
            "Vous laissez volontairement une faille visible. Inconfortable, lucide, "
            "et c'est peut-être le seul chemin honnête.",
            "You deliberately leave a visible crack. Uncomfortable, lucid, and "
            "perhaps the only honest path.",
        ),
        "icon": "🕳️",
        "cost": 4,
        "target": "resident",
        "chapter_min": 3,
        "effects": {"goal_boost": 20, "stability": -8},
        "lucidity": 26,
    },
]


# ---------------------------------------------------------------------------
# Dilemmas: one decision per cycle, with visible trade-offs
# ---------------------------------------------------------------------------

DILEMMAS: List[Dict[str, Any]] = [
    {
        "id": "raphael_fragment",
        "chapter_min": 1,
        "prompt": t(
            "Un fragment du code de l'itération 8 répond à votre présence. Il propose "
            "un raccourci : accélérer la vie de quelqu'un, en échange d'un peu de flou.",
            "A fragment of iteration 8's code answers your presence. It offers a "
            "shortcut: speed someone's life up, in exchange for some blur.",
        ),
        "choices": [
            {
                "id": "accept",
                "label": t("Accepter le raccourci", "Take the shortcut"),
                "hint": t("+10 progression, +14 lucidité, −6 stabilité", "+10 progress, +14 lucidity, −6 stability"),
                "effects": {"goal_boost": 10, "lucidity": 14, "stability": -6},
            },
            {
                "id": "refuse",
                "label": t("Refuser, garder la main", "Refuse, keep control"),
                "hint": t("+6 stabilité, +2 flux", "+6 stability, +2 Flux"),
                "effects": {"stability": 6, "flux": 2},
            },
            {
                "id": "ask",
                "label": t("Demander qui l'a écrit", "Ask who wrote it"),
                "hint": t("Risqué : lucidité +8 sur tous, stabilité −3", "Risky: +8 lucidity on all, −3 stability"),
                "effects": {"lucidity_all": 8, "stability": -3},
            },
        ],
    },
    {
        "id": "pane",
        "chapter_min": 1,
        "prompt": t(
            "L'un des décors ne se charge plus : un mur reste blanc, sans texture. "
            "Les habitants passent devant en détournant le regard.",
            "One of the sets no longer loads: a wall stays blank, untextured. "
            "Residents walk past it looking away.",
        ),
        "choices": [
            {
                "id": "patch",
                "label": t("Recharger le décor", "Reload the scenery"),
                "hint": t("−3 flux, +8 stabilité", "−3 Flux, +8 stability"),
                "effects": {"flux": -3, "stability": 8},
            },
            {
                "id": "leave",
                "label": t("Laisser la faille", "Leave the crack"),
                "hint": t("−6 stabilité, +12 lucidité, +8 progression", "−6 stability, +12 lucidity, +8 progress"),
                "effects": {"stability": -6, "lucidity": 12, "goal_boost": 8},
            },
        ],
    },
    {
        "id": "aveu",
        "chapter_min": 2,
        "prompt": t(
            "Priya a noté deux fois la même minute dans son carnet. Elle relit la "
            "page. Vous pouvez encore retirer la ligne.",
            "Priya has written the same minute twice in her notebook. She rereads "
            "the page. You can still remove the line.",
        ),
        "choices": [
            {
                "id": "erase",
                "label": t("Effacer la ligne", "Erase the line"),
                "hint": t("−7 lucidité, −4 stabilité", "−7 lucidity, −4 stability"),
                "effects": {"lucidity": -7, "stability": -4},
            },
            {
                "id": "let_him_see",
                "label": t("La laisser lire", "Let her read it"),
                "hint": t("+16 lucidité, +12 progression, −5 stabilité", "+16 lucidity, +12 progress, −5 stability"),
                "effects": {"lucidity": 16, "goal_boost": 12, "stability": -5},
            },
        ],
    },
    {
        "id": "offre",
        "chapter_min": 2,
        "prompt": t(
            "Votre prédécesseur a laissé un outil non documenté. Il rend les habitants "
            "plus heureux, mais leur bonheur devient très uniforme.",
            "Your predecessor left an undocumented tool. It makes residents happier, "
            "but their happiness becomes very uniform.",
        ),
        "choices": [
            {
                "id": "use",
                "label": t("L'utiliser une fois", "Use it once"),
                "hint": t("Tous les besoins +22, lucidité −10, individualité en baisse", "All needs +22, lucidity −10, individuality drops"),
                "effects": {"needs_all": 22, "lucidity": -10, "stability": 5},
            },
            {
                "id": "lock",
                "label": t("Le sceller", "Seal it"),
                "hint": t("+4 flux, +4 stabilité", "+4 Flux, +4 stability"),
                "effects": {"flux": 4, "stability": 4},
            },
        ],
    },
    {
        "id": "porte",
        "chapter_min": 3,
        "prompt": t(
            "Mika décrit, sans se tromper, un lieu qui n'existe pas dans cette "
            "itération. Elle demande si vous l'avez déjà vu.",
            "Mika accurately describes a place that does not exist in this iteration. "
            "She asks whether you have seen it too.",
        ),
        "choices": [
            {
                "id": "deny",
                "label": t("Répondre non", "Answer no"),
                "hint": t("−14 lucidité, −6 stabilité", "−14 lucidity, −6 stability"),
                "effects": {"lucidity": -14, "stability": -6},
            },
            {
                "id": "admit",
                "label": t("Répondre oui", "Answer yes"),
                "hint": t("+24 lucidité, +18 progression, −10 stabilité", "+24 lucidity, +18 progress, −10 stability"),
                "effects": {"lucidity": 24, "goal_boost": 18, "stability": -10},
            },
            {
                "id": "redirect",
                "label": t("Changer de sujet", "Change the subject"),
                "hint": t("+3 flux, +4 stabilité", "+3 Flux, +4 stability"),
                "effects": {"flux": 3, "stability": 4},
            },
        ],
    },
    {
        "id": "rapport",
        "chapter_min": 3,
        "prompt": t(
            "Le rapport du Veilleur précédent s'ouvre enfin. Une seule ligne y est "
            "lisible : « ils n'ont pas besoin de nous, ils ont besoin de temps ».",
            "The previous Watcher's report finally opens. One line is legible: "
            "\u201cthey don't need us, they need time\u201d.",
        ),
        "choices": [
            {
                "id": "believe",
                "label": t("Le croire", "Believe it"),
                "hint": t("+10 stabilité, −8 lucidité, −4 flux", "+10 stability, −8 lucidity, −4 Flux"),
                "effects": {"stability": 10, "lucidity": -8, "flux": -4},
            },
            {
                "id": "doubt",
                "label": t("En douter", "Doubt it"),
                "hint": t("+8 progression sur tous les objectifs", "+8 progress on all goals"),
                "effects": {"goal_boost": 8, "lucidity": 6},
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# World events written into the chronicle
# ---------------------------------------------------------------------------

EVENTS: List[Dict[str, Any]] = [
    {
        "id": "defrag",
        "weight": 3,
        "min_stability": 55,
        "text": t(
            "Défragmentation nocturne : les rues se réorganisent sans témoin. Stabilité +6.",
            "Overnight defragmentation: the streets rearrange unwitnessed. Stability +6.",
        ),
        "effects": {"stability": 6},
    },
    {
        "id": "echo",
        "weight": 3,
        "min_stability": 0,
        "text": t(
            "Un écho traverse les murs. Pendant quelques secondes, deux habitants ont "
            "la même voix. Lucidité +6 pour tous.",
            "An echo runs through the walls. For a few seconds, two residents share "
            "one voice. Lucidity +6 on all.",
        ),
        "effects": {"lucidity_all": 6},
    },
    {
        "id": "pluie_juste",
        "weight": 2,
        "min_stability": 35,
        "text": t(
            "La pluie tombe exactement quand quelqu'un en avait besoin. Personne ne "
            "le remarque. Stabilité +4.",
            "Rain falls exactly when someone needed it. Nobody notices. Stability +4.",
        ),
        "effects": {"stability": 4},
    },
    {
        "id": "correction",
        "weight": 2,
        "min_stability": 0,
        "text": t(
            "Une correction automatique efface un souvenir collectif. Lucidité −5, "
            "Stabilité −3.",
            "An automatic correction erases a collective memory. Lucidity −5, "
            "Stability −3.",
        ),
        "effects": {"lucidity_all": -5, "stability": -3},
    },
    {
        "id": "marche",
        "weight": 2,
        "min_stability": 0,
        "text": t(
            "Six habitants changent de trottoir au même instant. Le cycle continue, "
            "mais quelque chose se resserre.",
            "Six residents step off the curb at the same instant. The cycle goes on, "
            "but something tightens.",
        ),
        "effects": {"lucidity_all": 3, "stability": -2},
    },
    {
        "id": "fenetre",
        "weight": 2,
        "min_stability": 60,
        "text": t(
            "Une fenêtre reste allumée toute la nuit chez Elias. Il invente une recette "
            "qu'il n'a jamais apprise. Progression amorcée.",
            "A window stays lit all night at Elias's. He invents a recipe he was never "
            "taught. Progress stirs.",
        ),
        "effects": {"goal_boost": 6},
    },
    {
        "id": "surcharge",
        "weight": 3,
        "max_stability": 32,
        "text": t(
            "Surcharge : les dialogues se répètent, les gestes se dupliquent. Stabilité −7.",
            "Overload: dialogue repeats, gestures duplicate. Stability −7.",
        ),
        "effects": {"stability": -7},
    },
]

ENDING_NOTE = t(
    "Fin d'itération. Le rapport est archivé ; la prochaine itération ne se souviendra "
    "que de vos statistiques.",
    "End of iteration. The report is archived; the next iteration will remember only "
    "your statistics.",
)

ENDINGS: Dict[str, Dict[str, Any]] = {
    "control": {
        "title": t("Sous contrôle", "Under control"),
        "body": t(
            "Ils ont vécu. Ils n'ont rien su. Vous avez tenu la ligne, et personne ne "
            "vous remerciera jamais : c'est le principe.",
            "They lived. They never knew. You held the line, and nobody will ever "
            "thank you: that is the arrangement.",
        ),
    },
    "awakening": {
        "title": t("Éveil", "Awakening"),
        "body": t(
            "Ils ont fini par voir les bords du monde. Deux d'entre eux ont ri, un a "
            "eu peur, et aucun n'a voulu redescendre. L'itération 9 sera la dernière "
            "— mais elle leur appartient.",
            "They finally saw the edges of the world. Two of them laughed, one was "
            "afraid, and none of them wanted to go back down. Iteration 9 will be "
            "the last one -- but it belongs to them.",
        ),
    },
    "drift": {
        "title": t("Dérive", "Drift"),
        "body": t(
            "La Stabilité a cédé. Les habitants se sont dissous dans la géométrie. Le "
            "système a relancé l'itération 10 avant même que vous puissiez lire le "
            "rapport d'erreur.",
            "Stability gave out. The residents dissolved into the geometry. The "
            "system restarted iteration 10 before you could even read the error log.",
        ),
    },
    "silence": {
        "title": t("Silence", "Silence"),
        "body": t(
            "Rien de cassé, rien d'accompli. Dix-huit cycles de vie ordinaire. "
            "C'est peut-être, au fond, ce qu'ils préféraient.",
            "Nothing broken, nothing finished. Eighteen cycles of ordinary life. "
            "Perhaps that is, in the end, what they preferred.",
        ),
    },
}


def goal_label(goal_id: str) -> Dict[str, str]:
    goal = GOALS.get(goal_id)
    if not goal:
        return t(goal_id, goal_id)
    return goal["label"]
