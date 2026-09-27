"""ARCADIA-9: an original life-simulation game.

Modules
-------
``content``  original world, residents, goals, interventions, dilemmas, text.
``engine``   deterministic simulation: decisions, needs, memory, goals, endings.
``store``    persistence (atomic JSON file, optional MongoDB).
``api``      FastAPI routes for the game, identity and support surfaces.
"""

from . import api, content, engine, store  # noqa: F401

__all__ = ["api", "content", "engine", "store"]
