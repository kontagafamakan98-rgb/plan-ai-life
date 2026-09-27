"""HTTP surface for ARCADIA-9.

Kept in its own module so ``server.py`` stays thin and this router stays
testable on its own. The router is created by ``create_game_router(db, ...)`` so
it never has to import the application module (no circular imports).

Every endpoint here is genuinely wired: there is no stub that returns 200 and
does nothing.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import content as C
from . import engine

logger = logging.getLogger(__name__)

GAME_STATE_ID = "main"

# Transparent, non-predatory support offers.
# Nothing in the core loop is gated behind these; the copy states plainly what an
# offer does and does not do, and payments are switched off in this build.
SUPPORT_OFFERS: List[Dict[str, Any]] = [
    {
        "id": "palette_veilleur",
        "kind": "cosmetic",
        "name": C.t("Palette du Veilleur", "Watcher's palette"),
        "description": C.t(
            "Trois jeux de couleurs alternatifs pour les habitants et les décors.",
            "Three alternative colour sets for residents and scenery.",
        ),
        "price_display": "3,99 €",
        "one_time": True,
        "grants": C.t(
            "Uniquement de l'apparence.",
            "Appearance only.",
        ),
        "never_grants": C.t(
            "Aucun avantage de jeu, aucun objectif, aucun cycle supplémentaire.",
            "No gameplay advantage, no goals, no extra cycles.",
        ),
        "payments_enabled": False,
    },
    {
        "id": "archives",
        "kind": "content",
        "name": C.t("Les Archives", "The Archives"),
        "description": C.t(
            "Textes étendus du codex : notes du Veilleur précédent et une fin "
            "supplémentaire, purement narrative.",
            "Extended codex texts: the previous Watcher's notes and one extra "
            "ending, purely narrative.",
        ),
        "price_display": "4,99 €",
        "one_time": True,
        "grants": C.t(
            "Lecture seule : du texte, une fin en plus.",
            "Read-only: text, and one additional ending.",
        ),
        "never_grants": C.t(
            "Aucun avantage, aucune ressource, aucune exclusion des autres joueurs.",
            "No advantage, no resources, nothing taken away from other players.",
        ),
        "payments_enabled": False,
    },
    {
        "id": "soutien",
        "kind": "tip",
        "name": C.t("Soutenir l'itération", "Support the iteration"),
        "description": C.t(
            "Un pourboire unique. Il ne débloque rien : c'est écrit ici pour que "
            "vous ne le découvriez pas après.",
            "A one-off tip. It unlocks nothing: that is written here so you don't "
            "find out afterwards.",
        ),
        "price_display": "libre",
        "one_time": True,
        "grants": C.t("Rien d'autre que notre reconnaissance.", "Nothing but our thanks."),
        "never_grants": C.t(
            "Aucun contenu, aucun avantage, aucun remerciement in-game.",
            "No content, no advantage, no in-game reward.",
        ),
        "payments_enabled": False,
    },
]

MONETIZATION_PRINCIPLES = C.t(
    "Règles que ce jeu s'impose : aucun paiement pour progresser, aucune monnaie "
    "premium, aucune boîte surprise, aucune limite d'énergie artificielle, aucun "
    "compte à rebours, aucune publicité. Les offres ci-dessus sont esthétiques ou "
    "documentaires, et les achats sont désactivés dans cette version.",
    "Rules this game imposes on itself: no paying to progress, no premium "
    "currency, no loot boxes, no artificial energy limits, no countdowns, no ads. "
    "The offers above are cosmetic or documentary, and purchasing is disabled in "
    "this build.",
)


class InterventionRequest(BaseModel):
    id: str
    target_id: Optional[str] = None
    second_target_id: Optional[str] = None


class DilemmaRequest(BaseModel):
    dilemma_id: str
    choice_id: str


class LoadRequest(BaseModel):
    state: Dict[str, Any] = Field(default_factory=dict)


class PauseRequest(BaseModel):
    paused: Optional[bool] = None


async def _load_locations(db, provider) -> List[Dict[str, Any]]:
    try:
        rows = await db.locations.find().to_list(500)
    except Exception:  # pragma: no cover - defensive
        rows = []
    if not rows:
        rows = list(provider())
    rows.sort(key=lambda loc: str(loc.get("id")))
    return rows


async def _get_state(db) -> Dict[str, Any]:
    return await db.game_state.find_one({"id": GAME_STATE_ID})


async def _save_state(db, state: Dict[str, Any]) -> None:
    await db.game_state.update_one({"id": GAME_STATE_ID}, {"$set": state}, upsert=True)


async def _state_or_create(db, provider) -> Dict[str, Any]:
    state = await _get_state(db)
    if state:
        state.pop("_id", None)
        # Legacy saves may predate a content update: heal missing keys instead of
        # crashing on a KeyError deep inside the engine.
        _ensure_shape(state)
        return state
    locations = await _load_locations(db, provider)
    state = engine.new_state(locations)
    await _save_state(db, state)
    return state


def _ensure_shape(state: Dict[str, Any]) -> None:
    state.setdefault("paused", False)
    state.setdefault("chronicle", [])
    state.setdefault("relationships", {})
    state.setdefault("signatures", [])
    state.setdefault("history", [])
    state.setdefault("interventions_used", [])
    state.setdefault("dilemmas_seen", [])
    state.setdefault("lucidity_mod", 0.0)
    state.setdefault("cycles_since_intervention", 0)
    state.setdefault("anomaly_visible", False)
    state.setdefault("ending", None)
    state.setdefault("weather", "clear")
    state.setdefault("game_hour", 9)
    state.setdefault("max_cycles", engine.MAX_CYCLES)
    for resident in state.get("residents", []):
        resident.setdefault("memory", [])
        resident.setdefault("goal_state", {})
        resident.setdefault("needs", {})
        resident.setdefault("refusals", 0)
        for key in engine.NEED_KEYS:
            resident["needs"].setdefault(key, 100.0)


def create_game_router(db, locations_provider: Callable[[], List[Dict[str, Any]]]) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/identity")
    async def get_identity():
        """Brand, goals, interventions and endings — one call for the codex."""
        return {
            "brand": C.BRAND,
            "goals": [
                {
                    "id": goal_id,
                    "label": goal["label"],
                    "milestones": goal["milestones"],
                    "tags": goal["tags"],
                }
                for goal_id, goal in C.GOALS.items()
            ],
            "interventions": [
                {
                    "id": item["id"],
                    "label": item["label"],
                    "description": item["description"],
                    "icon": item["icon"],
                    "cost": item["cost"],
                    "target": item["target"],
                    "chapter_min": item["chapter_min"],
                }
                for item in C.INTERVENTIONS
            ],
            "signatures": [{"id": key, **info} for key, info in engine.SIGNATURES.items()],
            "endings": [
                {"id": key, "title": value["title"], "unlocked_hint": None}
                for key, value in C.ENDINGS.items()
            ],
            "anomaly": C.ANOMALY,
            "moods": [
                {"id": key, "label": value["label"], "color": value["color"], "icon": value["icon"]}
                for key, value in engine.MOODS.items()
            ],
            "monetization": {
                "principles": MONETIZATION_PRINCIPLES,
                "offers": SUPPORT_OFFERS,
                "payments_enabled": False,
            },
        }

    @router.get("/game/state")
    async def get_game_state():
        state = await _state_or_create(db, locations_provider)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return public

    @router.post("/game/cycle")
    async def post_cycle():
        state = await _state_or_create(db, locations_provider)
        locations = await _load_locations(db, locations_provider)
        try:
            state, report = engine.advance_cycle(state, locations)
        except engine.GameRuleError as exc:
            raise HTTPException(status_code=409, detail=str(exc))
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"report": report, "state": public}

    @router.post("/game/pause")
    async def post_pause(payload: PauseRequest | None = None):
        """Freeze or resume the iteration.

        Setting the value explicitly keeps the call idempotent: sending the same
        flag twice cannot accidentally flip the world back on. Omitting the body
        toggles, which is what the older client expected.
        """
        state = await _state_or_create(db, locations_provider)
        current = bool(state.get("paused", False))
        wanted = (not current) if (payload is None or payload.paused is None) else bool(payload.paused)
        state["paused"] = wanted
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"paused": wanted, "is_paused": wanted, "state": public}

    @router.post("/game/intervention")
    async def post_intervention(payload: InterventionRequest):
        state = await _state_or_create(db, locations_provider)
        try:
            result = engine.apply_intervention(
                state, payload.id, payload.target_id, payload.second_target_id
            )
        except engine.GameRuleError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"result": result, "state": public}

    @router.post("/game/dilemma")
    async def post_dilemma(payload: DilemmaRequest):
        state = await _state_or_create(db, locations_provider)
        try:
            result = engine.apply_dilemma_choice(state, payload.dilemma_id, payload.choice_id)
        except engine.GameRuleError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"result": result, "state": public}

    @router.post("/game/reset")
    async def post_reset():
        locations = await _load_locations(db, locations_provider)
        state = engine.new_state(locations)
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"status": "reset", "state": public}

    @router.get("/game/save")
    async def get_save():
        """Export the whole iteration so progress can be kept or moved."""
        state = await _state_or_create(db, locations_provider)
        return {
            "format": "arcadia-9/save",
            "version": 1,
            "state": state,
        }

    @router.post("/game/load")
    async def post_load(payload: LoadRequest):
        incoming = payload.state or {}
        residents = incoming.get("residents")
        if not isinstance(residents, list) or not residents:
            raise HTTPException(status_code=400, detail="Sauvegarde invalide : aucun habitant.")
        for resident in residents:
            if not isinstance(resident, dict) or "id" not in resident:
                raise HTTPException(
                    status_code=400, detail="Sauvegarde invalide : habitant malformé."
                )
        state = dict(incoming)
        state["id"] = GAME_STATE_ID
        _ensure_shape(state)
        await _save_state(db, state)
        public = engine.public_state(state)
        public["interventions"] = engine.public_interventions(state)
        return {"status": "loaded", "state": public}

    @router.get("/game/ending")
    async def get_ending():
        state = await _state_or_create(db, locations_provider)
        return {"ending": state.get("ending"), "score": engine.score_of(state)}

    @router.get("/locations/{location_id}/actions")
    async def get_location_actions(location_id: str):
        locations = await _load_locations(db, locations_provider)
        location = next((loc for loc in locations if loc.get("id") == location_id), None)
        if not location:
            raise HTTPException(status_code=404, detail="Lieu inconnu.")
        return {"location_id": location_id, "families": engine.location_action_preview(location)}

    return router


def create_support_router() -> APIRouter:
    """Monetisation surface. Deliberately separate from the game router."""
    router = APIRouter(prefix="/api")

    @router.get("/support/offers")
    async def get_offers():
        return {
            "principles": MONETIZATION_PRINCIPLES,
            "offers": SUPPORT_OFFERS,
            "payments_enabled": False,
            "note": C.t(
                "Aucun paiement réel n'est possible dans cette version. Les prix "
                "affichés sont des exemples.",
                "No real payment is possible in this build. Displayed prices are "
                "examples.",
            ),
        }

    return router
