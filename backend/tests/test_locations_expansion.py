"""Backend regression tests for the location catalogue expansion (10 -> 31).

Live HTTP tests: start the backend first. They skip cleanly when no server is
reachable.
"""
import os

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "http://127.0.0.1:8000"
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(autouse=True)
def _require_live_server(live_api_url):
    """Skip the whole module unless a backend is actually running."""
    return live_api_url

PREVIOUS_IDS = {
    "paris_cafe", "tokyo_apartment", "nyc_office", "london_park",
    "barcelona_gym", "rome_restaurant", "berlin_club", "sydney_beach",
    "school", "hospital",
}

NEW_IDS = {
    "dubai_mall", "rio_beach", "mumbai_market", "cairo_museum",
    "seoul_cinema", "kyoto_temple", "himalaya_mountain", "amsterdam_park",
    "bangkok_market", "mexico_cathedral", "capetown_safari", "istanbul_bazaar",
    "toronto_office", "buenos_aires_club", "stockholm_park", "lisbon_cafe",
    "alps_mountain", "athens_temple", "bali_beach", "moscow_museum",
}

REQUIRED_FIELDS = {"id", "name", "description", "type", "city", "country", "emoji", "available_actions"}


# ==================== Basic health ====================
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200

    def test_health(self, api_client):
        r = api_client.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"


# ==================== Locations expansion ====================
class TestLocationsExpansion:
    def test_locations_count_30(self, api_client):
        r = api_client.get(f"{API}/locations")
        assert r.status_code == 200
        locs = r.json()
        assert isinstance(locs, list)
        assert len(locs) == 31, f"Expected 31 locations (30 world + my_home), got {len(locs)}"

    def test_previous_ids_present(self, api_client):
        r = api_client.get(f"{API}/locations")
        ids = {loc["id"] for loc in r.json()}
        missing = PREVIOUS_IDS - ids
        assert not missing, f"Missing previous IDs: {missing}"

    def test_new_ids_present(self, api_client):
        r = api_client.get(f"{API}/locations")
        ids = {loc["id"] for loc in r.json()}
        present_new = NEW_IDS & ids
        assert len(present_new) >= 18, (
            f"Expected at least 18 NEW IDs; only {len(present_new)} present. "
            f"Missing: {NEW_IDS - ids}"
        )

    def test_required_fields_all_locations(self, api_client):
        r = api_client.get(f"{API}/locations")
        for loc in r.json():
            missing_fields = REQUIRED_FIELDS - set(loc.keys())
            assert not missing_fields, f"Location {loc.get('id')} missing fields: {missing_fields}"
            # type checks
            assert isinstance(loc["available_actions"], list)
            assert loc["name"] and loc["description"] and loc["city"] and loc["country"]
            assert loc["emoji"]

    def test_country_diversity(self, api_client):
        r = api_client.get(f"{API}/locations")
        countries = {loc["country"] for loc in r.json()}
        assert len(countries) >= 25, f"Only {len(countries)} distinct countries: {countries}"

    def test_get_location_by_id_new(self, api_client):
        r = api_client.get(f"{API}/locations/dubai_mall")
        assert r.status_code == 200
        assert r.json()["id"] == "dubai_mall"


# ==================== Simulate tick ====================
class TestSimulate:
    def test_simulate_three_ticks(self, api_client):
        loc_ids = {l["id"] for l in api_client.get(f"{API}/locations").json()}

        for i in range(3):
            r = api_client.post(f"{API}/simulate")
            assert r.status_code == 200, f"Tick {i+1} failed: {r.text}"

        chars = api_client.get(f"{API}/characters").json()
        assert len(chars) >= 3
        for c in chars:
            if c.get("is_npc"):
                assert c["location_id"] in loc_ids, (
                    f"Character {c.get('name')} has invalid location_id={c['location_id']}"
                )


# ==================== Move a resident to a new location ====================
class TestMoveCharacter:
    RESIDENT = "res_tobias"

    def test_move_a_resident_to_dubai_mall(self, api_client):
        response = api_client.post(
            f"{API}/characters/{self.RESIDENT}/move", params={"location_id": "dubai_mall"}
        )
        assert response.status_code == 200, f"Move failed: {response.text}"
        assert response.json()["location"] == "dubai_mall"

        chars = api_client.get(f"{API}/characters").json()
        moved = next((c for c in chars if c["id"] == self.RESIDENT), None)
        assert moved is not None, f"{self.RESIDENT} not found"
        assert moved["location_id"] == "dubai_mall", f"Resident at {moved['location_id']}"

    def test_move_to_an_unknown_location_is_rejected(self, api_client):
        response = api_client.post(
            f"{API}/characters/{self.RESIDENT}/move", params={"location_id": "atlantis"}
        )
        assert response.status_code == 404


# ==================== Reset rebuilds world ====================
class TestReset:
    def test_reset_returns_30_locations(self, api_client):
        r = api_client.post(f"{API}/reset")
        assert r.status_code == 200
        assert r.json().get("status") == "success"

        locs = api_client.get(f"{API}/locations").json()
        assert len(locs) == 31, f"After reset got {len(locs)} locations"

        ids = {l["id"] for l in locs}
        assert PREVIOUS_IDS.issubset(ids), f"Missing legacy IDs after reset: {PREVIOUS_IDS - ids}"
        assert len(NEW_IDS & ids) >= 18, "Not enough new IDs after reset"

    def test_reset_recreates_the_residents(self, api_client):
        chars = api_client.get(f"{API}/characters").json()

        resident_ids = {c["id"] for c in chars if c.get("is_npc")}
        assert {
            "res_aya",
            "res_tobias",
            "res_priya",
            "res_elias",
            "res_mika",
            "res_simon",
        } == resident_ids, f"Residents after reset: {resident_ids}"


# ==================== Other endpoint regression ====================
class TestOtherEndpoints:
    def test_world(self, api_client):
        r = api_client.get(f"{API}/world")
        assert r.status_code == 200
        body = r.json()
        assert "is_paused" in body or "online_users" in body

    def test_world_pause_toggle(self, api_client):
        r1 = api_client.get(f"{API}/world")
        before = r1.json().get("is_paused", False)

        r2 = api_client.post(f"{API}/world/pause")
        assert r2.status_code == 200

        r3 = api_client.get(f"{API}/world")
        after = r3.json().get("is_paused", False)
        assert after != before, "Pause did not toggle"

        # Toggle back to restore state
        api_client.post(f"{API}/world/pause")

    def test_logs(self, api_client):
        r = api_client.get(f"{API}/logs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_translations_fr(self, api_client):
        r = api_client.get(f"{API}/translations/fr")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict) and len(data) > 0

    def test_translations_en(self, api_client):
        r = api_client.get(f"{API}/translations/en")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict) and "app_name" in data

    def test_objectives(self, api_client):
        r = api_client.get(f"{API}/objectives")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_hobbies(self, api_client):
        r = api_client.get(f"{API}/hobbies")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_stripe_prices(self, api_client):
        r = api_client.get(f"{API}/stripe/prices")
        assert r.status_code == 200
        body = r.json()
        assert "prices" in body and isinstance(body["prices"], list) and len(body["prices"]) >= 1
