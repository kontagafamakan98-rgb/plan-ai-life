"""ARCADIA-9 simulation engine.

This is a pure, deterministic module: given a world state and the location
catalogue, it decides what each resident does and returns both the new state and
a human-readable cycle report. No I/O, no framework imports -- which is what
makes it cheap to unit-test exhaustively.

Determinism matters for two reasons: the player can reload a save and get the
same world back, and the test-suite can assert on real behaviour instead of
"something happened".
"""

from __future__ import annotations

import hashlib
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import content as C

# ---------------------------------------------------------------------------
# Tuning constants
# ---------------------------------------------------------------------------

MAX_CYCLES = 18
START_FLUX = 14
FLUX_PER_CYCLE = 5
FLUX_CAP = 34
START_STABILITY = 78.0
STABILITY_DRIFT = -1.1

NEED_DECAY = {
    "hunger": -15.0,
    "energy": -13.0,
    "social": -10.0,
    "hygiene": -7.0,
    "fun": -11.0,
    "bladder": -17.0,
    "comfort": -6.0,
}

NEED_KEYS = list(NEED_DECAY.keys())

LUCIDITY_DRIFT = 1.15
LUCIDITY_NOTICE = 1.6  # extra suspicion when life goes suspiciously well

MOODS: Dict[str, Dict[str, Any]] = {
    "radiant": {"label": C.t("Rayonnant", "Radiant"), "color": "#FFD166", "icon": "🌟"},
    "content": {"label": C.t("Serein", "Content"), "color": "#7BD389", "icon": "🙂"},
    "focused": {"label": C.t("Concentré", "Focused"), "color": "#5AB0F0", "icon": "🎯"},
    "neutral": {"label": C.t("Neutre", "Neutral"), "color": "#B6BEC9", "icon": "😐"},
    "tired": {"label": C.t("Fatigué", "Tired"), "color": "#9C8FD1", "icon": "🥱"},
    "anxious": {"label": C.t("Tendu", "Anxious"), "color": "#F09A5A", "icon": "😬"},
    "upset": {"label": C.t("À vif", "Upset"), "color": "#EF6A6A", "icon": "😖"},
    "lost": {"label": C.t("Perdu", "Lost"), "color": "#7E8AA2", "icon": "🌫️"},
}

WEATHER = [
    {"id": "clear", "label": C.t("Ciel net", "Clear sky"), "icon": "☀️", "stability": 0.6},
    {"id": "veiled", "label": C.t("Ciel voilé", "Veiled sky"), "icon": "🌤️", "stability": 0.0},
    {"id": "rain", "label": C.t("Pluie fine", "Fine rain"), "icon": "🌧️", "stability": -0.4},
    {"id": "static", "label": C.t("Air chargé", "Charged air"), "icon": "🌫️", "stability": -0.9},
]

SIGNATURES: Dict[str, Dict[str, Any]] = {
    "first_step": {
        "label": C.t("Premier pas", "First step"),
        "hint": C.t("Un objectif de vie mené à son terme.", "One life goal carried to the end."),
        "icon": "🏁",
    },
    "three_lives": {
        "label": C.t("Trois vies", "Three lives"),
        "hint": C.t("Trois objectifs accomplis.", "Three goals accomplished."),
        "icon": "🏅",
    },
    "six_lives": {
        "label": C.t("Les six", "All six"),
        "hint": C.t("Six objectifs accomplis.", "Six goals accomplished."),
        "icon": "🏆",
    },
    "hands_off": {
        "label": C.t("Mains propres", "Clean hands"),
        "hint": C.t("Six cycles d'affilée sans intervention.", "Six cycles in a row without intervening."),
        "icon": "🤲",
    },
    "low_profile": {
        "label": C.t("Profil bas", "Low profile"),
        "hint": C.t("Rester sous 30 de lucidité jusqu'au cycle 12.", "Stay under 30 lucidity until cycle 12."),
        "icon": "🕶️",
    },
    "rock_solid": {
        "label": C.t("Béton armé", "Rock solid"),
        "hint": C.t("Atteindre 92 de stabilité ou plus.", "Reach 92 stability or more."),
        "icon": "🧱",
    },
    "witness": {
        "label": C.t("Témoin", "Witness"),
        "hint": C.t("Voir un habitant dépasser 70 de lucidité.", "See a resident pass 70 lucidity."),
        "icon": "👁️",
    },
    "residue": {
        "label": C.t("Le Résidu", "The Residue"),
        "hint": C.t("Rencontrer le fragment de l'itération 8.", "Meet the fragment of iteration 8."),
        "icon": "🕳️",
    },
}


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _stable_digest(*parts: Any) -> str:
    """Short, process-independent id fragment.

    ``hash()`` cannot be used for anything persisted: it is salted per process,
    so the same event would get a different id every run.
    """
    raw = "|".join(str(part) for part in parts).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:10]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def relation_key(a: str, b: str) -> str:
    return "|".join(sorted((a, b)))


def relation_label(value: float) -> Dict[str, str]:
    if value < 12:
        return C.t("Inconnus", "Strangers")
    if value < 30:
        return C.t("Connaissances", "Acquaintances")
    if value < 48:
        return C.t("Proches", "Close")
    if value < 66:
        return C.t("Amis", "Friends")
    if value < 84:
        return C.t("Intimes", "Intimate")
    return C.t("Inséparables", "Inseparable")


# ---------------------------------------------------------------------------
# State construction
# ---------------------------------------------------------------------------

def _resident_from_content(spec: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": spec["id"],
        "name": spec["name"],
        "age": spec["age"],
        "gender": spec["gender"],
        "occupation": spec["occupation"],
        "home": spec["home"],
        "city": spec["city"],
        "bio": spec["bio"],
        "quote": spec["quote"],
        "look": spec["look"],
        "attributes": {k: float(v) for k, v in spec["attributes"].items()},
        "personality": {k: float(v) for k, v in spec["personality"].items()},
        "goals": list(spec["goals"]),
        "hobbies": list(spec["hobbies"]),
        "needs": {k: float(v) for k, v in spec["needs"].items()},
        "location_id": spec["home"],
        "position": {"x": 0.5, "y": 0.5},
        "money": 900.0 + (spec["age"] % 7) * 120.0,
        "mood": "neutral",
        "lucidity": float(spec["lucidity"]),
        "current_action": {"id": "idle", "raw": "idle", "label": C.t("Immobile", "Still")},
        "thought": C.t("…", "…"),
        "memory": [],
        "goal_state": {
            goal_id: {
                "progress": 0.0,
                "milestones": [False, False, False],
                "complete": False,
            }
            for goal_id in spec["goals"]
        },
        "refusals": 0,
        # Legacy-compatibility fields: the original API exposed these and user
        # created characters still rely on them.
        "user_id": None,
        "education": "none",
        "avatar_emoji": _avatar_emoji_for(spec["age"], spec["gender"]),
        "height": 158 + (spec["age"] % 5) * 4,
        "body_type": "average",
        "action_queue": [],
        "family": [],
        "children": [],
        "partner_id": None,
        "is_npc": True,
        "created_at": _now(),
    }


def _avatar_emoji_for(age: int, gender: str) -> str:
    if age < 3:
        return "👶"
    if age < 13:
        return "👧" if gender == "female" else "👦"
    if age < 60:
        if gender == "female":
            return "👩"
        if gender == "male":
            return "👨"
        return "🧑"
    return "👵" if gender == "female" else "👴"


