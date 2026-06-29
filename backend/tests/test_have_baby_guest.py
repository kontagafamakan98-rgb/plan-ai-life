"""
Backend tests for guest-mode `POST /api/characters/{character_id}/have-baby`
plus regression coverage for health, locations, build catalog, characters,
simulate, world.

Run:
    pytest /app/backend/tests/test_have_baby_guest.py -v
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# --------------------------------------------------------------------------- #
# Module-level setup: reset DB so we have a deterministic baseline of 3 NPCs
# (Sophie/Kenji/Marcus) and no leftover guest characters from prior runs.
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module", autouse=True)
def _reset_world(api_client):
    r = api_client.post(f"{API}/reset")
    assert r.status_code == 200, f"reset failed: {r.status_code} {r.text}"
    # Force /api/characters to seed by reading once
    chars = api_client.get(f"{API}/characters").json()
    assert len(chars) == 3, f"Expected exactly 3 baseline NPCs after reset, got {len(chars)}"
    yield


# --------------------------------------------------------------------------- #
# (1) Happy-path: guest have-baby Sophie + Kenji -> Aria
# --------------------------------------------------------------------------- #
class TestGuestHaveBaby:
    baby_id: str | None = None

    # Sophie's known skin: #F5D0C5 ; Kenji's known skin: #E8C4A0
    SOPHIE_SKIN = "#F5D0C5"
    KENJI_SKIN = "#E8C4A0"

    def test_a_have_baby_no_auth_returns_200(self, api_client):
        # Explicitly no Authorization header
        sess = requests.Session()
        sess.headers.update({"Content-Type": "application/json"})
        r = sess.post(
            f"{API}/characters/npc_sophie/have-baby",
            params={
                "partner_id": "npc_kenji",
                "baby_name": "Aria",
                "baby_gender": "female",
            },
        )
        assert r.status_code == 200, f"have-baby (guest) failed: {r.status_code} {r.text}"
        baby = r.json()

        # Identity / basics
        assert baby.get("name") == "Aria"
        assert baby.get("age") == 0
        assert baby.get("gender") == "female"
        assert baby.get("avatar_emoji") == "👶"
        assert baby.get("is_npc") is False

        # user_id should be guest_xxxx
        uid = baby.get("user_id") or ""
        assert uid.startswith("guest_"), f"Expected guest_* user_id, got {uid!r}"

        # bio mentions both parents
        bio = baby.get("bio") or ""
        assert "Sophie Laurent" in bio, f"bio missing Sophie: {bio!r}"
        assert "Kenji Tanaka" in bio, f"bio missing Kenji: {bio!r}"

        # appearance: skin matches one parent, height==50
        appearance = baby.get("appearance") or {}
        assert appearance.get("skin_color") in (self.SOPHIE_SKIN, self.KENJI_SKIN), (
            f"baby skin {appearance.get('skin_color')!r} not in parent set"
        )
        assert appearance.get("height") == 50, f"Expected height=50, got {appearance.get('height')}"

        # family contains both parent ids
        family = baby.get("family") or []
        assert "npc_sophie" in family and "npc_kenji" in family, (
            f"family missing parents: {family}"
        )

        TestGuestHaveBaby.baby_id = baby.get("id")
        assert TestGuestHaveBaby.baby_id, "baby has no id"

    # (2) After creating baby, /api/characters has 4 total (3 NPCs + baby)
    def test_b_characters_list_includes_baby(self, api_client):
        chars = api_client.get(f"{API}/characters").json()
        assert isinstance(chars, list)
        assert len(chars) == 4, f"Expected 4 characters (3 NPCs + baby), got {len(chars)}"
        baby = next((c for c in chars if c.get("id") == TestGuestHaveBaby.baby_id), None)
        assert baby is not None, "Baby not found in /api/characters list"
        assert baby.get("name") == "Aria"
        assert baby.get("is_npc") is False

    # (3) Parent Sophie's children array now contains the baby id
    def test_c_parent_sophie_children_updated(self, api_client):
        r = api_client.get(f"{API}/characters/npc_sophie")
        assert r.status_code == 200
        sophie = r.json()
        children = sophie.get("children") or []
        assert TestGuestHaveBaby.baby_id in children, (
            f"Sophie.children missing baby id. children={children}"
        )

    def test_c2_parent_kenji_children_updated(self, api_client):
        r = api_client.get(f"{API}/characters/npc_kenji")
        assert r.status_code == 200
        kenji = r.json()
        children = kenji.get("children") or []
        assert TestGuestHaveBaby.baby_id in children, (
            f"Kenji.children missing baby id. children={children}"
        )

    # (4) Unknown character → 404
    def test_d_unknown_character_returns_404(self, api_client):
        r = api_client.post(
            f"{API}/characters/npc_unknown/have-baby",
            params={"partner_id": "npc_kenji", "baby_name": "X"},
        )
        assert r.status_code == 404, (
            f"Expected 404 for unknown character, got {r.status_code}: {r.text}"
        )

    def test_d2_unknown_partner_returns_404(self, api_client):
        r = api_client.post(
            f"{API}/characters/npc_sophie/have-baby",
            params={"partner_id": "npc_ghost", "baby_name": "X"},
        )
        assert r.status_code == 404, (
            f"Expected 404 for unknown partner, got {r.status_code}: {r.text}"
        )


# --------------------------------------------------------------------------- #
# (5) Regression: other endpoints still work
# --------------------------------------------------------------------------- #
class TestRegression:
    def test_health(self, api_client):
        r = api_client.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_locations_count_31(self, api_client):
        r = api_client.get(f"{API}/locations")
        assert r.status_code == 200
        locs = r.json()
        assert isinstance(locs, list)
        assert len(locs) == 31, f"Expected 31 locations, got {len(locs)}"
        ids = {loc["id"] for loc in locs}
        assert "my_home" in ids
        assert "paris_cafe" in ids

    def test_build_catalog_count_24(self, api_client):
        r = api_client.get(f"{API}/build/catalog")
        assert r.status_code == 200
        catalog = r.json()
        assert isinstance(catalog, list)
        assert len(catalog) == 24, f"Expected 24 build catalog items, got {len(catalog)}"
        free = [c for c in catalog if c["premium"] is False]
        premium = [c for c in catalog if c["premium"] is True]
        assert len(free) == 14
        assert len(premium) == 10

    def test_characters_endpoint(self, api_client):
        r = api_client.get(f"{API}/characters")
        assert r.status_code == 200
        chars = r.json()
        # After have-baby tests above: 3 NPCs + 1 baby = 4
        assert len(chars) >= 3, f"Expected at least 3 characters, got {len(chars)}"
        npc_names = {c.get("name") for c in chars if c.get("is_npc")}
        assert {"Sophie Laurent", "Kenji Tanaka", "Marcus Johnson"}.issubset(npc_names), (
            f"Default NPCs missing. Got: {npc_names}"
        )

    def test_simulate_endpoint(self, api_client):
        r = api_client.post(f"{API}/simulate")
        assert r.status_code == 200, f"simulate failed: {r.text}"
        body = r.json()
        # When not paused, simulate returns {status:'success', results:[...]}
        assert body.get("status") in ("success", "paused")
        if body.get("status") == "success":
            assert isinstance(body.get("results"), list)

    def test_world_endpoint(self, api_client):
        r = api_client.get(f"{API}/world")
        assert r.status_code == 200
        world = r.json()
        # Validate schema fields
        for key in ("id", "game_time", "is_paused", "online_users"):
            assert key in world, f"world missing field {key}: {world}"
