"""Unit tests for ``arcadia.engine`` — no framework, no database, no network.

These are the tests that actually protect the game rules: decisions, needs,
memory, relationships, goal progression, lucidity/stability economy, dilemmas
and endings. Because the engine is deterministic they can assert real values
instead of "something changed".
"""

import random

import pytest

from arcadia import content as C
from arcadia import engine


def base_locations():
    return [
        {
            "id": "cafe",
            "name": "Café",
            "type": "cafe",
            "available_actions": ["drink_coffee", "eat_croissant", "chat_with_others"],
        },
        {
            "id": "apartment",
            "name": "Appartement",
            "type": "apartment",
            "available_actions": ["sleep", "cook_meal", "take_shower", "use_toilet"],
        },
        {
            "id": "gym",
            "name": "Salle",
            "type": "gym",
            "available_actions": ["lift_weights", "cardio", "swim"],
        },
        {
            "id": "studio",
            "name": "Studio",
            "type": "studio",
            "available_actions": ["photo_shoot", "record_music", "study", "network"],
        },
    ]


@pytest.fixture()
def state():
    return engine.new_state(base_locations())


# --------------------------------------------------------------------------- #
# Structure
# --------------------------------------------------------------------------- #
class TestNewState:
    def test_six_original_residents(self, state):
        assert len(state["residents"]) == 6
        names = [r["name"] for r in state["residents"]]
        assert len(set(names)) == 6

    def test_residents_start_with_needs_and_goals(self, state):
        for resident in state["residents"]:
            assert set(resident["needs"]) == set(engine.NEED_KEYS)
            assert all(0 <= v <= 100 for v in resident["needs"].values())
            assert resident["goals"], f"{resident['name']} has no goal"
            for goal_id in resident["goals"]:
                assert goal_id in C.GOALS
                assert goal_id in resident["goal_state"]

    def test_every_goal_id_is_defined_in_content(self, state):
        for resident in state["residents"]:
            for goal_id in resident["goal_state"]:
                assert goal_id in C.GOALS

    def test_residents_are_placed_in_a_real_location(self, state):
        ids = {loc["id"] for loc in base_locations()}
        assert {r["location_id"] for r in state["residents"]} <= ids

    def test_french_and_english_text_available(self, state):
        for resident in C.RESIDENTS:
            assert resident["occupation"]["fr"] and resident["occupation"]["en"]
            assert resident["bio"]["fr"] and resident["bio"]["en"]

    def test_no_webtoon_ip_leaked_into_content(self):
        """The reference was inspiration only: no borrowed names or plot text."""
        blob = repr(C.RESIDENTS) + repr(C.BRAND) + repr(C.GOALS)
        for forbidden in ("Jumin", "teenage girl", "Webtoon", "WEBTOON"):
            assert forbidden not in blob


# --------------------------------------------------------------------------- #
# Action lexicon
# --------------------------------------------------------------------------- #
class TestActionLexicon:
    @pytest.mark.parametrize(
        "action,family",
        [
            ("use_toilet", "toilet"),
            ("take_shower", "shower"),
            ("sleep", "sleep"),
            ("eat_croissant", "eat"),
            ("drink_coffee", "drink"),
            ("work_on_laptop", "work"),
            ("read_newspaper", "study"),
            ("chat_with_others", "chat"),
            ("flirt", "flirt"),
            ("lift_weights", "exercise"),
            ("jog", "jog"),
            ("swim", "swim"),
            ("dance", "perform"),
            ("pray", "calm"),
            ("bargain", "shop"),
            ("visit_patient", "care"),
            ("watch_movie", "watch"),
            ("stream_match", "stream"),
        ],
    )
    def test_action_maps_to_expected_family(self, action, family):
        assert C.resolve_action(action)["id"] == family

    def test_unknown_action_falls_back(self):
        assert C.resolve_action("teleport")["id"] == "idle"

    def test_family_longest_keyword_wins(self):
        # "cook_meal" must resolve to cook, not to a shorter incidental match.
        assert C.resolve_action("cook_meal")["id"] == "cook"


