"""Balance tests: the game loop has to be *playable*, not just correct.

These assertions encode the design intent rather than exact numbers:

* watching an iteration must still produce visible progress (milestones);
* spending Flux must measurably beat watching (the player has agency);
* an iteration must not be trivially won (no strategy completes everything);
* every iteration must end with one of the four documented endings.

Because the engine is deterministic, these are stable assertions and not a
flaky statistical test.
"""

import pytest

from arcadia import engine

SEEDS = (20260927, 11, 4242, 777)
MAX_CYCLES = engine.MAX_CYCLES


def base_locations():
    """A small but believable catalogue: each place enables different families."""
    return [
        {
            "id": "apartment",
            "name": "Appartement",
            "type": "apartment",
            "available_actions": [
                "sleep",
                "cook_meal",
                "take_shower",
                "use_toilet",
                "study",
                "read_book",
            ],
        },
        {
            "id": "office",
            "name": "Bureau",
            "type": "office",
            "available_actions": ["work", "meeting", "study", "network"],
        },
        {
            "id": "cafe",
            "name": "Café",
            "type": "cafe",
            "available_actions": ["drink_coffee", "eat_croissant", "chat_with_others"],
        },
        {
            "id": "studio",
            "name": "Studio",
            "type": "studio",
            "available_actions": ["photo_shoot", "record_music", "study", "paint", "write"],
        },
        {
            "id": "gym",
            "name": "Salle",
            "type": "gym",
            "available_actions": ["lift_weights", "cardio", "swim", "train"],
        },
        {
            "id": "club",
            "name": "Club",
            "type": "club",
            "available_actions": ["dance", "drink", "meet_friends", "sing"],
        },
        {
            "id": "park",
            "name": "Parc",
            "type": "park",
            "available_actions": ["walk", "jog", "meet_friends", "relax"],
        },
    ]


def playthrough(seed: int, spend_flux: bool) -> dict:
    """Play one full iteration, optionally helping the resident who is closest to a goal."""
    locations = base_locations()
    state = engine.new_state(locations)
    state["seed"] = seed
    spent = 0.0

    for _ in range(MAX_CYCLES + 2):
        if state.get("ending"):
            break
        if spend_flux:
            leader = max(state["residents"], key=engine._goal_progress_total)
            if state["flux"] >= 4:
                try:
                    engine.apply_intervention(state, "faveur", leader["id"])
                    spent += 4
                except engine.GameRuleError:
                    pass
        state, _ = engine.advance_cycle(state, locations)

    completed = sum(
        1
        for resident in state["residents"]
        for goal in resident["goal_state"].values()
        if goal.get("complete")
    )
    milestones = sum(
        1
        for resident in state["residents"]
        for goal in resident["goal_state"].values()
        for reached in goal["milestones"]
        if reached
    )
    ending = state.get("ending") or {}
    return {
        "completed": completed,
        "milestones": milestones,
        "ending": ending.get("id"),
        "score": ending.get("score", 0),
        "spent": spent,
        "residents": len(state["residents"]),
        "goals_total": sum(len(resident["goal_state"]) for resident in state["residents"]),
    }


@pytest.fixture(scope="module")
def watch_runs():
    return {seed: playthrough(seed, spend_flux=False) for seed in SEEDS}


@pytest.fixture(scope="module")
def helped_runs():
    return {seed: playthrough(seed, spend_flux=True) for seed in SEEDS}


class TestPacing:
    def test_an_iteration_runs_its_full_length(self, watch_runs):
        for result in watch_runs.values():
            assert result["ending"], "an iteration must reach an ending on its own"

    def test_goals_are_reachable_without_help(self, watch_runs):
        """A goal must not be a decoration: milestones fall on their own."""
        for seed, result in watch_runs.items():
            assert result["milestones"] >= 12, f"seed {seed} produced no visible progress"
        total = sum(result["completed"] for result in watch_runs.values())
        assert total >= len(SEEDS), "watching should still complete a few goals"

    def test_caring_for_someone_measurably_helps(self, watch_runs, helped_runs):
        watched = sum(result["completed"] for result in watch_runs.values())
        helped = sum(result["completed"] for result in helped_runs.values())
        assert helped > watched, (
            "spending Flux on a resident's goal must be worth it: "
            f"watched={watched} helped={helped}"
        )

    def test_flux_is_actually_spent(self, helped_runs):
        for result in helped_runs.values():
            assert result["spent"] > 40, "a caring player should be able to spend Flux"

    def test_the_iteration_is_not_trivially_won(self, watch_runs, helped_runs):
        for result in list(watch_runs.values()) + list(helped_runs.values()):
            assert result["goals_total"] >= 6
            assert result["completed"] < result["goals_total"], (
                "a perfect sweep would remove the tension"
            )

    def test_every_iteration_ends_with_a_known_ending(self, watch_runs, helped_runs):
        known = {"control", "awakening", "drift", "silence"}
        for result in list(watch_runs.values()) + list(helped_runs.values()):
            assert result["ending"] in known

    def test_score_rewards_progress(self, watch_runs, helped_runs):
        for result in list(watch_runs.values()) + list(helped_runs.values()):
            assert result["score"] > 0
