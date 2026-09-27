"""End-to-end API tests that run in-process against a throw-away save file.

These need no server, no database and no network, so they run everywhere. They
cover both the new ARCADIA-9 surface and every endpoint preserved from the
original project, because "we kept the old features" should be a tested claim
rather than a hope.
"""

import pytest

API = "/api"


# --------------------------------------------------------------------------- #
# Meta / identity
# --------------------------------------------------------------------------- #
class TestMeta:
    def test_health(self, local_client):
        body = local_client.get(f"{API}/health").json()
        assert body["status"] == "healthy"

    def test_root_announces_the_brand(self, local_client):
        body = local_client.get(f"{API}/").json()
        assert body["message"]
        assert body["version"]

    def test_identity_exposes_brand_goals_and_interventions(self, local_client):
        body = local_client.get(f"{API}/identity").json()
        assert body["brand"]["name"] == "ARCADIA-9"
        assert body["brand"]["tagline"]["fr"] and body["brand"]["tagline"]["en"]
        assert len(body["goals"]) == 12
        for goal in body["goals"]:
            assert goal["label"]["fr"] and goal["label"]["en"]
            assert len(goal["milestones"]) == 3
        assert len(body["interventions"]) >= 8
        assert body["endings"]
        assert body["anomaly"]["name"] == "RÉSIDU-08"

    def test_identity_states_its_originality(self, local_client):
        body = local_client.get(f"{API}/identity").json()
        assert body["brand"]["license_note"]["fr"]

    def test_translations_still_available(self, local_client):
        fr = local_client.get(f"{API}/translations/fr").json()
        en = local_client.get(f"{API}/translations/en").json()
        assert fr["strength"] == "Force"
        assert en["strength"] == "Strength"
        assert set(fr["needs"]) == {
            "hunger",
            "energy",
            "social",
            "hygiene",
            "fun",
            "bladder",
            "comfort",
        }

    def test_objectives_and_hobbies_preserved(self, local_client):
        objectives = local_client.get(f"{API}/objectives").json()
        hobbies = local_client.get(f"{API}/hobbies").json()
        assert len(objectives) == 12
        assert len(hobbies) == 16
        assert "find_love" in objectives
        assert "reading" in hobbies


# --------------------------------------------------------------------------- #
# Game loop
# --------------------------------------------------------------------------- #
class TestGameState:
    def test_state_has_everything_the_client_needs(self, fresh_client):
        body = fresh_client.get(f"{API}/game/state").json()
        for key in (
            "cycle",
            "chapter",
            "chapter_label",
            "max_cycles",
            "flux",
            "stability",
            "lucidity",
            "weather",
            "residents",
            "interventions",
            "signatures",
            "signature_catalog",
            "pending_dilemma",
            "chronicle",
            "score",
            "goals_total",
        ):
            assert key in body, f"missing {key}"
        assert body["cycle"] == 1
        assert body["chapter"] == 1
        assert body["max_cycles"] == 18

    def test_six_residents_with_looks_and_goals(self, fresh_client):
        body = fresh_client.get(f"{API}/game/state").json()
        assert len(body["residents"]) == 6
        for resident in body["residents"]:
            assert resident["look"]["skin"].startswith("#")
            assert resident["look"]["hair"].startswith("#")
            assert resident["look"]["hairstyle"]
            assert resident["look"]["outfit"]["top"].startswith("#")
            assert resident["look"]["accessory"]
            assert len(resident["goals"]) >= 2
            assert resident["mood_color"].startswith("#")

    def test_dilemma_is_queued_at_start(self, fresh_client):
        body = fresh_client.get(f"{API}/game/state").json()
        dilemma = body["pending_dilemma"]
        assert dilemma
        assert len(dilemma["choices"]) >= 2
        assert dilemma["prompt"]["fr"] and dilemma["prompt"]["en"]