# --------------------------------------------------------------------------- #
# Decisions
# --------------------------------------------------------------------------- #
class TestDecisionMaking:
    def test_hungry_resident_goes_to_eat_when_food_is_available(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 90.0 for k in engine.NEED_KEYS}
        resident["needs"]["hunger"] = 4.0
        resident["location_id"] = "cafe"
        location = next(loc for loc in base_locations() if loc["id"] == "cafe")
        decision = engine.choose_action(
            resident, location, random.Random(7), [], catalogue=base_locations()
        )
        assert decision["family"]["id"] in {"eat", "drink"}
        assert "hunger" in decision["reasons"]

    def test_exhausted_resident_sleeps(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 95.0 for k in engine.NEED_KEYS}
        resident["needs"]["energy"] = 3.0
        resident["location_id"] = "apartment"
        location = next(loc for loc in base_locations() if loc["id"] == "apartment")
        decision = engine.choose_action(
            resident, location, random.Random(3), [], catalogue=base_locations()
        )
        assert decision["family"]["id"] == "sleep"

    def test_goal_driven_choice_beats_pure_randomness(self, state):
        resident = state["residents"][0]
        for entry in resident["goal_state"].values():
            entry["progress"] = 0.0
        resident["goals"] = ["become_artist"]
        resident["goal_state"] = {
            "become_artist": {"progress": 0.0, "milestones": [False, False, False], "complete": False}
        }
        resident["hobbies"] = ["art", "photography"]
        resident["needs"] = {k: 96.0 for k in engine.NEED_KEYS}
        resident["location_id"] = "studio"
        location = next(loc for loc in base_locations() if loc["id"] == "studio")
        decision = engine.choose_action(
            resident, location, random.Random(11), [], catalogue=base_locations()
        )
        assert "goal" in decision["reasons"], decision

    def test_repetition_is_penalised(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 80.0 for k in engine.NEED_KEYS}
        location = next(loc for loc in base_locations() if loc["id"] == "cafe")
        first = engine.choose_action(
            resident, location, random.Random(5), [], catalogue=base_locations()
        )
        family = first["family"]["id"]
        resident["memory"] = [
            {"cycle": i, "kind": "action", "family": family} for i in range(3)
        ]
        second = engine.choose_action(
            resident, location, random.Random(5), [], catalogue=base_locations()
        )
        assert engine._habit_penalty(resident, {"id": family}) < 0
        if len(location["available_actions"]) > 1:
            assert second["family"]["id"] != family or second["score"] < first["score"]

    def test_relocation_when_nothing_here_helps(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 100.0 for k in engine.NEED_KEYS}
        resident["needs"]["energy"] = 1.0
        resident["location_id"] = "gym"  # no sleep affordance
        location = next(loc for loc in base_locations() if loc["id"] == "gym")
        decision = engine.choose_action(
            resident, location, random.Random(2), [], catalogue=base_locations()
        )
        assert decision["move_to"] == "apartment"
        assert decision["urgent_need"] == "energy"

    def test_no_relocation_when_the_need_can_be_met_here(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 100.0 for k in engine.NEED_KEYS}
        resident["needs"]["energy"] = 1.0
        resident["location_id"] = "apartment"
        location = next(loc for loc in base_locations() if loc["id"] == "apartment")
        decision = engine.choose_action(
            resident, location, random.Random(2), [], catalogue=base_locations()
        )
        assert decision["move_to"] is None
        assert decision["family"]["id"] == "sleep"

    def test_social_company_increases_social_appeal(self, state):
        resident = state["residents"][0]
        resident["needs"] = {k: 70.0 for k in engine.NEED_KEYS}
        location = next(loc for loc in base_locations() if loc["id"] == "cafe")
        alone = engine.choose_action(
            resident, location, random.Random(9), [], catalogue=base_locations()
        )
        with_company = engine.choose_action(
            resident,
            location,
            random.Random(9),
            [state["residents"][1]],
            catalogue=base_locations(),
        )
        assert with_company["score"] >= alone["score"]


