"""The engine promises a reproducible world, in any process.

Two real bugs found during the audit lived here: a fallback home taken from set
iteration order, and chronicle ids built from ``hash()``. Both produced a
different world on every run (Python salts string hashes per process), which made
the suite pass or fail depending on the interpreter's hash seed.

The only way to catch that class of bug is to replay the same iteration in
separate processes with different ``PYTHONHASHSEED`` values and compare the
result byte for byte.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from arcadia import engine

BACKEND_DIR = Path(__file__).resolve().parents[1]

LOCATIONS = [
    {"id": "cafe", "name": "Café", "type": "cafe", "available_actions": ["drink_coffee", "eat_croissant", "chat_with_others"]},
    {
        "id": "apartment",
        "name": "Appartement",
        "type": "apartment",
        # Deliberately missing some residents' homes, so the fallback placement
        # rule is exercised too.
        "available_actions": ["sleep", "cook_meal", "take_shower", "use_toilet"],
    },
    {"id": "gym", "name": "Salle", "type": "gym", "available_actions": ["lift_weights", "cardio", "swim"]},
    {"id": "studio", "name": "Studio", "type": "studio", "available_actions": ["photo_shoot", "record_music", "study", "network"]},
]

# Run as: python -c SNIPPET <backend_dir> <locations_json>
SNIPPET = """
import json
import sys

backend_dir, locations = sys.argv[1], json.loads(sys.argv[2])
sys.path.insert(0, backend_dir)

from arcadia import engine


def strip_timestamps(value):
    if isinstance(value, dict):
        kept = {}
        for key in sorted(value):
            if key in ("created_at", "updated_at"):
                continue
            kept[key] = strip_timestamps(value[key])
        return kept
    if isinstance(value, list):
        return [strip_timestamps(item) for item in value]
    return value


state = engine.new_state(locations)
for _ in range(8):
    state, report = engine.advance_cycle(state, locations)
    if state.get("ending"):
        break

print(json.dumps(strip_timestamps(engine.public_state(state)), sort_keys=True, ensure_ascii=False))
"""


def replay(hash_seed: str) -> str:
    """Play the same iteration in a fresh process with a fixed hash seed."""
    env = dict(os.environ)
    env["PYTHONHASHSEED"] = hash_seed
    env["PYTHONIOENCODING"] = "utf-8"
    completed = subprocess.run(
        [sys.executable, "-c", SNIPPET, str(BACKEND_DIR), json.dumps(LOCATIONS)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
        cwd=str(BACKEND_DIR),
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    return completed.stdout.strip()


@pytest.fixture(scope="module")
def replays():
    return {seed: replay(seed) for seed in ("0", "1", "12345")}


class TestDeterminism:
    def test_same_iteration_in_every_process(self, replays):
        unique = set(replays.values())
        assert len(unique) == 1, (
            "the same catalogue must produce the same world regardless of the "
            f"interpreter hash seed, got {len(unique)} different worlds"
        )

    def test_fallback_placement_is_deterministic(self):
        first = engine.new_state(LOCATIONS)
        second = engine.new_state(LOCATIONS)
        assert [r["location_id"] for r in first["residents"]] == [
            r["location_id"] for r in second["residents"]
        ]

    def test_chronicle_ids_are_stable(self):
        text = engine.C.t("Bonjour", "Hello")
        one = engine._chronicle_entry(3, "action", "🎨", text, ["res_a"])
        two = engine._chronicle_entry(3, "action", "🎨", text, ["res_a"])
        assert one["id"] == two["id"]
        # A digest, not Python's salted hash().
        assert engine._stable_digest("a", "b") == engine._stable_digest("a", "b")

    def test_reports_have_a_stable_key_order(self):
        state = engine.new_state(LOCATIONS)
        _, first = engine.advance_cycle(state, LOCATIONS)
        state = engine.new_state(LOCATIONS)
        _, second = engine.advance_cycle(state, LOCATIONS)
        assert json.dumps(first["residents"], sort_keys=False) == json.dumps(
            second["residents"], sort_keys=False
        )

    def test_replaying_a_saved_state_gives_the_same_future(self):
        state = engine.new_state(LOCATIONS)
        state, report = engine.advance_cycle(state, LOCATIONS)
        snapshot = json.dumps(state)

        first_state, first_report = engine.advance_cycle(json.loads(snapshot), LOCATIONS)
        second_state, second_report = engine.advance_cycle(json.loads(snapshot), LOCATIONS)
        assert first_report["cycle"] == second_report["cycle"]
        assert json.dumps(first_state["residents"], sort_keys=True) == json.dumps(
            second_state["residents"], sort_keys=True
        )
        assert report["cycle"] == 1
