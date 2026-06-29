"""
Backend tests for Build Mode + Guest Character Creation.
Run: pytest /app/backend/tests/test_build_and_guest.py -v
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


REQUIRED_CATALOG_FIELDS = {"id", "name", "emoji", "category", "size", "cost", "premium"}


# ==================== Locations: 31 incl. my_home ====================
class TestLocationsWithMyHome:
    def test_locations_count_31(self, api_client):
        r = api_client.get(f"{API}/locations")
        assert r.status_code == 200
        locs = r.json()
        assert isinstance(locs, list)
        assert len(locs) == 31, f"Expected 31 locations, got {len(locs)}"

    def test_my_home_present(self, api_client):
        r = api_client.get(f"{API}/locations")
        ids = {loc["id"] for loc in r.json()}
        assert "my_home" in ids, f"my_home missing. IDs={ids}"

    def test_my_home_get_by_id(self, api_client):
        r = api_client.get(f"{API}/locations/my_home")
        assert r.status_code == 200
        body = r.json()
        assert body.get("id") == "my_home"
        assert body.get("name") and body.get("emoji")


# ==================== Build catalog ====================
class TestBuildCatalog:
    def test_catalog_returns_24(self, api_client):
        r = api_client.get(f"{API}/build/catalog")
        assert r.status_code == 200
        catalog = r.json()
        assert isinstance(catalog, list)
        assert len(catalog) == 24, f"Expected 24 catalog items, got {len(catalog)}"

    def test_catalog_free_premium_split(self, api_client):
        catalog = api_client.get(f"{API}/build/catalog").json()
        free = [c for c in catalog if c["premium"] is False]
        premium = [c for c in catalog if c["premium"] is True]
        assert len(free) == 14, f"Expected 14 free items, got {len(free)}"
        assert len(premium) == 10, f"Expected 10 premium items, got {len(premium)}"

    def test_catalog_required_fields(self, api_client):
        catalog = api_client.get(f"{API}/build/catalog").json()
        for item in catalog:
            missing = REQUIRED_CATALOG_FIELDS - set(item.keys())
            assert not missing, f"Catalog item {item.get('id')} missing fields: {missing}"
            assert isinstance(item["size"], int)
            assert isinstance(item["cost"], (int, float))
            assert isinstance(item["premium"], bool)

    def test_catalog_contains_sofa_and_pool(self, api_client):
        catalog = api_client.get(f"{API}/build/catalog").json()
        by_id = {c["id"]: c for c in catalog}
        assert "sofa" in by_id and by_id["sofa"]["premium"] is False
        assert "pool" in by_id and by_id["pool"]["premium"] is True


# ==================== Build place / list / delete / clear (guest) ====================
class TestBuildLifecycleGuest:
    placed_id: str | None = None

    def test_a_clear_before(self, api_client):
        # Ensure clean slate for guest in my_home
        r = api_client.post(f"{API}/build/clear", params={"location_id": "my_home"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "cleared"
        assert "removed" in body and isinstance(body["removed"], int)

    def test_b_place_sofa_guest(self, api_client):
        r = api_client.post(
            f"{API}/build/place",
            json={"catalog_id": "sofa", "x": 50, "y": 50, "location_id": "my_home"},
        )
        assert r.status_code == 200, f"place sofa failed: {r.status_code} {r.text}"
        item = r.json()
        assert item.get("id"), f"placed item missing id: {item}"
        assert item.get("catalog_id") == "sofa"
        assert item.get("emoji") == "🛋️"
        assert item.get("name") == "Sofa"
        assert item.get("location_id") == "my_home"
        assert item.get("user_id") == "guest"
        # Persist for subsequent tests
        TestBuildLifecycleGuest.placed_id = item["id"]

    def test_c_place_premium_without_auth_402(self, api_client):
        r = api_client.post(
            f"{API}/build/place",
            json={"catalog_id": "pool", "x": 40, "y": 40},
        )
        assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text}"

    def test_d_place_unknown_catalog_id_404(self, api_client):
        r = api_client.post(
            f"{API}/build/place",
            json={"catalog_id": "unknown_id"},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_e_get_items_returns_sofa(self, api_client):
        r = api_client.get(f"{API}/build/items", params={"location_id": "my_home"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        sofa_items = [i for i in items if i.get("catalog_id") == "sofa"]
        assert len(sofa_items) >= 1, f"Sofa not found in items: {items}"
        # Ensure the one we placed is present
        ids = {i["id"] for i in items}
        assert TestBuildLifecycleGuest.placed_id in ids

    def test_f_delete_sofa(self, api_client):
        assert TestBuildLifecycleGuest.placed_id, "No placed_id from previous test"
        r = api_client.delete(f"{API}/build/items/{TestBuildLifecycleGuest.placed_id}")
        assert r.status_code == 200
        assert r.json().get("status") == "deleted"

    def test_g_items_empty_after_delete(self, api_client):
        r = api_client.get(f"{API}/build/items", params={"location_id": "my_home"})
        assert r.status_code == 200
        items = r.json()
        ids = {i["id"] for i in items}
        assert TestBuildLifecycleGuest.placed_id not in ids, (
            f"Deleted item still present: {TestBuildLifecycleGuest.placed_id}"
        )

    def test_h_clear_returns_status_and_removed(self, api_client):
        # Place 2 items then clear
        for _ in range(2):
            api_client.post(
                f"{API}/build/place",
                json={"catalog_id": "lamp", "x": 20, "y": 20, "location_id": "my_home"},
            )
        r = api_client.post(f"{API}/build/clear", params={"location_id": "my_home"})
        assert r.status_code == 200
        body = r.json()
        assert body == {"status": "cleared", "removed": body.get("removed")}
        assert body["status"] == "cleared"
        assert isinstance(body["removed"], int)
        assert body["removed"] >= 2, f"Expected to clear >=2 items, got {body['removed']}"

        # Verify items list is empty
        items = api_client.get(f"{API}/build/items", params={"location_id": "my_home"}).json()
        assert items == [] or len(items) == 0, f"Expected empty after clear, got {items}"


# ==================== Guest character creation ====================
LUNA_PAYLOAD = {
    "name": "Luna",
    "age": 25,
    "gender": "female",
    "occupation": "Artist",
    "skin_color": "#D2A07A",
    "hair_color": "#1A1A1A",
    "eye_color": "#4A7C59",
    "height": 170,
    "body_type": "average",
    "intelligence": 70,
    "strength": 40,
    "charisma": 80,
    "beauty": 75,
    "creativity": 65,
    "luck": 50,
    "extroversion": 70,
    "kindness": 80,
    "humor": 60,
    "ambition": 75,
    "objectives": ["find_love", "become_artist"],
    "hobbies": ["art", "music", "photography"],
}


class TestGuestCharacterCreation:
    luna_id: str | None = None

    def test_create_luna_no_auth(self, api_client):
        r = api_client.post(f"{API}/characters/create", json=LUNA_PAYLOAD)
        assert r.status_code == 200, f"Create Luna failed: {r.status_code} {r.text}"
        ch = r.json()
        assert ch.get("name") == "Luna"
        assert ch.get("age") == 25
        assert ch.get("gender") == "female"
        assert ch.get("is_npc") is False
        # 13 <= age < 60 + female → 👩
        assert ch.get("avatar_emoji") == "👩", f"Unexpected avatar: {ch.get('avatar_emoji')}"
        # No auth → location should be paris_cafe per server.py L1074
        assert ch.get("location_id") == "paris_cafe", (
            f"Expected location_id=paris_cafe for guest, got {ch.get('location_id')}"
        )
        # user_id should be guest_xxxx (UUID-derived)
        uid = ch.get("user_id") or ""
        assert uid.startswith("guest_"), f"Expected guest_* user_id, got {uid}"
        # Persist
        TestGuestCharacterCreation.luna_id = ch.get("id")
        assert TestGuestCharacterCreation.luna_id

    def test_luna_appears_in_characters_list(self, api_client):
        chars = api_client.get(f"{API}/characters").json()
        assert isinstance(chars, list)
        luna = next((c for c in chars if c.get("id") == TestGuestCharacterCreation.luna_id), None)
        assert luna is not None, "Luna not found in /api/characters"
        assert luna.get("is_npc") is False


# ==================== Regression ====================
class TestRegression:
    def test_three_default_npcs_present(self, api_client):
        chars = api_client.get(f"{API}/characters").json()
        names = {c.get("name") for c in chars if c.get("is_npc")}
        assert "Sophie Laurent" in names, f"Sophie missing. NPCs: {names}"
        assert "Kenji Tanaka" in names, f"Kenji missing. NPCs: {names}"
        assert "Marcus Johnson" in names, f"Marcus missing. NPCs: {names}"

    def test_simulate_still_works(self, api_client):
        r = api_client.post(f"{API}/simulate")
        assert r.status_code == 200, f"simulate failed: {r.text}"

    def test_characters_total_includes_luna(self, api_client):
        chars = api_client.get(f"{API}/characters").json()
        assert len(chars) >= 4, f"Expected >=4 chars (3 NPCs + Luna), got {len(chars)}"