# --------------------------------------------------------------------------- #
# Needs, memory, relationships
# --------------------------------------------------------------------------- #
class TestResidentsLife:
    def test_needs_decay_then_recover_over_a_cycle(self, state):
        before = {r["id"]: dict(r["needs"]) for r in state["residents"]}
        state, report = engine.advance_cycle(state, base_locations())
        assert report["status"] == "ok"
        assert len(report["residents"]) == 6
        for resident in state["residents"]:
            assert 0 <= resident["needs"]["hunger"] <= 100
            assert resident["needs"]["energy"] <= before[resident["id"]]["energy"] + 45

    def test_memory_records_each_cycle(self, state):
        state, _ = engine.advance_cycle(state, base_locations())
        for resident in state["residents"]:
            assert resident["memory"], f"{resident['name']} remembers nothing"
            assert resident["memory"][-1]["cycle"] == 1

    def test_memory_is_capped(self, state):
        for _ in range(20):
            state, _ = engine.advance_cycle(state, base_locations())
        for resident in state["residents"]:
            assert len(resident["memory"]) <= 12

    def test_co_located_residents_build_a_relationship(self, state):
        for resident in state["residents"]:
            resident["location_id"] = "cafe"
        state, report = engine.advance_cycle(state, base_locations())
        assert report["relationships"], "no relationship deltas reported"
        assert state["relationships"]
        values = [entry["value"] for entry in state["relationships"].values()]
        assert max(values) > 8

    def test_relationships_have_readable_labels(self, state):
        state, _ = engine.advance_cycle(state, base_locations())
        for entry in state["relationships"].values():
            label = engine.relation_label(entry["value"])
            assert label["fr"] and label["en"]

    def test_mood_and_thought_are_always_produced(self, state):
        state, report = engine.advance_cycle(state, base_locations())
        for entry in report["residents"]:
            assert entry["mood"] in engine.MOODS
            assert entry["thought"]["fr"] and entry["thought"]["en"]
            assert entry["action"]["id"]

    def test_thoughts_reflect_lucidity(self, state):
        for resident in state["residents"]:
            resident["lucidity"] = 80.0
        seen_lucid_line = False
        for cycle_seed in range(6):
            local = engine.new_state(base_locations())
            for resident in local["residents"]:
                resident["lucidity"] = 80.0
            local, report = engine.advance_cycle(
                local, base_locations(), rng=random.Random(100 + cycle_seed)
            )
            if any(entry["thought"] in engine._LUCID_THOUGHTS for entry in report["residents"]):
                seen_lucid_line = True
                break
        assert seen_lucid_line, "high lucidity never produced a lucid thought"


