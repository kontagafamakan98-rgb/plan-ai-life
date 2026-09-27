"""Live HTTP tests for guest-mode ``POST /api/characters/{id}/have-baby`` plus
regression coverage for health, locations, build catalog, characters, simulate
and world.

Start the backend first (``uvicorn server:app --port 8000`` inside ``backend/``),
then run ``pytest tests/test_have_baby_guest.py -v``. Without a running server
these tests skip with an explanatory message instead of erroring at import.
"""

import os

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000").rstrip(
    "/"
)
API = f"{BASE_URL}/api"

# Two of the six residents of iteration 9, used as parents.
PARENT_A = "res_aya"
PARENT_B = "res_simon"


@pytest.fixture(autouse=True)
def _require_live_server(live_api_url):
    return live_api_url


@pytest.fixture(scope="module", autouse=True)
def _reset_world(api_client):
    """Deterministic baseline: a fresh iteration with exactly six residents."""
    response = api_client.post(f"{API}/reset")
    assert response.status_code == 200, f"reset failed: {response.status_code} {response.text}"
    chars = api_client.get(f"{API}/characters").json()
    assert len(chars) == 6, f"Expected the 6 baseline residents after reset, got {len(chars)}"
    yield


class TestGuestHaveBaby:
    baby_id: str | None = None

    def test_a_have_baby_without_auth_returns_200(self, api_client):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(
            f"{API}/characters/{PARENT_A}/have-baby",
            params={
                "partner_id": PARENT_B,
                "baby_name": "Aria",
                "baby_gender": "female",
            },
        )
        assert response.status_code == 200, f"have-baby failed: {response.text}"
        baby = response.json()

        assert baby["name"] == "Aria"
        assert baby["age"] == 0
        assert baby["gender"] == "female"
        assert baby["avatar_emoji"] == "👶"
        assert baby["is_npc"] is False
        assert (baby["user_id"] or "").startswith("guest_")
        assert baby["appearance"]["height"] == 50
        assert baby["appearance"]["skin_color"].startswith("#")
        assert {PARENT_A, PARENT_B} <= set(baby["family"])
        assert baby["bio"], "the child should record its parents"

        TestGuestHaveBaby.baby_id = baby["id"]
        assert TestGuestHaveBaby.baby_id

    def test_b_characters_list_includes_the_baby(self):
        chars = requests.get(f"{API}/characters").json()
        assert len(chars) == 7, f"Expected 6 residents + 1 child, got {len(chars)}"
        baby = next((c for c in chars if c["id"] == TestGuestHaveBaby.baby_id), None)
        assert baby is not None, "the child is missing from /api/characters"
        assert baby["name"] == "Aria"

    def test_c_both_parents_record_the_child(self):
        for parent in (PARENT_A, PARENT_B):
            person = requests.get(f"{API}/characters/{parent}").json()
            assert TestGuestHaveBaby.baby_id in person["children"], (
                f"{parent}.children should contain the child"
            )

    def test_d_unknown_character_returns_404(self):
        response = requests.post(
            f"{API}/characters/nobody/have-baby",
            params={"partner_id": PARENT_B, "baby_name": "X"},
        )
        assert response.status_code == 404

    def test_e_unknown_partner_returns_404(self):
        response = requests.post(
            f"{API}/characters/{PARENT_A}/have-baby",
            params={"partner_id": "ghost", "baby_name": "X"},
        )
        assert response.status_code == 404

    def test_f_same_person_as_both_parents_returns_400(self):
        response = requests.post(
            f"{API}/characters/{PARENT_A}/have-baby",
            params={"partner_id": PARENT_A, "baby_name": "X"},
        )
        assert response.status_code == 400


class TestRegression:
    def test_health(self, api_client):
        response = api_client.get(f"{API}/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_locations_count(self, api_client):
        response = api_client.get(f"{API}/locations")
        assert response.status_code == 200
        locations = response.json()
        assert len(locations) == 31, f"Expected 31 locations, got {len(locations)}"
        ids = {loc["id"] for loc in locations}
        assert {"my_home", "paris_cafe", "kyoto_temple"} <= ids

    def test_build_catalog_is_unchanged(self, api_client):
        catalog = api_client.get(f"{API}/build/catalog").json()
        assert len(catalog) == 24
        assert len([c for c in catalog if c["premium"] is False]) == 14
        assert len([c for c in catalog if c["premium"] is True]) == 10

    def test_characters_endpoint(self, api_client):
        response = api_client.get(f"{API}/characters")
        assert response.status_code == 200
        chars = response.json()
        assert len(chars) >= 6
        residents = {c["name"] for c in chars if c["is_npc"]}
        assert {
            "Aya Sow",
            "Tobias Lenz",
            "Priya Raman",
            "Elias Moreau",
            "Mika Ono",
            "Simón Ortega",
        } <= residents

    def test_simulate_endpoint(self, api_client):
        response = api_client.post(f"{API}/simulate")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] in ("success", "paused")
        if body["status"] == "success":
            assert isinstance(body["results"], list)

    def test_world_endpoint(self, api_client):
        response = api_client.get(f"{API}/world")
        assert response.status_code == 200
        world = response.json()
        for key in ("id", "game_time", "is_paused", "online_users", "cycle"):
            assert key in world, f"world is missing {key}"

    def test_game_state_endpoint(self, api_client):
        response = api_client.get(f"{API}/game/state")
        assert response.status_code == 200
        state = response.json()
        # Six original residents, plus the child born earlier in this module.
        assert len(state["residents"]) >= 6
        for resident in state["residents"]:
            assert 0 <= resident["lucidity"] <= 100
            assert resident["goals"]

    def test_intervention_over_http(self, api_client):
        state = api_client.get(f"{API}/game/state").json()
        target = state["residents"][0]["id"]
        affordable = next(i for i in state["interventions"] if i["affordable"])
        response = api_client.post(
            f"{API}/game/intervention", json={"id": affordable["id"], "target_id": target}
        )
        assert response.status_code == 200, response.text

    def test_logs_endpoint(self, api_client):
        response = api_client.get(f"{API}/logs?limit=5")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