class TestCycle:
    def test_cycle_advances_and_reports(self, fresh_client):
        response = fresh_client.post(f"{API}/game/cycle")
        assert response.status_code == 200
        body = response.json()
        report = body["report"]
        assert report["cycle"] == 1
        assert report["next_cycle"] == 2
        assert len(report["residents"]) == 6
        assert report["chronicle"]
        assert report["world"]["flux_after"] >= report["world"]["flux_before"] - 0.01
        assert body["state"]["cycle"] == 2

    def test_each_resident_report_explains_itself(self, fresh_client):
        report = fresh_client.post(f"{API}/game/cycle").json()["report"]
        for entry in report["residents"]:
            assert entry["action"]["id"]
            assert entry["action"]["label"]["fr"]
            assert entry["thought"]["fr"] and entry["thought"]["en"]
            assert entry["reason"]["fr"] and entry["reason"]["en"]
            assert entry["mood"] in {
                "radiant",
                "content",
                "focused",
                "neutral",
                "tired",
                "anxious",
                "upset",
                "lost",
            }
            assert set(entry["needs_delta"]) <= {
                "hunger",
                "energy",
                "social",
                "hygiene",
                "fun",
                "bladder",
                "comfort",
            }

    def test_needs_stay_in_range_over_a_full_scenario(self, fresh_client):
        for _ in range(10):
            fresh_client.post(f"{API}/game/cycle")
        state = fresh_client.get(f"{API}/game/state").json()
        for resident in state["residents"]:
            for need, value in resident["needs"].items():
                assert 0 <= value <= 100, f"{resident['name']}.{need}={value}"

    def test_goal_progress_is_visible_to_the_player(self, fresh_client):
        for _ in range(6):
            fresh_client.post(f"{API}/game/cycle")
        state = fresh_client.get(f"{API}/game/state").json()
        total = 0.0
        for resident in state["residents"]:
            for goal in resident["goals"]:
                assert 0 <= goal["progress"] <= 100
                assert len(goal["milestone_state"]) == 3
                total += goal["progress"]
        assert total > 0, "no goal progressed after six cycles"

    def test_world_mirrors_the_iteration(self, fresh_client):
        fresh_client.post(f"{API}/game/cycle")
        world = fresh_client.get(f"{API}/world").json()
        assert world["cycle"] == 2
        assert "stability" in world and "lucidity" in world and "flux" in world
        for key in ("id", "game_time", "is_paused", "online_users"):
            assert key in world

    def test_pause_blocks_the_legacy_simulate(self, fresh_client):
        assert fresh_client.post(f"{API}/world/pause").json()["is_paused"] is True
        assert fresh_client.post(f"{API}/simulate").json()["status"] == "paused"
        assert fresh_client.post(f"{API}/world/pause").json()["is_paused"] is False

    def test_history_is_exposed(self, fresh_client):
        for _ in range(3):
            fresh_client.post(f"{API}/game/cycle")
        state = fresh_client.get(f"{API}/game/state").json()
        assert len(state["history"]) == 3
        assert state["history"][0]["cycle"] == 1