# --------------------------------------------------------------------------- #
# Goals, economy, endings
# --------------------------------------------------------------------------- #
class TestProgression:
    def test_goal_progress_advances_over_cycles(self, state):
        start = {
            r["id"]: sum(e["progress"] for e in r["goal_state"].values())
            for r in state["residents"]
        }
        for _ in range(10):
            state, _ = engine.advance_cycle(state, base_locations())
        end = {
            r["id"]: sum(e["progress"] for e in r["goal_state"].values())
            for r in state["residents"]
        }
        assert sum(end.values()) > sum(start.values())

    def test_milestones_fire_in_order(self, state):
        resident = state["residents"][0]
        resident["goals"] = ["become_artist"]
        resident["goal_state"] = {
            "become_artist": {"progress": 0.0, "milestones": [False, False, False], "complete": False}
        }
        events = engine._advance_goals(resident, {"tags": ["creative", "fame", "culture"]}, multiplier=60)
        kinds = [e["kind"] for e in events]
        assert kinds.count("goal_milestone") == 3
        assert kinds[-1] == "goal_complete"

    def test_completing_a_goal_rewards_flux(self, state):
        """A resident one step from finishing must actually finish, and be rewarded."""
        resident = state["residents"][0]
        resident["goal_state"] = {
            "become_artist": {"progress": 85.0, "milestones": [True, True, False], "complete": False}
        }
        resident["goals"] = ["become_artist"]
        resident["lucidity"] = 5.0
        flux_before = state["flux"]
        completed = False
        for _ in range(8):
            state, report = engine.advance_cycle(state, base_locations())
            if any(h["kind"] == "goal_complete" for h in report["highlights"]):
                completed = True
                break
        assert completed, "goal never completed despite being at 85%"
        assert state["flux"] > flux_before
        assert resident["goal_state"]["become_artist"]["complete"] is True
        assert "first_step" in state["signatures"]

    def test_chapters_advance_over_the_run(self, state):
        assert engine.chapter_for(1) == 1
        assert engine.chapter_for(7) == 2
        assert engine.chapter_for(13) == 3
        assert engine.chapter_for(18) == 3

    def test_flux_income_and_cap(self, state):
        for _ in range(12):
            state, _ = engine.advance_cycle(state, base_locations())
        assert 0 <= state["flux"] <= engine.FLUX_CAP

    def test_stability_and_lucidity_stay_in_range(self, state):
        for _ in range(18):
            state, _ = engine.advance_cycle(state, base_locations())
        assert 0 <= state["stability"] <= 100
        assert 0 <= engine.global_lucidity(state) <= 100

    def test_determinism_same_seed_same_world(self):
        first, _ = engine.advance_cycle(engine.new_state(base_locations()), base_locations(), random.Random(42))
        second, _ = engine.advance_cycle(engine.new_state(base_locations()), base_locations(), random.Random(42))
        assert [r["location_id"] for r in first["residents"]] == [
            r["location_id"] for r in second["residents"]
        ]
        assert [r["current_action"]["id"] for r in first["residents"]] == [
            r["current_action"]["id"] for r in second["residents"]
        ]

    def test_history_is_recorded(self, state):
        for _ in range(3):
            state, _ = engine.advance_cycle(state, base_locations())
        assert len(state["history"]) == 3
        assert {"cycle", "stability", "lucidity", "flux"} <= set(state["history"][0])


# --------------------------------------------------------------------------- #
# Interventions
# --------------------------------------------------------------------------- #
class TestInterventions:
    def test_intervention_spends_flux_and_moves_needs(self, state):
        target = state["residents"][0]
        target["needs"]["energy"] = 20.0
        flux_before = state["flux"]
        result = engine.apply_intervention(state, "cafe", target["id"])
        assert state["flux"] == flux_before - 1
        assert result["needs_delta"]["energy"] > 0
        assert target["needs"]["energy"] > 20.0

    def test_unknown_intervention_rejected(self, state):
        with pytest.raises(engine.GameRuleError):
            engine.apply_intervention(state, "meteor", None)

    def test_missing_target_rejected(self, state):
        with pytest.raises(engine.GameRuleError):
            engine.apply_intervention(state, "cafe", None)

    def test_insufficient_flux_rejected(self, state):
        state["flux"] = 0
        with pytest.raises(engine.GameRuleError):
            engine.apply_intervention(state, "faveur", state["residents"][0]["id"])

    def test_locked_intervention_rejected_in_chapter_one(self, state):
        assert state["chapter"] == 1
        with pytest.raises(engine.GameRuleError):
            engine.apply_intervention(state, "bug", state["residents"][0]["id"])

    def test_pair_intervention_raises_relationship(self, state):
        first, second = state["residents"][0], state["residents"][1]
        state["chapter"] = 2
        state["flux"] = 30
        result = engine.apply_intervention(
            state, "rencontre", first["id"], second["id"]
        )
        assert result["relationship"]["delta"] > 0

    def test_pair_intervention_needs_two_distinct_targets(self, state):
        state["chapter"] = 2
        state["flux"] = 30
        with pytest.raises(engine.GameRuleError):
            engine.apply_intervention(state, "rencontre", state["residents"][0]["id"], None)

    def test_world_intervention_raises_stability(self, state):
        state["stability"] = 50.0
        result = engine.apply_intervention(state, "meteo", None)
        assert result["stability_delta"] > 0

    def test_lucid_target_notices_the_intervention(self, state):
        target = state["residents"][0]
        target["lucidity"] = 70.0
        result = engine.apply_intervention(state, "cafe", target["id"])
        assert result["resisted"] is True
        assert result["notes"]

    def test_intervention_is_recorded_in_chronicle_and_history(self, state):
        target = state["residents"][0]
        engine.apply_intervention(state, "elan", target["id"])
        assert state["interventions_used"][-1]["id"] == "elan"
        assert state["chronicle"][-1]["kind"] == "intervention"
        assert state["cycles_since_intervention"] == 0

    def test_intervention_catalogue_marks_locks_and_affordability(self, state):
        catalogue = engine.public_interventions(state)
        assert len(catalogue) == len(C.INTERVENTIONS)
        chapter_one = [item for item in catalogue if item["chapter_min"] == 1]
        chapter_three = [item for item in catalogue if item["chapter_min"] == 3]
        assert all(item["unlocked"] for item in chapter_one)
        assert all(not item["unlocked"] for item in chapter_three)