def make_custom_resident(data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    """Build a player-created resident that lives in the same world as the rest."""
    age = int(data.get("age", 25))
    gender = data.get("gender", "other")
    goals = [g for g in (data.get("objectives") or []) if g in C.GOALS][:3]
    if not goals:
        goals = ["live_simply"]
    resident = {
        "id": f"res_custom_{uuid.uuid4().hex[:8]}",
        "name": (data.get("name") or "Sans nom").strip() or "Sans nom",
        "age": age,
        "gender": gender,
        "occupation": C.t(data.get("occupation") or "unemployed", data.get("occupation") or "unemployed"),
        "home": data.get("location_id") or "my_home",
        "city": data.get("city") or "—",
        "bio": C.t(data.get("bio") or "", data.get("bio") or ""),
        "quote": C.t("", ""),
        "look": {
            "skin": data.get("skin_color") or "#F5D0C5",
            "hair": data.get("hair_color") or "#4A3728",
            "hairstyle": data.get("hairstyle") or "bob",
            "eyes": data.get("eye_color") or "#6B4423",
            "outfit": {
                "top": data.get("outfit_top") or "#5AB0F0",
                "bottom": data.get("outfit_bottom") or "#2E3440",
                "accent": data.get("outfit_accent") or "#FFD166",
            },
            "accessory": data.get("accessory") or "none",
        },
        "attributes": {
            key: clamp(float(data.get(key, 50.0)))
            for key in ("intelligence", "strength", "charisma", "beauty", "creativity", "luck")
        },
        "personality": {
            key: clamp(float(data.get(key, 50.0)))
            for key in ("extroversion", "kindness", "humor", "ambition", "curiosity")
        },
        "goals": goals,
        "hobbies": [h for h in (data.get("hobbies") or [])][:6],
        "needs": {key: 88.0 for key in NEED_KEYS},
        "location_id": data.get("location_id") or "my_home",
        "position": {"x": 0.5, "y": 0.55},
        "money": 1200.0,
        "mood": "content",
        "lucidity": 4.0,
        "current_action": {"id": "idle", "raw": "idle", "label": C.t("Nouvelle venue", "Just arrived")},
        "thought": C.t("Où est-ce que je viens d'arriver ?", "Where have I just arrived?"),
        "memory": [],
        "goal_state": {
            goal_id: {"progress": 0.0, "milestones": [False, False, False], "complete": False}
            for goal_id in goals
        },
        "refusals": 0,
        "user_id": user_id,
        "education": data.get("education") or "none",
        "avatar_emoji": _avatar_emoji_for(age, gender),
        "height": int(data.get("height", 170)),
        "body_type": data.get("body_type") or "average",
        "action_queue": [],
        "family": [],
        "children": [],
        "partner_id": None,
        "is_npc": False,
        "created_at": _now(),
    }
    return resident


def new_state(locations: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Build a fresh iteration.

    Deterministic on purpose: the same catalogue must always produce the same
    starting world, in any process. That rules out picking a fallback home from
    set iteration order, which varies with the interpreter's hash seed.
    """
    ordered_ids = sorted(
        {str(loc.get("id")) for loc in locations if loc.get("id") is not None}
    )
    location_ids = set(ordered_ids)
    fallback_home = ordered_ids[0] if ordered_ids else None
    residents = [_resident_from_content(spec) for spec in C.RESIDENTS]
    for resident in residents:
        if resident["home"] not in location_ids:
            resident["location_id"] = fallback_home or resident["home"]

    # Seed the social fabric so the world is not six strangers on turn one.
    relationships: Dict[str, Dict[str, Any]] = {}
    pairs = [
        ("res_aya", "res_simon", 26.0),
        ("res_tobias", "res_mika", 21.0),
        ("res_priya", "res_elias", 18.0),
        ("res_elias", "res_simon", 14.0),
        ("res_aya", "res_priya", 11.0),
    ]
    for a, b, value in pairs:
        relationships[relation_key(a, b)] = {"value": value, "last_cycle": 0}

    return {
        "id": "main",
        "seed": 20260927,
        "paused": False,
        "cycle": 1,
        "chapter": 1,
        "max_cycles": MAX_CYCLES,
        "flux": START_FLUX,
        "stability": START_STABILITY,
        "lucidity_mod": 0.0,
        "weather": "clear",
        "game_hour": 9,
        "residents": residents,
        "relationships": relationships,
        "chronicle": [],
        "signatures": [],
        "history": [],
        "interventions_used": [],
        "pending_dilemma": _pick_dilemma(1, []),
        "dilemmas_seen": [],
        "cycles_since_intervention": 0,
        "anomaly_visible": False,
        "ending": None,
        "created_at": _now(),
        "updated_at": _now(),
    }


def _pick_dilemma(chapter: int, seen: List[str]) -> Optional[Dict[str, str]]:
    pool = [
        d
        for d in C.DILEMMAS
        if d["chapter_min"] <= chapter and d["id"] not in seen
    ]
    if not pool:
        pool = [d for d in C.DILEMMAS if d["chapter_min"] <= chapter]
    if not pool:
        return None
    chosen = pool[0]
    return {"id": chosen["id"], "cycle": None}


# ---------------------------------------------------------------------------
# Derived values
# ---------------------------------------------------------------------------

def global_lucidity(state: Dict[str, Any]) -> float:
    residents = state.get("residents", [])
    if not residents:
        return 0.0
    mean = sum(float(r.get("lucidity", 0)) for r in residents) / len(residents)
    return clamp(mean + float(state.get("lucidity_mod", 0.0)))


def chapter_for(cycle: int, max_cycles: int = MAX_CYCLES) -> int:
    third = max(1, max_cycles // 3)
    return min(3, 1 + (cycle - 1) // third)


def chapter_label(chapter: int) -> Dict[str, str]:
    return {
        1: C.t("I. Basse fréquence", "I. Low frequency"),
        2: C.t("II. Bruit de fond", "II. Background noise"),
        3: C.t("III. Signal", "III. Signal"),
    }.get(chapter, C.t("—", "—"))


def _goal_progress_total(resident: Dict[str, Any]) -> float:
    states = resident.get("goal_state", {})
    if not states:
        return 0.0
    return sum(float(s.get("progress", 0)) for s in states.values()) / len(states)


def _needs_average(resident: Dict[str, Any]) -> float:
    needs = resident.get("needs", {})
    if not needs:
        return 0.0
    return sum(float(needs.get(k, 100)) for k in NEED_KEYS) / len(NEED_KEYS)


def goal_progress_percent(resident: Dict[str, Any], goal_id: str) -> float:
    entry = resident.get("goal_state", {}).get(goal_id)
    if not entry:
        return 0.0
    return clamp(float(entry.get("progress", 0)))


def goals_completed(state: Dict[str, Any]) -> int:
    total = 0
    for resident in state.get("residents", []):
        for entry in resident.get("goal_state", {}).values():
            if entry.get("complete"):
                total += 1
    return total


def goals_total(state: Dict[str, Any]) -> int:
    return sum(len(r.get("goal_state", {})) for r in state.get("residents", []))


def score_of(state: Dict[str, Any]) -> int:
    return int(
        goals_completed(state) * 12
        + float(state.get("stability", 0))
        + len(state.get("signatures", [])) * 6
        + (MAX_CYCLES - int(state.get("cycle", 1))) * 0.5
    )


# ---------------------------------------------------------------------------
# Decision making
# ---------------------------------------------------------------------------

def _location_affordances(location: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not location:
        return [C.FALLBACK_FAMILY]
    families: List[Dict[str, Any]] = []
    seen = set()
    for raw in location.get("available_actions", []) or []:
        family = C.resolve_action(raw)
        key = family["id"]
        if key in seen:
            continue
        seen.add(key)
        entry = dict(family)
        entry["raw"] = raw
        families.append(entry)
    if not families:
        families = [dict(C.FALLBACK_FAMILY, raw="idle")]
    return families


def _need_pressure(resident: Dict[str, Any], family: Dict[str, Any]) -> float:
    """How much a family answers the resident's most pressing needs."""
    needs = resident.get("needs", {})
    total = 0.0
    for need, delta in (family.get("needs") or {}).items():
        if delta <= 0 or need not in needs:
            continue
        deficit = 100.0 - float(needs.get(need, 100))
        total += deficit * (delta / 30.0)
    return total


def _personality_fit(resident: Dict[str, Any], family: Dict[str, Any]) -> float:
    tags = set(family.get("tags") or [])
    persona = resident.get("personality", {})
    attrs = resident.get("attributes", {})
    fit = 0.0
    if "social" in tags:
        fit += float(persona.get("extroversion", 50)) * 0.42
    if "creative" in tags:
        fit += float(attrs.get("creativity", 50)) * 0.32
    if "study" in tags or "culture" in tags:
        fit += float(persona.get("curiosity", 50)) * 0.30
    if "career" in tags or "money" in tags:
        fit += float(persona.get("ambition", 50)) * 0.30
    if "care" in tags:
        fit += float(persona.get("kindness", 50)) * 0.34
    if "sport" in tags or "health" in tags:
        fit += float(attrs.get("strength", 50)) * 0.24
    if "fame" in tags:
        fit += float(attrs.get("charisma", 50)) * 0.22
    if "romance" in tags:
        fit += float(persona.get("kindness", 50)) * 0.20
    if "money" in tags:
        fit += float(attrs.get("luck", 50)) * 0.12
    if "calm" in tags:
        fit += (100.0 - float(persona.get("extroversion", 50))) * 0.26
    if "fun" in tags:
        fit += float(persona.get("humor", 50)) * 0.22
    # Hobbies are a strong, legible preference signal.
    for hobby in resident.get("hobbies", []):
        if hobby in tags:
            fit += 14.0
    return fit


def _goal_fit(resident: Dict[str, Any], family: Dict[str, Any]) -> float:
    tags = set(family.get("tags") or [])
    if not tags:
        return 0.0
    fit = 0.0
    ambition = float(resident.get("personality", {}).get("ambition", 50))
    for goal_id, entry in resident.get("goal_state", {}).items():
        if entry.get("complete"):
            continue
        goal = C.GOALS.get(goal_id)
        if not goal:
            continue
        overlap = tags & set(goal["tags"])
        if not overlap:
            continue
        remaining = 100.0 - float(entry.get("progress", 0))
        fit += len(overlap) * (0.55 + remaining / 100.0) * (50.0 + ambition) / 100.0 * 17.0
    return fit


def _habit_penalty(resident: Dict[str, Any], family: Dict[str, Any]) -> float:
    recent = [m.get("family") for m in resident.get("memory", [])[-3:]]
    repeats = recent.count(family["id"])
    return -6.5 * repeats


def _lucidity_edge(resident: Dict[str, Any], family: Dict[str, Any]) -> float:
    """At high lucidity residents drift away from their script."""
    lucidity = float(resident.get("lucidity", 0))
    if lucidity < 45:
        return 0.0
    weight = (lucidity - 45) / 55.0
    tags = set(family.get("tags") or [])
    edge = 0.0
    if tags & {"calm", "study", "culture"}:
        edge += 16.0 * weight
    if tags & {"care", "social"}:
        edge += 7.0 * weight
    return edge


def _unmet_needs(resident: Dict[str, Any], threshold: float = 30.0) -> List[str]:
    return [k for k in NEED_KEYS if float(resident.get("needs", {}).get(k, 100)) < threshold]


def choose_action(
    resident: Dict[str, Any],
    location: Optional[Dict[str, Any]],
    rng: random.Random,
    co_located: List[Dict[str, Any]],
    catalogue: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Pick what a resident does this cycle, with an explicit, testable reason.

    ``catalogue`` is the list of reachable locations, passed explicitly rather
    than read from module state so the function stays pure and unit-testable.
    """
    catalogue = catalogue if catalogue is not None else (_RELOCATION_CACHE or [])
    families = _location_affordances(location)
    scored: List[Tuple[float, Dict[str, Any], List[str]]] = []
    unmet = _unmet_needs(resident)

    for family in families:
        score = 0.0
        reasons: List[str] = []

        pressure = _need_pressure(resident, family)
        if pressure > 0:
            score += pressure
            if unmet:
                # Crystallise why: the sharpest unmet need this family answers.
                worst = max(
                    (n for n in unmet if (family.get("needs") or {}).get(n, 0) > 0),
                    key=lambda n: 100 - float(resident["needs"].get(n, 100)),
                    default=None,
                )
                if worst:
                    reasons.append(worst)

        fit = _personality_fit(resident, family)
        if fit > 0:
            score += fit

        goal_fit = _goal_fit(resident, family)
        if goal_fit > 0:
            score += goal_fit
            reasons.append("goal")

        score += _habit_penalty(resident, family)
        score += _lucidity_edge(resident, family)

        # Company makes social families far more appealing.
        if co_located and set(family.get("tags") or []) & {"social", "romance", "family", "care"}:
            score += 9.0 * min(3, len(co_located))
            reasons.append("company")

        score += rng.random() * 5.5
        scored.append((score, family, reasons))

    scored.sort(key=lambda item: item[0], reverse=True)
    best_score, best_family, best_reasons = scored[0]

    decision: Dict[str, Any] = {
        "family": best_family,
        "reasons": best_reasons,
        "score": best_score,
        "move_to": None,
        "urgent_need": None,
    }

    # Relocation. A resident leaves when a critical need has *no* local answer at
    # all (an exhausted person does not stay in a gym), or, more rarely, when
    # nothing here serves their goals.
    uncovered = [
        need
        for need in NEED_KEYS
        if float(resident.get("needs", {}).get(need, 100.0)) < 25.0
        and max(
            (float((fam.get("needs") or {}).get(need, 0.0)) for _, fam, _ in scored),
            default=0.0,
        )
        <= 0
    ]

    if uncovered:
        need = min(uncovered, key=lambda key: float(resident["needs"].get(key, 100.0)))
        destination = _best_relocation(resident, rng, catalogue, need=need)
        if destination:
            decision["move_to"] = destination
            decision["urgent_need"] = need
            decision["reasons"].append("relocate")
        return decision

    local_goal_fit = max((_goal_fit(resident, fam) for _, fam, _ in scored), default=0.0)
    if local_goal_fit < 3.0 and rng.random() < 0.22:
        destination = _best_relocation(resident, rng, catalogue, goal_driven=True)
        if destination:
            decision["move_to"] = destination
            decision["reasons"].append("relocate")

    return decision


_RELOCATION_CACHE: Optional[List[Dict[str, Any]]] = None


def set_location_catalogue(locations: List[Dict[str, Any]]) -> None:
    """Cache the catalogue for callers that cannot pass it explicitly.

    Prefer passing ``catalogue`` to :func:`choose_action`; this exists only so a
    resident can still relocate when a caller forgets.
    """
    global _RELOCATION_CACHE
    _RELOCATION_CACHE = locations


def _best_relocation(
    resident: Dict[str, Any],
    rng: random.Random,
    catalogue: List[Dict[str, Any]],
    goal_driven: bool = False,
    need: Optional[str] = None,
) -> Optional[str]:
    """Choose where a resident goes when the current place cannot help them."""
    if not catalogue:
        return None
    candidates: List[Tuple[float, str]] = []
    for location in catalogue:
        if location.get("id") == resident.get("location_id"):
            continue
        families = _location_affordances(location)
        if need:
            # Only consider places that actually address the critical need.
            relief = max(
                (float((fam.get("needs") or {}).get(need, 0.0)) for fam in families),
                default=0.0,
            )
            if relief <= 0:
                continue
            deficit = 100.0 - float(resident.get("needs", {}).get(need, 100.0))
            value = deficit * (relief / 30.0)
            value += max(
                (_personality_fit(resident, fam) for fam in families), default=0.0
            ) * 0.05
            candidates.append((value, location["id"]))
            continue
        if goal_driven:
            value = max((_goal_fit(resident, fam) for fam in families), default=0.0)
        else:
            value = max((_need_pressure(resident, fam) for fam in families), default=0.0)
        value += _personality_fit(resident, families[0]) * 0.05
        if value <= 0:
            continue
        candidates.append((value + rng.random() * 6.0, location["id"]))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][1]


# ---------------------------------------------------------------------------
# Effects
# ---------------------------------------------------------------------------

def _apply_needs(resident: Dict[str, Any], deltas: Dict[str, float]) -> Dict[str, float]:
    applied: Dict[str, float] = {}
    needs = resident.setdefault("needs", {})
    for need, delta in deltas.items():
        if need not in NEED_KEYS:
            continue
        before = float(needs.get(need, 100))
        after = clamp(before + float(delta))
        needs[need] = round(after, 2)
        applied[need] = round(after - before, 2)
    return applied


def _advance_goals(
    resident: Dict[str, Any], family: Dict[str, Any], multiplier: float = 1.0
) -> List[Dict[str, Any]]:
    """Credit goal progress for a family, returning milestone/complete events."""
    tags = set(family.get("tags") or [])
    events: List[Dict[str, Any]] = []
    if not tags:
        return events
    ambition = float(resident.get("personality", {}).get("ambition", 50))
    for goal_id, entry in resident.get("goal_state", {}).items():
        if entry.get("complete"):
            continue
        goal = C.GOALS.get(goal_id)
        if not goal:
            continue
        overlap = tags & set(goal["tags"])
        if not overlap:
            continue
        # Pacing. An iteration is 18 cycles long and a resident acts once per
        # cycle, so a goal must be reachable from roughly a dozen committed
        # actions -- otherwise the whole "goal" pillar is decorative. The gain
        # is therefore front-loaded (fast while a goal is far away, slower as it
        # nears completion) and ambition moves it by up to a third.
        remaining = 100.0 - float(entry.get("progress", 0))
        gain = (
            len(overlap)
            * (2.6 + ambition / 60.0)
            * (1.0 + remaining / 60.0)
            * multiplier
        )
        entry["progress"] = round(clamp(float(entry.get("progress", 0)) + gain), 2)
        milestones = entry.get("milestones") or [False, False, False]
        thresholds = (26, 56, 86)
        for index, threshold in enumerate(thresholds):
            if not milestones[index] and entry["progress"] >= threshold:
                milestones[index] = True
                events.append(
                    {
                        "kind": "goal_milestone",
                        "goal_id": goal_id,
                        "milestone_index": index,
                        "resident_id": resident["id"],
                    }
                )
        entry["milestones"] = milestones
        if all(milestones) and not entry.get("complete"):
            entry["complete"] = True
            events.append(
                {"kind": "goal_complete", "goal_id": goal_id, "resident_id": resident["id"]}
            )
    return events


def _boost_goals(resident: Dict[str, Any], amount: float) -> Dict[str, float]:
    gained: Dict[str, float] = {}
    for goal_id, entry in resident.get("goal_state", {}).items():
        if entry.get("complete"):
            continue
        before = float(entry.get("progress", 0))
        entry["progress"] = round(clamp(before + amount), 2)
        gained[goal_id] = round(entry["progress"] - before, 2)
    return gained


def _memory_add(
    resident: Dict[str, Any],
    cycle: int,
    kind: str,
    text: Dict[str, str],
    icon: str,
    family: Optional[str] = None,
    other: Optional[str] = None,
) -> None:
    memory = resident.setdefault("memory", [])
    memory.append(
        {
            "cycle": cycle,
            "kind": kind,
            "text": text,
            "icon": icon,
            "family": family,
            "other": other,
        }
    )
    del resident["memory"][:-12]


# ---------------------------------------------------------------------------
# Narrative
# ---------------------------------------------------------------------------

_NEED_LABELS = {
    "hunger": C.t("la faim", "hunger"),
    "energy": C.t("la fatigue", "exhaustion"),
    "social": C.t("la solitude", "loneliness"),
    "hygiene": C.t("la saleté", "a need to wash"),
    "fun": C.t("l'ennui", "boredom"),
    "bladder": C.t("une urgence", "an urgent call"),
    "comfort": C.t("l'inconfort", "discomfort"),
}

_REASON_TEXT = {
    "goal": C.t("parce que ça sert un de ses objectifs", "because it serves one of their goals"),
    "company": C.t("parce que quelqu'un d'autre est là", "because someone else is there"),
    "relocate": C.t("parce que l'endroit ne répondait plus à rien", "because this place had nothing left for them"),
}

_THOUGHTS: Dict[str, Dict[str, List[Dict[str, str]]]] = {
    "eat": {"low": [C.t("Je n'ai rien avalé depuis ce matin.", "Haven't eaten since morning.")], "high": [C.t("Je mérite un vrai repas.", "I deserve a real meal.")]},
    "drink": {"low": [C.t("Un café, même mauvais, ferait l'affaire.", "A coffee, even a bad one, would do.")], "high": [C.t("Juste un moment à moi.", "Just a moment for myself.")]},
    "sleep": {"low": [C.t("Encore un cycle et je m'écroule.", "One more cycle and I collapse.")], "high": [C.t("Je vais dormir pour de bon.", "I'm going to sleep properly.")]},
    "shower": {"low": [C.t("Ça fait trop longtemps.", "It's been far too long.")], "high": [C.t("L'eau chaude remet tout en place.", "Hot water fixes everything.")]},
    "toilet": {"low": [C.t("Il faut que je trouve des toilettes. Maintenant.", "I need a bathroom. Now.")], "high": [C.t("Cinq minutes, c'est tout ce que je demande.", "Five minutes, that's all I ask.")]},
    "cook": {"low": [C.t("Cuisiner épuisé, mais au moins on mange.", "Cooking exhausted, but at least we eat.")], "high": [C.t("Les mains dans la farine, c'est là que je suis bien.", "Hands in the flour, that's where I'm fine.")]},
    "work": {"low": [C.t("Je tiens parce qu'il faut bien.", "I hold on because there's no alternative.")], "high": [C.t("Ce projet peut vraiment marcher.", "This project can actually work.")]},
    "network": {"low": [C.t("Sourire et serrer des mains. Encore.", "Smile and shake hands. Again.")], "high": [C.t("Les gens se souviennent de moi.", "People remember me.")]},
    "study": {"low": [C.t("Je relis la même page depuis une heure.", "I've been rereading the same page for an hour.")], "high": [C.t("Il y a quelque chose à comprendre là-dedans.", "There's something in here worth understanding.")]},
    "create": {"low": [C.t("Rien ne sort, mais je reste là.", "Nothing comes out, but I stay here.")], "high": [C.t("Ça ressemble enfin à ce que j'avais en tête.", "This finally looks like what I had in mind.")]},
    "perform": {"low": [C.t("Je vais faire semblant d'y croire.", "I'll pretend to believe it.")], "high": [C.t("Le public a retenu son souffle.", "The room held its breath.")]},
    "game": {"low": [C.t("Juste une partie pour ne plus penser.", "Just one round so I stop thinking.")], "high": [C.t("Ça, ça me détend vraiment.", "This actually relaxes me.")]},
    "flirt": {"low": [C.t("Je n'ai pas l'énergie pour ça, mais bon.", "I don't have the energy for this, but fine.")], "high": [C.t("Je crois qu'il y a un truc, là.", "I think there's something there.")]},
    "chat": {"low": [C.t("Parler à quelqu'un me ferait du bien.", "Talking to someone would do me good.")], "high": [C.t("On s'est compris en trois mots.", "We understood each other in three words.")]},
    "party": {"low": [C.t("Faire la fête quand on est vidé, c'est un pari.", "Partying when you're empty is a gamble.")], "high": [C.t("J'avais besoin de ça.", "I needed this.")]},
    "exercise": {"low": [C.t("Mon corps me demande d'arrêter.", "My body is asking me to stop.")], "high": [C.t("Chaque séance me rapproche de quelque chose.", "Every session brings me closer to something.")]},
    "jog": {"low": [C.t("Je cours mal, mais je cours.", "I run badly, but I run.")], "high": [C.t("Je me sens increvable.", "I feel unbreakable.")]},
    "swim": {"low": [C.t("L'eau va me tenir debout.", "The water will keep me upright.")], "high": [C.t("Je pourrais rester là des heures.", "I could stay in here for hours.")]},
    "hike": {"low": [C.t("Monter si haut dans cet état, c'est courageux.", "Climbing this high in this state is brave.")], "high": [C.t("D'en haut, tout paraît simple.", "From up here everything looks simple.")]},
    "walk": {"low": [C.t("Marcher sans but, ça compte aussi.", "Walking with no purpose counts too.")], "high": [C.t("Cette ville a des détails que personne ne regarde.", "This city has details nobody looks at.")]},
    "travel": {"low": [C.t("Changer d'air, même mal.", "A change of air, even a bad one.")], "high": [C.t("Il faut que je voie autre chose.", "I need to see something else.")]},
    "shop": {"low": [C.t("Acheter pour oublier, vieux réflexe.", "Buying to forget, an old reflex.")], "high": [C.t("Je me fais plaisir, une fois.", "I'm treating myself, for once.")]},
    "care": {"low": [C.t("Je m'occupe des autres, c'est plus simple.", "I look after others, it's simpler.")], "high": [C.t("C'est ça qui a du sens.", "This is what makes sense.")]},
    "family": {"low": [C.t("Il faudrait être plus présent.", "I should be more present.")], "high": [C.t("C'est ça, la vraie vie.", "This is the real thing.")]},
    "watch": {"low": [C.t("Juste regarder quelque chose, n'importe quoi.", "Just watch something, anything.")], "high": [C.t("Deux heures de paix.", "Two hours of peace.")]},
    "stream": {"low": [C.t("Je joue mal mais je joue quand même.", "I play badly but I play anyway.")], "high": [C.t("Le chat a explosé ce soir.", "Chat blew up tonight.")]},
    "calm": {"low": [C.t("Souffler. Juste souffler.", "Breathe. Just breathe.")], "high": [C.t("Je n'ai besoin de rien d'autre.", "I don't need anything else.")]},
    "idle": {"low": [C.t("Je ne sais plus quoi faire.", "I don't know what to do any more.")], "high": [C.t("Un instant sans rien, c'est déjà beaucoup.", "A moment with nothing in it is already a lot.")]},
}

_LUCID_THOUGHTS = [
    C.t("J'ai déjà vécu cette journée. Deux fois.", "I have lived this day already. Twice."),
    C.t("Pourquoi je connais la réponse avant de l'entendre ?", "Why do I know the answer before hearing it?"),
    C.t("Il y a un bruit derrière le monde.", "There is a noise behind the world."),
    C.t("Mes mains se répètent. Comme un texte recopié.", "My hands repeat themselves. Like copied-out text."),
    C.t("Quelqu'un décide de ce que je vais penser.", "Someone decides what I am about to think."),
    C.t("Je crois que je vais rire ou pleurer, et je ne choisis pas.", "I think I will laugh or cry, and it isn't my choice."),
]

_SURPRISE_THOUGHTS = [
    C.t("Je n'avais pas prévu de faire ça aujourd'hui.", "I had not planned on doing this today."),
    C.t("C'est étrange. Mais c'est agréable.", "It's strange. But it's pleasant."),
    C.t("Ce n'était pas sur ma liste.", "It wasn't on my list."),
]


def _thought_for(
    resident: Dict[str, Any],
    family: Dict[str, Any],
    rng: random.Random,
    deliberate: bool,
) -> Dict[str, str]:
    lucidity = float(resident.get("lucidity", 0))
    if lucidity >= 62 and rng.random() < 0.45:
        return rng.choice(_LUCID_THOUGHTS)
    if deliberate and rng.random() < 0.5:
        return rng.choice(_SURPRISE_THOUGHTS)

    band = "low" if _needs_average(resident) < 45 else "high"
    bank = _THOUGHTS.get(family["id"], _THOUGHTS["idle"])
    options = bank.get(band) or bank.get("high") or _THOUGHTS["idle"]["high"]

    # Reflect on the strongest relationship when doing something social.
    if set(family.get("tags") or []) & {"social", "romance", "family", "care"}:
        memory_line = _relationship_memory_line(resident, rng)
        if memory_line:
            return memory_line
    return rng.choice(options)


def _relationship_memory_line(
    resident: Dict[str, Any], rng: random.Random
) -> Optional[Dict[str, str]]:
    for entry in reversed(resident.get("memory", [])):
        if entry.get("kind") == "relation" and entry.get("text"):
            text = entry["text"]
            return C.t(
                f"Je repense à ce moment avec {text['fr']}.",
                f"I keep thinking about that moment with {text['en']}.",
            )
    return None


def _reasons_to_text(reasons: List[str]) -> Dict[str, str]:
    parts_fr: List[str] = []
    parts_en: List[str] = []
    for reason in reasons:
        if reason in _NEED_LABELS:
            parts_fr.append(f"à cause de {_NEED_LABELS[reason]['fr']}")
            parts_en.append(f"because of {_NEED_LABELS[reason]['en']}")
        elif reason in _REASON_TEXT:
            parts_fr.append(_REASON_TEXT[reason]["fr"])
            parts_en.append(_REASON_TEXT[reason]["en"])
    if not parts_fr:
        return C.t("par habitude", "out of habit")
    return C.t(", ".join(parts_fr), ", ".join(parts_en))


# ---------------------------------------------------------------------------
# Mood
# ---------------------------------------------------------------------------

def _mood_for(resident: Dict[str, Any]) -> str:
    needs = _needs_average(resident)
    lucidity = float(resident.get("lucidity", 0))
    momentum = _goal_progress_total(resident)
    if lucidity >= 68 and needs < 55:
        return "lost"
    if needs >= 78:
        return "radiant" if momentum > 40 else "content"
    if needs >= 62:
        return "content" if momentum > 25 else "focused"
    if needs >= 46:
        return "focused" if momentum > 35 else "neutral"
    if needs >= 30:
        return "tired" if lucidity < 55 else "anxious"
    return "upset"


# ---------------------------------------------------------------------------
# Cycle resolution
# ---------------------------------------------------------------------------

def advance_cycle(
    state: Dict[str, Any],
    locations: List[Dict[str, Any]],
    rng: Optional[random.Random] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Resolve one cycle. Returns ``(new_state, report)``.

    Raises :class:`GameRuleError` while the iteration is paused: a paused world
    must freeze exactly where it is, otherwise the pause is decorative.
    """
    if state.get("paused"):
        raise GameRuleError(
            C.t(
                "L'itération est en pause : reprenez-la pour avancer d'un cycle.",
                "The iteration is paused: resume it to advance a cycle.",
            )
        )
    if state.get("ending"):
        return state, {
            "cycle": state.get("cycle"),
            "status": "ended",
            "ending": state["ending"],
            "chronicle": [],
            "residents": [],
            "highlights": [],
            "world": {},
        }

    locations_by_id = {loc.get("id"): loc for loc in locations}
    set_location_catalogue(locations)

    cycle = int(state.get("cycle", 1))
    rng = rng or random.Random(int(state.get("seed", 1)) * 7919 + cycle * 104729)
    chapter = chapter_for(cycle, int(state.get("max_cycles", MAX_CYCLES)))

    chronicle: List[Dict[str, Any]] = []
    highlights: List[Dict[str, Any]] = []
    resident_reports: List[Dict[str, Any]] = []
    milestone_events: List[Dict[str, Any]] = []
    flux_before = float(state.get("flux", START_FLUX))
    stability_before = float(state.get("stability", START_STABILITY))
    lucidity_before = global_lucidity(state)

    residents = state.get("residents", [])

    # 1. Group by location so co-presence can inform decisions.
    by_location: Dict[str, List[Dict[str, Any]]] = {}
    for resident in residents:
        by_location.setdefault(resident.get("location_id"), []).append(resident)

    # 2. Decide + resolve each resident.
    for resident in residents:
        location = locations_by_id.get(resident.get("location_id"))
        co_located = [
            other
            for other in by_location.get(resident.get("location_id"), [])
            if other["id"] != resident["id"]
        ]
        decision = choose_action(resident, location, rng, co_located, locations)
        family = decision["family"]

        if decision.get("move_to"):
            target = locations_by_id.get(decision["move_to"])
            if target:
                resident["location_id"] = target["id"]
                location = target

        # Needs: decay first, then the action's relief.
        decayed = _apply_needs(resident, dict(NEED_DECAY))
        relieved = _apply_needs(resident, family.get("needs") or {})

        # Money: some families earn or cost.
        money_delta = float(family.get("money") or 0.0)
        if money_delta:
            resident["money"] = round(max(0.0, float(resident.get("money", 0)) + money_delta), 2)

        # Goals.
        events = _advance_goals(resident, family)
        milestone_events.extend(events)

        # Lucidity drift.
        lucidity_delta = LUCIDITY_DRIFT + rng.random() * 0.5
        resident["lucidity"] = round(clamp(float(resident.get("lucidity", 0)) + lucidity_delta), 2)

        # Presentation state.
        resident["current_action"] = {
            "id": family["id"],
            "raw": family.get("raw", family["id"]),
            "label": family["label"],
            "icon": family.get("icon", "🌀"),
        }
        resident["thought"] = _thought_for(
            resident, family, rng, deliberate=family.get("id") == "idle"
        )
        resident["mood"] = _mood_for(resident)
        resident["position"] = {
            "x": round(0.08 + rng.random() * 0.84, 3),
            "y": round(0.18 + rng.random() * 0.72, 3),
        }

        resident_reports.append(
            {
                "id": resident["id"],
                "name": resident["name"],
                "action": resident["current_action"],
                "thought": resident["thought"],
                "mood": resident["mood"],
                "mood_label": MOODS.get(resident["mood"], MOODS["neutral"])["label"],
                "location_id": resident["location_id"],
                "reason": _reasons_to_text(decision["reasons"]),
                "needs_delta": {
                    # Sorted so two identical runs produce byte-identical reports.
                    key: round(float(decayed.get(key, 0)) + float(relieved.get(key, 0)), 2)
                    for key in sorted(set(decayed) | set(relieved))
                },
                "goal_progress": _goal_snapshot(resident),
                "money_delta": money_delta,
                "lucidity_delta": round(lucidity_delta, 2),
                "position": resident["position"],
            }
        )

        _memory_add(
            resident,
            cycle,
            "action",
            family["label"],
            family.get("icon", "🌀"),
            family=family["id"],
        )

    # 3. Relationships between co-located residents.
    relation_deltas: List[Dict[str, Any]] = []
    by_location = {}
    for resident in residents:
        by_location.setdefault(resident.get("location_id"), []).append(resident)
    for location_id, group in by_location.items():
        if len(group) < 2:
            continue
        for index, first in enumerate(group):
            for second in group[index + 1 :]:
                key = relation_key(first["id"], second["id"])
                entry = state.setdefault("relationships", {}).setdefault(
                    key, {"value": 8.0, "last_cycle": cycle}
                )
                intimacy = (
                    float(first["personality"].get("kindness", 50))
                    + float(second["personality"].get("kindness", 50))
                ) / 2.0
                gain = 1.6 + intimacy / 100.0 * 2.4 + rng.random() * 1.2
                before = float(entry["value"])
                entry["value"] = round(clamp(before + gain), 2)
                entry["last_cycle"] = cycle
                realized = round(entry["value"] - before, 2)
                relation_deltas.append(
                    {
                        "key": key,
                        "a": first["id"],
                        "b": second["id"],
                        "delta": realized,
                        "value": entry["value"],
                        "label": relation_label(entry["value"]),
                        "location_id": location_id,
                    }
                )
                if realized > 2.8:
                    _memory_add(
                        first,
                        cycle,
                        "relation",
                        C.t(second["name"], second["name"]),
                        "🤝",
                        other=second["id"],
                    )
                    _memory_add(
                        second,
                        cycle,
                        "relation",
                        C.t(first["name"], first["name"]),
                        "🤝",
                        other=first["id"],
                    )
                    highlights.append(
                        {
                            "kind": "bond",
                            "resident_id": first["id"],
                            "other_id": second["id"],
                            "text": C.t(
                                f"{first['name']} et {second['name']} se sont rapprochés.",
                                f"{first['name']} and {second['name']} grew closer.",
                            ),
                        }
                    )

    # 4. Goal completion payouts.
    for event in milestone_events:
        resident = next((r for r in residents if r["id"] == event["resident_id"]), None)
        if not resident:
            continue
        goal = C.GOALS.get(event["goal_id"], {})
        if event["kind"] == "goal_milestone":
            milestone = (goal.get("milestones") or [C.t("Étape", "Step")])[
                event["milestone_index"]
            ]
            state["flux"] = round(float(state.get("flux", 0)) + 1.0, 2)
            highlights.append(
                {
                    "kind": "milestone",
                    "resident_id": resident["id"],
                    "text": C.t(
                        f"{resident['name']} franchit une étape : {milestone['fr']}.",
                        f"{resident['name']} clears a step: {milestone['en']}.",
                    ),
                }
            )
            chronicle.append(
                _chronicle_entry(cycle, "milestone", "🪜", highlights[-1]["text"], [resident["id"]])
            )
            # Achievements are noticeable: the resident earns them suspiciously fast.
            resident["lucidity"] = round(clamp(float(resident["lucidity"]) + LUCIDITY_NOTICE), 2)
        else:
            state["flux"] = round(float(state.get("flux", 0)) + 4.0, 2)
            state["stability"] = round(clamp(float(state.get("stability", 0)) + 4.0), 2)
            text = C.t(
                f"Objectif accompli : {resident['name']} — {goal.get('label', {}).get('fr', event['goal_id'])}.",
                f"Goal accomplished: {resident['name']} — {goal.get('label', {}).get('en', event['goal_id'])}.",
            )
            highlights.append(
                {"kind": "goal_complete", "resident_id": resident["id"], "text": text}
            )
            chronicle.append(_chronicle_entry(cycle, "goal", "🎉", text, [resident["id"]]))
            resident["lucidity"] = round(clamp(float(resident["lucidity"]) + 4.0), 2)
            _memory_add(resident, cycle, "goal", text, "🎉")

    # 5. One chronicle line per resident, explaining the choice.
    for report in resident_reports:
        location = locations_by_id.get(report["location_id"])
        text = C.t(
            f"{report['name']} — {report['action']['label']['fr']} "
            f"({location.get('name', report['location_id']) if location else report['location_id']}) "
            f"{report['reason']['fr']}.",
            f"{report['name']} — {report['action']['label']['en']} "
            f"({location.get('name', report['location_id']) if location else report['location_id']}) "
            f"{report['reason']['en']}.",
        )
        chronicle.append(
            _chronicle_entry(
                cycle,
                "action",
                report["action"].get("icon", "🌀"),
                text,
                [report["id"]],
                resident_name=report["name"],
                location_id=report["location_id"],
            )
        )

    # 6. World events.
    stability_current = float(state.get("stability", START_STABILITY))
    event = _roll_event(rng, stability_current)
    if event:
        _apply_world_effects(state, residents, event.get("effects") or {})
        chronicle.append(_chronicle_entry(cycle, "event", "🌐", event["text"], []))
        highlights.append({"kind": "event", "text": event["text"], "id": event["id"]})

    # 7. Anomaly.
    stability_after_events = float(state.get("stability", START_STABILITY))
    state["anomaly_visible"] = stability_after_events < 34
    if state["anomaly_visible"] and not any(
        entry.get("kind") == "anomaly" for entry in state.get("chronicle", [])[-6:]
    ):
        text = C.t(
            "RÉSIDU-08 s'affiche dans un coin du monde. Il ne bouge pas. Il attend "
            "que vous le regardiez.",
            "RÉSIDU-08 renders in a corner of the world. It doesn't move. It waits "
            "for you to look at it.",
        )
        chronicle.append(_chronicle_entry(cycle, "anomaly", "🕳️", text, []))
        highlights.append({"kind": "anomaly", "text": text, "id": "residu"})
        _unlock_signature(state, "residue")

    # 8. Stability bookkeeping.
    # A comfortable world mends itself, a shaky one slides: the recovery a
    # healthy group of residents provides shrinks with the world's own health, so
    # an iteration that is already falling apart keeps falling instead of being
    # rescued by a bonus nobody earned.
    stability = float(state.get("stability", START_STABILITY))
    stability_before_bookkeeping = stability
    stability += STABILITY_DRIFT
    lucidity_now = global_lucidity(state)
    if lucidity_now > 45:
        stability -= (lucidity_now - 45) * 0.16
    starving = [
        r for r in residents if _needs_average(r) < 34
    ]
    stability -= len(starving) * 1.1
    if not starving:
        health = clamp((stability_before_bookkeeping - 20.0) / 40.0, 0.0, 1.0)
        stability += 1.4 * health
    weather = _weather_for(state, rng)
    stability += weather["stability"]
    state["stability"] = round(clamp(stability), 2)
    state["weather"] = weather["id"]

    # 9. Flux income + signature checks.
    state["flux"] = round(
        min(FLUX_CAP, float(state.get("flux", 0)) + FLUX_PER_CYCLE + (2 if state["stability"] > 70 else 0)),
        2,
    )
    state["cycles_since_intervention"] = int(state.get("cycles_since_intervention", 0)) + 1
    state["game_hour"] = (int(state.get("game_hour", 9)) + 11) % 24
    _check_signatures(state, chronicle, cycle)

    # 10. Advance counters, queue the next dilemma.
    state["cycle"] = cycle + 1
    state["chapter"] = chapter_for(state["cycle"], int(state.get("max_cycles", MAX_CYCLES)))
    seen = list(state.get("dilemmas_seen", []))
    next_dilemma = _pick_dilemma(state["chapter"], seen)
    if next_dilemma:
        next_dilemma["cycle"] = state["cycle"]
    state["pending_dilemma"] = next_dilemma
    state["history"] = (state.get("history", []) + [
        {
            "cycle": cycle,
            "stability": state["stability"],
            "lucidity": round(lucidity_now, 2),
            "flux": state["flux"],
            "goals_completed": goals_completed(state),
        }
    ])[-24:]
    state["chronicle"] = (state.get("chronicle", []) + chronicle)[-160:]
    state["updated_at"] = _now()

    # 11. Ending?
    ending = _resolve_ending(state)
    if ending:
        state["ending"] = ending
        chronicle.append(_chronicle_entry(cycle, "ending", "🌒", C.ENDING_NOTE, []))

    report = {
        "status": "ended" if ending else "ok",
        "cycle": cycle,
        "next_cycle": state["cycle"],
        "chapter": chapter,
        "chapter_label": chapter_label(chapter),
        "weather": next((w for w in WEATHER if w["id"] == state["weather"]), WEATHER[0]),
        "world": {
            "flux_before": flux_before,
            "flux_after": state["flux"],
            "stability_before": stability_before,
            "stability_after": state["stability"],
            "stability_delta": round(state["stability"] - stability_before, 2),
            "lucidity_before": round(lucidity_before, 2),
            "lucidity_after": round(lucidity_now, 2),
            "lucidity_delta": round(lucidity_now - lucidity_before, 2),
        },
        "residents": resident_reports,
        "relationships": relation_deltas,
        "chronicle": chronicle,
        "highlights": highlights,
        "signatures": list(state.get("signatures", [])),
        "ending": ending,
    }
    return state, report


def _chronicle_entry(
    cycle: int,
    kind: str,
    icon: str,
    text: Dict[str, str],
    residents: List[str],
    resident_name: Optional[str] = None,
    location_id: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        # A stable digest, not hash(): Python randomises string hashes per process,
        # and two identical runs must produce identical ids.
        "id": f"chr_{cycle}_{kind}_{_stable_digest(text.get('en', ''), text.get('fr', ''))}",
        "cycle": cycle,
        "kind": kind,
        "icon": icon,
        "text": text,
        "residents": residents,
        "resident_name": resident_name,
        "location_id": location_id,
    }


def _goal_snapshot(resident: Dict[str, Any]) -> Dict[str, float]:
    return {
        goal_id: round(float(entry.get("progress", 0)), 2)
        for goal_id, entry in resident.get("goal_state", {}).items()
    }


def _weather_for(state: Dict[str, Any], rng: random.Random) -> Dict[str, Any]:
    stability = float(state.get("stability", START_STABILITY))
    if stability < 34:
        weights = [1, 2, 3, 5]
    elif stability < 60:
        weights = [3, 4, 3, 2]
    else:
        weights = [5, 4, 2, 1]
    return rng.choices(WEATHER, weights=weights, k=1)[0]


def _roll_event(rng: random.Random, stability: float) -> Optional[Dict[str, Any]]:
    pool = []
    for event in C.EVENTS:
        if stability < float(event.get("min_stability", 0)):
            continue
        if "max_stability" in event and stability > float(event["max_stability"]):
            continue
        pool.append(event)
    if not pool:
        return None
    # Not every cycle gets an event: keeps the chronicle readable.
    if rng.random() > 0.62:
        return None
    weights = [float(e.get("weight", 1)) for e in pool]
    return rng.choices(pool, weights=weights, k=1)[0]


def _apply_world_effects(
    state: Dict[str, Any], residents: List[Dict[str, Any]], effects: Dict[str, float]
) -> None:
    for key, value in effects.items():
        if key == "stability":
            state["stability"] = round(clamp(float(state.get("stability", 0)) + value), 2)
        elif key == "flux":
            state["flux"] = round(clamp(float(state.get("flux", 0)) + value, 0, FLUX_CAP), 2)
        elif key == "lucidity_all":
            for resident in residents:
                resident["lucidity"] = round(
                    clamp(float(resident.get("lucidity", 0)) + value), 2
                )
        elif key == "lucidity":
            state["lucidity_mod"] = round(
                clamp(float(state.get("lucidity_mod", 0.0)) + value, -60, 60), 2
            )
        elif key == "needs_all":
            for resident in residents:
                _apply_needs(resident, {need: value for need in NEED_KEYS})
        elif key == "goal_boost":
            for resident in residents:
                _boost_goals(resident, value)


def _check_signatures(
    state: Dict[str, Any], chronicle: List[Dict[str, Any]], cycle: int
) -> None:
    unlocked: List[str] = []

    def unlock(key: str) -> None:
        if key not in state.setdefault("signatures", []):
            state["signatures"].append(key)
            unlocked.append(key)

    completed = goals_completed(state)
    if completed >= 1:
        unlock("first_step")
    if completed >= 3:
        unlock("three_lives")
    if completed >= 6:
        unlock("six_lives")
    if int(state.get("cycles_since_intervention", 0)) >= 6:
        unlock("hands_off")
    if cycle >= 12 and global_lucidity(state) < 30:
        unlock("low_profile")
    if float(state.get("stability", 0)) >= 92:
        unlock("rock_solid")
    if any(float(r.get("lucidity", 0)) >= 70 for r in state.get("residents", [])):
        unlock("witness")

    for key in unlocked:
        info = SIGNATURES.get(key)
        if not info:
            continue
        text = C.t(
            f"Signature obtenue : {info['label']['fr']} — {info['hint']['fr']}",
            f"Signature unlocked: {info['label']['en']} — {info['hint']['en']}",
        )
        chronicle.append(_chronicle_entry(cycle, "signature", info["icon"], text, []))


def _unlock_signature(state: Dict[str, Any], key: str) -> bool:
    if key in state.setdefault("signatures", []):
        return False
    state["signatures"].append(key)
    return True


def _resolve_ending(state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if state.get("ending"):
        return state["ending"]
    completed = goals_completed(state)
    lucidity = global_lucidity(state)
    stability = float(state.get("stability", 0))
    cycle = int(state.get("cycle", 1))
    max_cycles = int(state.get("max_cycles", MAX_CYCLES))

    key: Optional[str] = None
    if stability <= 0.5:
        key = "drift"
    elif cycle > max_cycles:
        if completed >= 7 and lucidity < 45:
            key = "control"
        elif lucidity >= 65 and stability >= 40:
            key = "awakening"
        else:
            key = "silence"
    if not key:
        return None
    info = C.ENDINGS[key]
    return {
        "id": key,
        "title": info["title"],
        "body": info["body"],
        "score": score_of(state),
        "goals_completed": completed,
        "goals_total": goals_total(state),
        "lucidity": round(lucidity, 2),
        "stability": stability,
        "signatures": list(state.get("signatures", [])),
        "note": C.ENDING_NOTE,
    }


# ---------------------------------------------------------------------------
# Player actions
# ---------------------------------------------------------------------------

class GameRuleError(Exception):
    """Raised when an action is not legal in the current world state."""


def apply_intervention(
    state: Dict[str, Any], intervention_id: str, target_id: Optional[str] = None,
    second_target_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Spend Flux to nudge the world. Fully validated, fully explained."""
    definition = next((i for i in C.INTERVENTIONS if i["id"] == intervention_id), None)
    if not definition:
        raise GameRuleError(f"Intervention inconnue: {intervention_id}")
    if state.get("ending"):
        raise GameRuleError("L'itération est terminée.")
    chapter = int(state.get("chapter", 1))
    if chapter < int(definition.get("chapter_min", 1)):
        raise GameRuleError(
            f"« {definition['label']['fr']} » n'est disponible qu'au chapitre "
            f"{definition['chapter_min']}."
        )
    cost = float(definition.get("cost", 0))
    if float(state.get("flux", 0)) < cost:
        raise GameRuleError("Pas assez de Flux pour cette intervention.")

    residents = state.get("residents", [])
    target = None
    second = None
    if definition["target"] == "resident":
        target = next((r for r in residents if r["id"] == target_id), None)
        if not target:
            raise GameRuleError("Il faut désigner un habitant pour cette intervention.")
    elif definition["target"] == "pair":
        target = next((r for r in residents if r["id"] == target_id), None)
        second = next(
            (r for r in residents if r["id"] == second_target_id and r["id"] != target_id),
            None,
        )
        if not target or not second:
            raise GameRuleError("Cette intervention demande deux habitants distincts.")

    state["flux"] = round(float(state.get("flux", 0)) - cost, 2)
    state["cycles_since_intervention"] = 0

    effects = dict(definition.get("effects") or {})
    result: Dict[str, Any] = {
        "id": definition["id"],
        "label": definition["label"],
        "icon": definition["icon"],
        "cost": cost,
        "target_id": target_id,
        "second_target_id": second_target_id,
        "needs_delta": {},
        "attributes_delta": {},
        "goal_progress": {},
        "notes": [],
        "resisted": False,
    }

    # High-lucidity residents notice the hand that moves them.
    lucidity_gain = float(definition.get("lucidity", 0))
    if target and float(target.get("lucidity", 0)) >= 58 and lucidity_gain > 0:
        lucidity_gain *= 2.0
        result["resisted"] = True
        result["notes"].append(
            C.t(
                f"{target['name']} a senti le sol bouger sous ses pieds.",
                f"{target['name']} felt the floor shift under their feet.",
            )
        )

    if definition["target"] == "resident" and target:
        needs_delta = {
            key.split(".", 1)[1]: value
            for key, value in effects.items()
            if key.startswith("needs.")
        }
        result["needs_delta"] = _apply_needs(target, needs_delta)
        attributes_delta = {
            key.split(".", 1)[1]: value
            for key, value in effects.items()
            if key.startswith("attributes.")
        }
        for attribute, value in attributes_delta.items():
            before = float(target.get("attributes", {}).get(attribute, 50))
            after = clamp(before + value)
            target.setdefault("attributes", {})[attribute] = round(after, 2)
            result["attributes_delta"][attribute] = round(after - before, 2)
        if "goal_boost" in effects:
            result["goal_progress"] = _boost_goals(target, float(effects["goal_boost"]))
        target["lucidity"] = round(clamp(float(target.get("lucidity", 0)) + lucidity_gain), 2)
        _memory_add(
            target,
            int(state.get("cycle", 1)),
            "intervention",
            C.t(
                f"Quelque chose a changé sans explication ({definition['label']['fr']}).",
                f"Something changed with no explanation ({definition['label']['en']}).",
            ),
            definition["icon"],
        )
    elif definition["target"] == "pair" and target and second:
        key = relation_key(target["id"], second["id"])
        entry = state.setdefault("relationships", {}).setdefault(
            key, {"value": 10.0, "last_cycle": int(state.get("cycle", 1))}
        )
        before = float(entry["value"])
        entry["value"] = round(clamp(before + float(effects.get("relationship", 10))), 2)
        result["relationship"] = {
            "key": key,
            "delta": round(entry["value"] - before, 2),
            "value": entry["value"],
            "label": relation_label(entry["value"]),
        }
        shared_needs = {
            key.split(".", 1)[1]: value
            for key, value in effects.items()
            if key.startswith("needs.")
        }
        result["needs_delta"] = _apply_needs(target, shared_needs)
        _apply_needs(second, shared_needs)
        for resident in (target, second):
            resident["lucidity"] = round(
                clamp(float(resident.get("lucidity", 0)) + lucidity_gain), 2
            )
            _memory_add(
                resident,
                int(state.get("cycle", 1)),
                "intervention",
                C.t(
                    f"Une rencontre un peu trop bien tombée.",
                    f"A meeting that fell a little too well into place.",
                ),
                definition["icon"],
                other=(second["id"] if resident is target else target["id"]),
            )

    # World-scoped effects.
    if "stability" in effects:
        before = float(state.get("stability", 0))
        state["stability"] = round(clamp(before + float(effects["stability"])), 2)
        result["stability_delta"] = round(state["stability"] - before, 2)
    if "flux" in effects:
        state["flux"] = round(
            clamp(float(state.get("flux", 0)) + float(effects["flux"]), 0, FLUX_CAP), 2
        )
    if "lucidity" in effects and definition["target"] == "world":
        state["lucidity_mod"] = round(
            clamp(float(state.get("lucidity_mod", 0.0)) + float(effects["lucidity"]), -60, 60),
            2,
        )
        result["lucidity_delta"] = float(effects["lucidity"])
    if "needs" in effects and definition["target"] == "world":
        for resident in residents:
            _apply_needs(resident, {need: effects["needs"] for need in NEED_KEYS})
    if "needs.fun" in effects and definition["target"] == "world":
        for resident in residents:
            _apply_needs(resident, {"fun": float(effects["needs.fun"])})

    state.setdefault("interventions_used", []).append(
        {
            "cycle": int(state.get("cycle", 1)),
            "id": definition["id"],
            "target": target_id,
            "second_target": second_target_id,
        }
    )

    text = C.t(
        f"Intervention — {definition['label']['fr']}"
        + (f" sur {target['name']}" if target else "")
        + ".",
        f"Intervention — {definition['label']['en']}"
        + (f" on {target['name']}" if target else "")
        + ".",
    )
    entry = _chronicle_entry(int(state.get("cycle", 1)), "intervention", definition["icon"], text, [])
    state["chronicle"] = (state.get("chronicle", []) + [entry])[-160:]
    state["updated_at"] = _now()
    result["chronicle"] = entry
    result["flux_after"] = state["flux"]
    return result


def apply_dilemma_choice(
    state: Dict[str, Any], dilemma_id: str, choice_id: str
) -> Dict[str, Any]:
    definition = next((d for d in C.DILEMMAS if d["id"] == dilemma_id), None)
    if not definition:
        raise GameRuleError(f"Dilemme inconnu: {dilemma_id}")
    pending = state.get("pending_dilemma") or {}
    if pending.get("id") != dilemma_id:
        raise GameRuleError("Ce dilemme n'est pas en attente.")
    choice = next((c for c in definition["choices"] if c["id"] == choice_id), None)
    if not choice:
        raise GameRuleError(f"Choix inconnu: {choice_id}")

    residents = state.get("residents", [])
    _apply_world_effects(state, residents, choice.get("effects") or {})
    state.setdefault("dilemmas_seen", []).append(dilemma_id)
    state["pending_dilemma"] = None

    text = C.t(
        f"Décision — {definition['prompt']['fr']} → {choice['label']['fr']}.",
        f"Decision — {definition['prompt']['en']} → {choice['label']['en']}.",
    )
    entry = _chronicle_entry(
        int(state.get("cycle", 1)), "decision", "⚖️", text, []
    )
    state["chronicle"] = (state.get("chronicle", []) + [entry])[-160:]
    state["updated_at"] = _now()
    return {
        "id": dilemma_id,
        "choice": choice_id,
        "label": choice["label"],
        "effects": choice.get("effects") or {},
        "chronicle": entry,
        "flux_after": state.get("flux"),
        "stability_after": state.get("stability"),
    }


# ---------------------------------------------------------------------------
# Serialisation for the client
# ---------------------------------------------------------------------------

def public_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """Everything the client needs, with no internal-only keys."""
    residents = []
    for resident in state.get("residents", []):
        residents.append(
            {
                **resident,
                "mood_label": MOODS.get(resident.get("mood", "neutral"), MOODS["neutral"])["label"],
                "mood_color": MOODS.get(resident.get("mood", "neutral"), MOODS["neutral"])["color"],
                "mood_icon": MOODS.get(resident.get("mood", "neutral"), MOODS["neutral"])["icon"],
                "needs_average": round(_needs_average(resident), 1),
                "goals": [
                    {
                        "id": goal_id,
                        "label": C.GOALS[goal_id]["label"],
                        "milestones": C.GOALS[goal_id]["milestones"],
                        "progress": round(float(entry.get("progress", 0)), 2),
                        "milestone_state": list(entry.get("milestones", [])),
                        "complete": bool(entry.get("complete")),
                    }
                    for goal_id, entry in resident.get("goal_state", {}).items()
                    if goal_id in C.GOALS
                ],
            }
        )
    return {
        "id": state.get("id", "main"),
        "cycle": state.get("cycle", 1),
        "chapter": state.get("chapter", 1),
        "chapter_label": chapter_label(int(state.get("chapter", 1))),
        "max_cycles": state.get("max_cycles", MAX_CYCLES),
        "flux": state.get("flux", 0),
        "flux_cap": FLUX_CAP,
        "stability": state.get("stability", 0),
        "lucidity": round(global_lucidity(state), 2),
        "weather": next((w for w in WEATHER if w["id"] == state.get("weather")), WEATHER[0]),
        "game_hour": state.get("game_hour", 9),
        "paused": bool(state.get("paused", False)),
        "residents": residents,
        "relationships": [
            {
                "key": key,
                "a": key.split("|")[0],
                "b": key.split("|")[1],
                "value": round(float(entry.get("value", 0)), 2),
                "label": relation_label(float(entry.get("value", 0))),
            }
            for key, entry in (state.get("relationships") or {}).items()
        ],
        "chronicle": list(reversed(state.get("chronicle", [])[-60:])),
        "signatures": [
            {"id": key, **SIGNATURES[key]}
            for key in state.get("signatures", [])
            if key in SIGNATURES
        ],
        "signature_catalog": [
            {"id": key, **info} for key, info in SIGNATURES.items()
        ],
        "pending_dilemma": _dilemma_public(state.get("pending_dilemma")),
        "anomaly_visible": bool(state.get("anomaly_visible")),
        "anomaly": C.ANOMALY,
        "ending": state.get("ending"),
        "score": score_of(state),
        "goals_completed": goals_completed(state),
        "goals_total": goals_total(state),
        "history": state.get("history", []),
        "interventions_used": state.get("interventions_used", []),
        "updated_at": state.get("updated_at"),
        "created_at": state.get("created_at"),
    }


def _dilemma_public(pending: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not pending:
        return None
    definition = next((d for d in C.DILEMMAS if d["id"] == pending.get("id")), None)
    if not definition:
        return None
    return {
        "id": definition["id"],
        "chapter_min": definition["chapter_min"],
        "prompt": definition["prompt"],
        "cycle": pending.get("cycle"),
        "choices": [
            {"id": c["id"], "label": c["label"], "hint": c["hint"]} for c in definition["choices"]
        ],
    }


def public_interventions(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    chapter = int(state.get("chapter", 1))
    flux = float(state.get("flux", 0))
    output = []
    for definition in C.INTERVENTIONS:
        unlocked = chapter >= int(definition.get("chapter_min", 1))
        output.append(
            {
                "id": definition["id"],
                "label": definition["label"],
                "description": definition["description"],
                "icon": definition["icon"],
                "cost": definition["cost"],
                "target": definition["target"],
                "chapter_min": definition["chapter_min"],
                "unlocked": unlocked,
                "affordable": flux >= float(definition.get("cost", 0)),
            }
        )
    return output


def location_action_preview(location: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Which families a location can actually satisfy (used by the client UI)."""
    return [
        {"id": fam["id"], "label": fam["label"], "icon": fam.get("icon", "🌀"), "tags": fam.get("tags", [])}
        for fam in _location_affordances(location)
    ]