class TestInterventions:
    def test_catalogue_marks_cost_target_and_locks(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        catalogue = state["interventions"]
        assert catalogue
        for item in catalogue:
            assert item["label"]["fr"] and item["description"]["fr"]
            assert item["cost"] >= 0
            assert item["target"] in {"resident", "pair", "world"}
            assert item["cost"] <= state["flux"] or not item["affordable"]

    def test_applying_an_intervention_spends_flux_and_shows_its_effect(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        target = state["residents"][0]
        response = fresh_client.post(
            f"{API}/game/intervention", json={"id": "cafe", "target_id": target["id"]}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["result"]["cost"] == 1
        assert body["state"]["flux"] == pytest.approx(state["flux"] - 1)
        assert body["result"]["needs_delta"]["energy"] > 0

    def test_intervention_gives_progress_on_a_goal(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        target = state["residents"][0]
        response = fresh_client.post(
            f"{API}/game/intervention", json={"id": "faveur", "target_id": target["id"]}
        )
        assert response.status_code == 200
        assert response.json()["result"]["goal_progress"]

    def test_unknown_intervention_is_rejected(self, fresh_client):
        response = fresh_client.post(
            f"{API}/game/intervention", json={"id": "black-hole", "target_id": None}
        )
        assert response.status_code == 400
        assert "inconnue" in response.json()["detail"].lower()

    def test_missing_target_is_rejected(self, fresh_client):
        response = fresh_client.post(f"{API}/game/intervention", json={"id": "cafe"})
        assert response.status_code == 400

    def test_locked_intervention_is_rejected_in_chapter_one(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        response = fresh_client.post(
            f"{API}/game/intervention",
            json={"id": "bug", "target_id": state["residents"][0]["id"]},
        )
        assert response.status_code == 400
        assert "chapitre" in response.json()["detail"].lower()

    def test_pair_intervention_needs_two_people(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        first, second = state["residents"][0], state["residents"][1]
        for _ in range(7):
            fresh_client.post(f"{API}/game/cycle")
        state = fresh_client.get(f"{API}/game/state").json()
        assert state["chapter"] >= 2, "test needs chapter 2"
        response = fresh_client.post(
            f"{API}/game/intervention",
            json={"id": "rencontre", "target_id": first["id"], "second_target_id": second["id"]},
        )
        assert response.status_code == 200, response.text
        assert response.json()["result"]["relationship"]["delta"] > 0

    def test_intervention_appears_in_the_chronicle(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        fresh_client.post(
            f"{API}/game/intervention", json={"id": "elan", "target_id": state["residents"][0]["id"]}
        )
        chronicle = fresh_client.get(f"{API}/game/state").json()["chronicle"]
        assert any(entry["kind"] == "intervention" for entry in chronicle)


class TestDilemmas:
    def test_resolving_the_queued_dilemma(self, fresh_client):
        state = fresh_client.get(f"{API}/game/state").json()
        dilemma = state["pending_dilemma"]
        choice = dilemma["choices"][0]
        response = fresh_client.post(
            f"{API}/game/dilemma",
            json={"dilemma_id": dilemma["id"], "choice_id": choice["id"]},
        )
        assert response.status_code == 200
        assert response.json()["state"]["pending_dilemma"] is None

    def test_unknown_dilemma_is_rejected(self, fresh_client):
        response = fresh_client.post(
            f"{API}/game/dilemma", json={"dilemma_id": "nothing", "choice_id": "accept"}
        )
        assert response.status_code == 400

    def test_dilemma_cannot_be_resolved_twice(self, fresh_client):
        dilemma = fresh_client.get(f"{API}/game/state").json()["pending_dilemma"]
        payload = {"dilemma_id": dilemma["id"], "choice_id": dilemma["choices"][0]["id"]}
        assert fresh_client.post(f"{API}/game/dilemma", json=payload).status_code == 200
        assert fresh_client.post(f"{API}/game/dilemma", json=payload).status_code == 400

    def test_a_new_dilemma_is_queued_after_a_cycle(self, fresh_client):
        dilemma = fresh_client.get(f"{API}/game/state").json()["pending_dilemma"]
        fresh_client.post(
            f"{API}/game/dilemma",
            json={"dilemma_id": dilemma["id"], "choice_id": dilemma["choices"][0]["id"]},
        )
        fresh_client.post(f"{API}/game/cycle")
        assert fresh_client.get(f"{API}/game/state").json()["pending_dilemma"]


class TestPersistence:
    def test_progress_survives_a_client_restart(self, local_app):
        from fastapi.testclient import TestClient

        with TestClient(local_app) as client:
            client.post(f"{API}/game/reset")
            for _ in range(3):
                client.post(f"{API}/game/cycle")
            cycle = client.get(f"{API}/game/state").json()["cycle"]

        with TestClient(local_app) as client:
            assert client.get(f"{API}/game/state").json()["cycle"] == cycle

    def test_save_export_and_load_round_trip(self, fresh_client):
        for _ in range(2):
            fresh_client.post(f"{API}/game/cycle")
        exported = fresh_client.get(f"{API}/game/save").json()
        assert exported["format"] == "arcadia-9/save"
        assert exported["state"]["residents"]

        fresh_client.post(f"{API}/game/reset")
        assert fresh_client.get(f"{API}/game/state").json()["cycle"] == 1

        restored = fresh_client.post(f"{API}/game/load", json={"state": exported["state"]})
        assert restored.status_code == 200
        assert restored.json()["state"]["cycle"] == exported["state"]["cycle"]

    def test_invalid_save_is_rejected(self, fresh_client):
        assert fresh_client.post(f"{API}/game/load", json={"state": {}}).status_code == 400
        assert (
            fresh_client.post(
                f"{API}/game/load", json={"state": {"residents": [{"no_id": 1}]}}
            ).status_code
            == 400
        )

    def test_reset_returns_to_a_pristine_iteration(self, fresh_client):
        fresh_client.post(f"{API}/game/cycle")
        fresh_client.post(f"{API}/game/intervention", json={"id": "meteo"})
        state = fresh_client.post(f"{API}/game/reset").json()["state"]
        assert state["cycle"] == 1
        assert state["flux"] == 14
        assert state["signatures"] == []
        assert len(state["residents"]) == 6


# --------------------------------------------------------------------------- #
# Pause / resume
# --------------------------------------------------------------------------- #
class TestPause:
    def test_pausing_freezes_the_iteration(self, fresh_client):
        paused = fresh_client.post(f"{API}/game/pause", json={"paused": True})
        assert paused.status_code == 200
        assert paused.json()["paused"] is True
        assert paused.json()["state"]["paused"] is True

        refused = fresh_client.post(f"{API}/game/cycle")
        assert refused.status_code == 409
        assert refused.json()["detail"]
        assert fresh_client.get(f"{API}/game/state").json()["cycle"] == 1

    def test_resuming_restarts_the_clock(self, fresh_client):
        fresh_client.post(f"{API}/game/pause", json={"paused": True})
        resumed = fresh_client.post(f"{API}/game/pause", json={"paused": False})
        assert resumed.json()["paused"] is False
        assert resumed.json()["state"]["paused"] is False
        assert fresh_client.post(f"{API}/game/cycle").status_code == 200

    def test_pause_is_idempotent_and_toggles_without_a_body(self, fresh_client):
        fresh_client.post(f"{API}/game/pause", json={"paused": True})
        again = fresh_client.post(f"{API}/game/pause", json={"paused": True})
        assert again.json()["paused"] is True
        toggled = fresh_client.post(f"{API}/game/pause")
        assert toggled.json()["paused"] is False

    def test_a_paused_iteration_survives_a_save_round_trip(self, fresh_client):
        fresh_client.post(f"{API}/game/pause", json={"paused": True})
        exported = fresh_client.get(f"{API}/game/save").json()

        fresh_client.post(f"{API}/game/reset")
        assert fresh_client.get(f"{API}/game/state").json()["paused"] is False

        fresh_client.post(f"{API}/game/load", json={"state": exported["state"]})
        assert fresh_client.get(f"{API}/game/state").json()["paused"] is True

    def test_the_legacy_world_route_drives_the_same_flag(self, fresh_client):
        response = fresh_client.post(f"{API}/world/pause", json={"paused": True})
        assert response.json()["is_paused"] is True
        assert fresh_client.get(f"{API}/game/state").json()["paused"] is True
        assert fresh_client.get(f"{API}/world").json()["is_paused"] is True
        assert fresh_client.post(f"{API}/simulate").json()["status"] == "paused"

        fresh_client.post(f"{API}/world/pause", json={"paused": False})
        assert fresh_client.post(f"{API}/simulate").json()["status"] == "success"


# --------------------------------------------------------------------------- #
# Preserved legacy surface
# --------------------------------------------------------------------------- #
class TestLegacyEndpoints:
    def test_characters_projection_has_the_documented_shape(self, fresh_client):
        chars = fresh_client.get(f"{API}/characters").json()
        assert len(chars) == 6
        for char in chars:
            for field in (
                "id",
                "name",
                "age",
                "gender",
                "occupation",
                "avatar_icon",
                "appearance",
                "attributes",
                "personality",
                "objectives",
                "hobbies",
                "location_id",
                "needs",
                "current_action",
                "mood",
                "money",
                "is_npc",
            ):
                assert field in char, f"{char.get('name')} missing {field}"
            assert char["objectives"], "objectives must be a non-empty list of goal ids"
            for need in (
                "hunger",
                "energy",
                "social",
                "hygiene",
                "fun",
                "bladder",
                "comfort",
            ):
                assert 0 <= char["needs"][need] <= 100
            for attribute in (
                "intelligence",
                "strength",
                "charisma",
                "beauty",
                "creativity",
                "luck",
            ):
                assert attribute in char["attributes"]
            assert char["appearance"]["skin_color"].startswith("#")
            assert isinstance(char["current_action"], str)
            assert isinstance(char["mood"], str)
            assert isinstance(char["thoughts"], list)

    def test_character_detail_and_404(self, fresh_client):
        chars = fresh_client.get(f"{API}/characters").json()
        detail = fresh_client.get(f"{API}/characters/{chars[0]['id']}")
        assert detail.status_code == 200
        assert detail.json()["id"] == chars[0]["id"]
        assert fresh_client.get(f"{API}/characters/nobody").status_code == 404

    def test_logs_are_not_empty_after_a_cycle(self, fresh_client):
        fresh_client.post(f"{API}/game/cycle")
        logs = fresh_client.get(f"{API}/logs?limit=5").json()
        assert 1 <= len(logs) <= 5
        for entry in logs:
            assert entry["action"]
            assert entry["character_name"] or entry["character_id"]

    def test_simulate_returns_the_historical_shape(self, fresh_client):
        body = fresh_client.post(f"{API}/simulate").json()
        assert body["status"] == "success"
        results = body["results"]
        assert len(results) == 6
        for result in results:
            for field in ("character_id", "name", "action", "thought", "mood", "location"):
                assert field in result
            assert result["thought"], "thought must not be empty"

    def test_locations_catalogue_is_untouched(self, fresh_client):
        locations = fresh_client.get(f"{API}/locations").json()
        assert len(locations) == 31
        ids = {loc["id"] for loc in locations}
        assert {"paris_cafe", "tokyo_apartment", "my_home"} <= ids
        for loc in locations:
            # The catalogue ships a semantic icon key, never a picture-glyph.
            assert loc["icon"] == loc["type"] and loc["name"]
            assert "emoji" not in loc

    def test_location_actions_preview(self, fresh_client):
        body = fresh_client.get(f"{API}/locations/paris_cafe/actions").json()
        assert body["families"]
        assert fresh_client.get(f"{API}/locations/never/actions").status_code == 404

    def test_guest_character_creation_joins_the_world(self, fresh_client):
        payload = {
            "name": "Iris",
            "age": 25,
            "gender": "female",
            "occupation": "Dentellière",
            "bio": "Vient d'arriver.",
            "objectives": ["become_artist", "find_love"],
            "hobbies": ["art", "music"],
        }
        created = fresh_client.post(f"{API}/characters/create", json=payload)
        assert created.status_code == 200, created.text
        char = created.json()
        assert char["name"] == "Iris"
        assert char["is_npc"] is False
        assert char["avatar_icon"] == "avatar-woman"
        assert char["location_id"] == "paris_cafe"
        assert (char["user_id"] or "").startswith("guest_")
        assert set(char["objectives"]) == {"become_artist", "find_love"}
        assert len(fresh_client.get(f"{API}/characters").json()) == 7

    def test_move_a_character_to_another_city(self, fresh_client):
        char = fresh_client.post(
            f"{API}/characters/create",
            json={"name": "Nils", "age": 30, "gender": "male", "occupation": "Horloger"},
        ).json()
        moved = fresh_client.post(
            f"{API}/characters/{char['id']}/move", params={"location_id": "kyoto_temple"}
        )
        assert moved.status_code == 200
        assert moved.json()["location"] == "kyoto_temple"
        updated = fresh_client.get(f"{API}/characters/{char['id']}").json()
        assert updated["location_id"] == "kyoto_temple"
        assert (
            fresh_client.post(
                f"{API}/characters/{char['id']}/move", params={"location_id": "atlantis"}
            ).status_code
            == 404
        )

    def test_have_baby_creates_a_real_resident(self, fresh_client):
        chars = fresh_client.get(f"{API}/characters").json()
        first, second = chars[0]["id"], chars[1]["id"]
        response = fresh_client.post(
            f"{API}/characters/{first}/have-baby",
            params={"partner_id": second, "baby_name": "Lou", "baby_gender": "female"},
        )
        assert response.status_code == 200, response.text
        baby = response.json()
        assert baby["name"] == "Lou"
        assert baby["age"] == 0
        assert baby["avatar_icon"] == "avatar-baby"
        assert baby["is_npc"] is False
        assert {first, second} <= set(baby["family"])
        assert baby["id"] in fresh_client.get(f"{API}/characters/{first}").json()["children"]
        assert baby["id"] in fresh_client.get(f"{API}/characters/{second}").json()["children"]
        assert len(fresh_client.get(f"{API}/characters").json()) == 7

    def test_have_baby_rejects_unknown_parents(self, fresh_client):
        chars = fresh_client.get(f"{API}/characters").json()
        assert (
            fresh_client.post(
                f"{API}/characters/ghost/have-baby",
                params={"partner_id": chars[0]["id"], "baby_name": "X"},
            ).status_code
            == 404
        )

    def test_build_mode_is_intact(self, fresh_client):
        catalog = fresh_client.get(f"{API}/build/catalog").json()
        assert len(catalog) == 24
        assert len([c for c in catalog if c["premium"] is False]) == 14

        fresh_client.post(f"{API}/build/clear", params={"location_id": "my_home"})
        placed = fresh_client.post(
            f"{API}/build/place", json={"catalog_id": "sofa", "x": 40, "y": 40}
        )
        assert placed.status_code == 200
        item_id = placed.json()["id"]
        assert len(fresh_client.get(f"{API}/build/items").json()) == 1
        assert (
            fresh_client.post(f"{API}/build/place", json={"catalog_id": "pool"}).status_code == 402
        )
        assert (
            fresh_client.post(f"{API}/build/place", json={"catalog_id": "ufo"}).status_code == 404
        )
        assert fresh_client.delete(f"{API}/build/items/{item_id}").status_code == 200
        assert fresh_client.get(f"{API}/build/items").json() == []

    def test_free_play_never_needs_payment(self, fresh_client):
        """A guard against quietly gating the loop: no premium flag blocks play."""
        state = fresh_client.get(f"{API}/game/state").json()
        assert state["interventions"]
        assert all("premium" not in item for item in state["interventions"])
        assert fresh_client.post(f"{API}/game/cycle").status_code == 200

    def test_auth_register_login_and_me(self, fresh_client):
        register = fresh_client.post(
            f"{API}/auth/register",
            json={"email": "veilleur@example.com", "password": "motdepasse", "name": "Veilleur"},
        )
        assert register.status_code == 200, register.text
        token = register.json()["token"]
        assert token

        duplicate = fresh_client.post(
            f"{API}/auth/register",
            json={"email": "veilleur@example.com", "password": "autre"},
        )
        assert duplicate.status_code == 400

        login = fresh_client.post(
            f"{API}/auth/login",
            json={"email": "veilleur@example.com", "password": "motdepasse"},
        )
        assert login.status_code == 200

        wrong = fresh_client.post(
            f"{API}/auth/login",
            json={"email": "veilleur@example.com", "password": "faux"},
        )
        assert wrong.status_code == 401

        me = fresh_client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "veilleur@example.com"

    def test_unauthenticated_endpoints_return_401(self, fresh_client):
        assert fresh_client.get(f"{API}/auth/me").status_code == 401
        assert fresh_client.post(f"{API}/stripe/mock-subscribe").status_code == 401


# --------------------------------------------------------------------------- #
# Monetisation surface
# --------------------------------------------------------------------------- #
class TestSupport:
    def test_offers_are_honest_and_payments_are_off(self, fresh_client):
        body = fresh_client.get(f"{API}/support/offers").json()
        assert body["payments_enabled"] is False
        assert body["principles"]["fr"] and body["principles"]["en"]
        assert body["offers"]
        for offer in body["offers"]:
            assert offer["payments_enabled"] is False
            assert offer["grants"]["fr"], "an offer must say what it gives"
            assert offer["never_grants"]["fr"], "an offer must say what it never gives"
            assert offer["one_time"] is True, "no recurring trap in the demo"

    def test_no_loot_boxes_or_premium_currency(self, fresh_client):
        body = fresh_client.get(f"{API}/support/offers").json()
        kinds = {offer["kind"] for offer in body["offers"]}
        assert kinds <= {"cosmetic", "content", "tip"}

    def test_prices_endpoint_kept_for_compatibility(self, fresh_client):
        prices = fresh_client.get(f"{API}/stripe/prices").json()["prices"]
        assert any(p["interval"] == "month" for p in prices)
        assert any(p["interval"] == "year" for p in prices)

    def test_checkout_is_refused_without_stripe_configuration(self, fresh_client):
        response = fresh_client.post(f"{API}/stripe/create-checkout-session")
        assert response.status_code in (401, 500)