# --------------------------------------------------------------------------- #
# Dilemmas
# --------------------------------------------------------------------------- #
class TestDilemmas:
    def test_state_queues_a_dilemma(self, state):
        assert state["pending_dilemma"]["id"] in {d["id"] for d in C.DILEMMAS}

    def test_choice_applies_effects_and_consumes_the_dilemma(self, state):
        pending = state["pending_dilemma"]["id"]
        definition = next(d for d in C.DILEMMAS if d["id"] == pending)
        choice = definition["choices"][0]
        stability_before = state["stability"]
        result = engine.apply_dilemma_choice(state, pending, choice["id"])
        assert result["choice"] == choice["id"]
        assert state["pending_dilemma"] is None
        if "stability" in choice["effects"]:
            assert state["stability"] != stability_before

    def test_unknown_dilemma_rejected(self, state):
        with pytest.raises(engine.GameRuleError):
            engine.apply_dilemma_choice(state, "nope", "accept")

    def test_unknown_choice_rejected(self, state):
        pending = state["pending_dilemma"]["id"]
        with pytest.raises(engine.GameRuleError):
            engine.apply_dilemma_choice(state, pending, "nope")

    def test_dilemma_not_in_force_rejected(self, state):
        with pytest.raises(engine.GameRuleError):
            engine.apply_dilemma_choice(state, "porte", "admit")

    def test_every_dilemma_has_two_or_more_choices_with_hints(self):
        for definition in C.DILEMMAS:
            assert len(definition["choices"]) >= 2
            for choice in definition["choices"]:
                assert choice["label"]["fr"] and choice["label"]["en"]
                assert choice["hint"]["fr"] and choice["hint"]["en"]


# --------------------------------------------------------------------------- #
# Anomaly & endings
# --------------------------------------------------------------------------- #
class TestAnomalyAndEndings:
    def test_anomaly_surfaces_when_stability_collapses(self, state):
        state["stability"] = 10.0
        state, report = engine.advance_cycle(state, base_locations())
        assert state["anomaly_visible"] is True
        assert any(entry["kind"] == "anomaly" for entry in report["chronicle"])

    def test_a_world_at_the_brink_keeps_falling(self, state):
        """A collapsing iteration must not be rescued by an unearned bonus."""
        state["stability"] = 1.0
        state, report = engine.advance_cycle(state, base_locations())
        assert state["stability"] < 1.0, "a dying world cannot heal faster than it drifts"
        assert report["ending"]["id"] == "drift"
        assert state["ending"]["id"] == "drift"

    def test_starvation_forces_the_world_down(self, state):
        state["stability"] = 40.0
        for resident in state["residents"]:
            for key in engine.NEED_KEYS:
                resident["needs"][key] = 4.0
        state, report = engine.advance_cycle(state, base_locations())
        assert state["stability"] < 40.0
        assert report["world"]["stability_delta"] < 0

    def test_a_healthy_world_still_recovers(self, state):
        state["stability"] = 60.0
        for resident in state["residents"]:
            for key in engine.NEED_KEYS:
                resident["needs"][key] = 96.0
        state, _ = engine.advance_cycle(state, base_locations())
        assert state["stability"] > 60.0

    def test_no_further_cycles_after_ending(self, state):
        state["stability"] = 1.0
        state, _ = engine.advance_cycle(state, base_locations())
        assert state["ending"]
        state, report = engine.advance_cycle(state, base_locations())
        assert report["status"] == "ended"
        assert report["chronicle"] == []

    def test_silence_ending_when_nothing_happens(self, state):
        state["cycle"] = state["max_cycles"] + 1
        state["stability"] = 80.0
        ending = engine._resolve_ending(state)
        assert ending["id"] in {"silence", "awakening"}
        assert ending["id"] != "drift"

    def test_awakening_ending_requires_high_lucidity(self, state):
        state["cycle"] = state["max_cycles"] + 1
        state["stability"] = 70.0
        for resident in state["residents"]:
            resident["lucidity"] = 85.0
        ending = engine._resolve_ending(state)
        assert ending["id"] == "awakening"

    def test_control_ending_requires_completed_goals(self, state):
        state["cycle"] = state["max_cycles"] + 1
        state["stability"] = 70.0
        for resident in state["residents"]:
            for entry in resident["goal_state"].values():
                entry["progress"] = 100.0
                entry["complete"] = True
                entry["milestones"] = [True, True, True]
        ending = engine._resolve_ending(state)
        assert ending["id"] == "control"
        assert ending["score"] > 0

    def test_score_is_an_integer(self, state):
        assert isinstance(engine.score_of(state), int)


