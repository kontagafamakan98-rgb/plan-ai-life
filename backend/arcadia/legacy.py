"""Adapters between the ARCADIA-9 game state and the API shapes that already
existed in this repository.

The old endpoints (``/api/characters``, ``/api/logs``, ``/api/simulate``) are
still used by the shipped client and by the pre-existing test-suite. Rather than
keeping a second, drifting copy of the world, these helpers project the single
game state into the old shapes.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from . import content as C
from . import engine

_LEGACY_MOOD = {
    "radiant": "Excited",
    "content": "Happy",
    "focused": "Focused",
    "neutral": "Content",
    "tired": "Tired",
    "anxious": "Anxious",
    "upset": "Sad",
    "lost": "Bored",
}


def _english(value: Any, fallback: str = "") -> str:
    if isinstance(value, dict):
        return str(value.get("en") or value.get("fr") or fallback)
    return str(value) if value is not None else fallback


def project_character(
    resident: Dict[str, Any], state: Dict[str, Any], index: int = 0
) -> Dict[str, Any]:
    look = resident.get("look") or {}
    outfit = look.get("outfit") or {}
    needs = {key: float(resident.get("needs", {}).get(key, 100.0)) for key in engine.NEED_KEYS}
    position = resident.get("position") or {"x": 0.5, "y": 0.5}
    action = resident.get("current_action") or {}
    memory = resident.get("memory") or []
    thoughts = [
        _english(entry.get("text"), "…")
        for entry in memory
        if entry.get("kind") == "action"
    ][-10:]
    if not thoughts:
        thoughts = [_english(resident.get("thought"), "…")]

    relations = []
    for key, entry in (state.get("relationships") or {}).items():
        parts = key.split("|")
        if resident["id"] not in parts:
            continue
        other_id = parts[0] if parts[1] == resident["id"] else parts[1]
        other = next(
            (r for r in state.get("residents", []) if r["id"] == other_id), None
        )
        relations.append(
            {
                "id": other_id,
                "name": other["name"] if other else other_id,
                "value": round(float(entry.get("value", 0)), 2),
                "label": engine.relation_label(float(entry.get("value", 0))),
            }
        )
    relations.sort(key=lambda item: item["value"], reverse=True)

    raw_action = action.get("raw") or action.get("id") or "idle"

    return {
        "id": resident["id"],
        "user_id": resident.get("user_id"),
        "name": resident["name"],
        "age": int(resident.get("age", 25)),
        "gender": resident.get("gender", "other"),
        "occupation": _english(resident.get("occupation"), "unemployed"),
        "education": resident.get("education", "none"),
        "bio": _english(resident.get("bio")),
        "avatar_emoji": resident.get("avatar_emoji") or "😊",
        "appearance": {
            "skin_color": look.get("skin") or "#F5D0C5",
            "hair_color": look.get("hair") or "#4A3728",
            "eye_color": look.get("eyes") or "#6B4423",
            "height": int(resident.get("height", 170)),
            "body_type": resident.get("body_type", "average"),
        },
        "attributes": {
            key: round(float(value), 2)
            for key, value in (resident.get("attributes") or {}).items()
        },
        "personality": {
            key: round(float(value), 2)
            for key, value in (resident.get("personality") or {}).items()
        },
        "objectives": [
            goal_id for goal_id in (resident.get("goal_state") or {}).keys()
        ],
        "hobbies": list(resident.get("hobbies") or []),
        "location_id": resident.get("location_id"),
        "position_x": round(float(position.get("x", 0.5)) * 100, 2),
        "position_y": round(float(position.get("y", 0.5)) * 100, 2),
        "target_x": round(float(position.get("x", 0.5)) * 100, 2),
        "target_y": round(float(position.get("y", 0.5)) * 100, 2),
        "is_moving": False,
        "move_speed": 2.0,
        "needs": {key: round(value, 2) for key, value in needs.items()},
        "relationships": relations,
        "family": list(resident.get("family") or []),
        "children": list(resident.get("children") or []),
        "partner_id": resident.get("partner_id"),
        "current_action": raw_action,
        "action_queue": list(resident.get("action_queue") or []),
        "money": round(float(resident.get("money", 0)), 2),
        "mood": _LEGACY_MOOD.get(resident.get("mood", "neutral"), "Content"),
        "thoughts": thoughts,
        "memory": [
            f"[{entry.get('cycle')}] {_english(entry.get('text'))}" for entry in memory[-8:]
        ],
        "is_npc": bool(resident.get("is_npc", True)),
        "lucidity": round(float(resident.get("lucidity", 0)), 2),
        "goal_state": resident.get("goal_state") or {},
        "look": look,
        "outfit": outfit,
        "quote": resident.get("quote"),
        "city": resident.get("city"),
        "home": resident.get("home"),
        "created_at": resident.get("created_at") or state.get("created_at"),
    }


def project_characters(state: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        project_character(resident, state, index)
        for index, resident in enumerate(state.get("residents", []))
    ]


def project_log(entry: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    return {
        "id": entry.get("id") or f"log_{index}",
        "character_id": (entry.get("residents") or [None])[0],
        "character_name": entry.get("resident_name")
        or " ".join(
            (entry.get("text") or {}).get("en", "").split(" ")[:2]
        ).strip("— "),
        "action": _english(entry.get("text")),
        "location": entry.get("location_id") or "—",
        "thought": _english(entry.get("text")),
        "kind": entry.get("kind"),
        "icon": entry.get("icon"),
        "cycle": entry.get("cycle"),
        "timestamp": entry.get("timestamp") or state_timestamp(entry),
    }


def state_timestamp(entry: Dict[str, Any]) -> Optional[str]:
    return entry.get("timestamp")


def project_logs(state: Dict[str, Any], limit: int = 50) -> List[Dict[str, Any]]:
    return [project_log(entry, index) for index, entry in enumerate(state.get("chronicle", []))][
        -limit:
    ][::-1]


def report_to_legacy_results(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The old ``/api/simulate`` result shape, filled from a real cycle report."""
    results = []
    for entry in report.get("residents", []):
        needs = entry.get("needs_delta") or {}
        results.append(
            {
                "character_id": entry.get("id"),
                "name": entry.get("name"),
                "action": _english(entry.get("action", {}).get("label")),
                "thought": _english(entry.get("thought")),
                "mood": _LEGACY_MOOD.get(entry.get("mood", "neutral"), "Content"),
                "location": entry.get("location_id"),
                "position": entry.get("position"),
                "need_changes": needs,
                "reason": _english(entry.get("reason")),
            }
        )
    return results


def interventions_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "id": item["id"],
            "name": _english(item["label"]),
            "description": _english(item["description"]),
        }
        for item in C.INTERVENTIONS
    ]