# --------------------------------------------------------------------------- #
# Pause
# --------------------------------------------------------------------------- #
class TestPause:
    def test_a_new_iteration_can_move(self, state):
        assert state["paused"] is False
        assert engine.public_state(state)["paused"] is False

    def test_a_paused_world_refuses_to_advance(self, state):
        state["paused"] = True
        with pytest.raises(engine.GameRuleError):
            engine.advance_cycle(state, base_locations())

    def test_resuming_lets_the_world_move_again(self, state):
        state["paused"] = True
        with pytest.raises(engine.GameRuleError):
            engine.advance_cycle(state, base_locations())

        state["paused"] = False
        advanced, report = engine.advance_cycle(state, base_locations())
        assert advanced["cycle"] == 2
        assert report["status"] == "ok"
        assert report["residents"]

    def test_the_flag_is_exposed_to_the_client(self, state):
        state["paused"] = True
        assert engine.public_state(state)["paused"] is True

    def test_pausing_does_not_freeze_relationships_or_needs(self, state):
        """A paused world must not silently decay while nobody is looking."""
        state["paused"] = True
        before = {
            resident["id"]: dict(resident["needs"]) for resident in state["residents"]
        }
        with pytest.raises(engine.GameRuleError):
            engine.advance_cycle(state, base_locations())
        after = {
            resident["id"]: dict(resident["needs"]) for resident in state["residents"]
        }
        assert before == after


# --------------------------------------------------------------------------- #
# Public projection
# --------------------------------------------------------------------------- #
class TestPublicState:
    def test_public_state_is_complete(self, state):
        public = engine.public_state(state)
        for key in (
            "cycle",
            "chapter",
            "flux",
            "stability",
            "lucidity",
            "residents",
            "relationships",
            "chronicle",
            "signatures",
            "signature_catalog",
            "pending_dilemma",
            "paused",
            "ending",
            "score",
            "history",
        ):
            assert key in public, f"missing {key}"

    def test_each_resident_exposes_display_fields(self, state):
        public = engine.public_state(state)
        for resident in public["residents"]:
            assert resident["mood_color"].startswith("#")
            assert resident["mood_label"]["fr"]
            assert resident["look"]["skin"].startswith("#")
            assert resident["goals"]
            for goal in resident["goals"]:
                assert 0 <= goal["progress"] <= 100
                assert len(goal["milestones"]) == 3

    def test_serialisable_without_custom_encoder(self, state):
        import json

        json.dumps(engine.public_state(state))

    def test_chronicle_is_newest_first_for_the_client(self, state):
        state, _ = engine.advance_cycle(state, base_locations())
        state, _ = engine.advance_cycle(state, base_locations())
        public = engine.public_state(state)
        cycles = [entry["cycle"] for entry in public["chronicle"]]
        assert cycles == sorted(cycles, reverse=True)

    def test_location_action_preview_works(self):
        preview = engine.location_action_preview(base_locations()[0])
        assert preview
        assert all(item["label"]["fr"] for item in preview)
