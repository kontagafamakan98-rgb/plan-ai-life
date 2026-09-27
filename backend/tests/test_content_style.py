"""Product style rules, enforced instead of documented.

Every rule a player can see is checked here against real content and real API
payloads: symbols must be icon keys rather than pictures, sentences must use
plain typography, and nothing may announce a price that does not exist. A style
rule that only lives in a README decays on the first busy afternoon.
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterable, List

import pytest

from arcadia import api as arcadia_api
from arcadia import content as C
from arcadia import engine as engine_module

# Picture glyphs, variation selectors, arrows and the long dash family. These
# are exactly what the interface is not allowed to receive from the API.
FORBIDDEN = re.compile(
    "["
    "\U0001F000-\U0001FAFF"  # pictographs
    "\u2600-\u27BF"  # misc symbols and dingbats
    "\u2B00-\u2BFF"  # extra arrows and shapes
    "\u2190-\u21FF"  # arrow block
    "\uFE0F"  # variation selector
    "\u2013\u2014"  # en dash and em dash
    "]"
)

ICON_KEY = re.compile(r"^[a-z][a-z0-9_-]*$")
PRICE = re.compile(r"\d+\s?[€$£]|\bEUR\b|\bUSD\b|€\s?\d")


def walk_strings(value: Any) -> Iterable[str]:
    """Yield every string inside nested dicts, lists and tuples."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            yield from walk_strings(item)


def icon_values() -> List[tuple]:
    """Every icon the engine can hand to the interface, with its owner."""
    found: List[tuple] = []
    for family in C.ACTION_FAMILIES:
        found.append((f"family:{family['id']}", family.get("icon")))
    found.append((f"family:{C.FALLBACK_FAMILY['id']}", C.FALLBACK_FAMILY.get("icon")))
    for item in C.INTERVENTIONS:
        found.append((f"intervention:{item['id']}", item.get("icon")))
    for key, mood in engine_module.MOODS.items():
        found.append((f"mood:{key}", mood.get("icon")))
    for weather in engine_module.WEATHER:
        found.append((f"weather:{weather['id']}", weather.get("icon")))
    for key, signature in engine_module.SIGNATURES.items():
        found.append((f"signature:{key}", signature.get("icon")))
    return found


def payload_strings(response) -> List[str]:
    return list(walk_strings(response.json()))


class TestContentTypography:
    def test_no_picture_glyphs_or_long_dashes_in_content(self):
        structures = {
            "brand": C.BRAND,
            "goals": C.GOALS,
            "interventions": C.INTERVENTIONS,
            "dilemmas": C.DILEMMAS,
            "events": C.EVENTS,
            "endings": C.ENDINGS,
            "residents": C.RESIDENTS,
            "anomaly": C.ANOMALY,
            "action_families": C.ACTION_FAMILIES,
            "support": arcadia_api.SUPPORT_OFFERS,
            "principles": arcadia_api.MONETIZATION_PRINCIPLES,
        }
        offenders = []
        for name, structure in structures.items():
            for text in walk_strings(structure):
                match = FORBIDDEN.search(text)
                if match:
                    offenders.append(f"{name}: {text[:60]!r} -> U+{ord(match.group(0)):04X}")
        assert not offenders, "\n".join(offenders)

    def test_icons_are_semantic_keys(self):
        offenders = []
        for owner, icon in icon_values():
            if not isinstance(icon, str) or not ICON_KEY.match(icon):
                offenders.append(f"{owner} -> {icon!r}")
        assert not offenders, "icon fields must be lowercase keys: " + ", ".join(offenders)

    def test_icon_keys_are_unique_within_their_family(self):
        for group in ("family", "mood", "weather", "signature", "intervention"):
            keys = [icon for owner, icon in icon_values() if owner.startswith(group + ":")]
            assert len(keys) == len(set(keys)), f"{group} icons must be distinct"

    def test_generated_chronicle_text_is_plain(self):
        """Prose built at runtime by the engine obeys the same rules."""
        locations = [
            {"id": "paris_cafe", "name": C.t("Café de Paris", "Paris cafe"), "type": "cafe", "available_actions": ["drink_coffee", "read_newspaper", "work_on_laptop"]},
            {"id": "tokyo_apartment", "name": C.t("Appartement de Tokyo", "Tokyo apartment"), "type": "apartment", "available_actions": ["sleep", "cook_meal", "take_shower"]},
            {"id": "london_park", "name": C.t("Parc de Londres", "London park"), "type": "park", "available_actions": ["jog", "walk", "read_book"]},
        ]
        state = engine_module.new_state(locations)
        offenders = []
        for _ in range(18):
            if state.get("ending"):
                break
            try:
                state, report = engine_module.advance_cycle(state, locations)
            except engine_module.GameRuleError:
                break
            for text in walk_strings(report):
                match = FORBIDDEN.search(text)
                if match:
                    offenders.append(f"{text[:70]!r} -> U+{ord(match.group(0)):04X}")
        assert not offenders, "\n".join(offenders)

    def test_no_price_is_announced_while_payments_are_off(self):
        for offer in arcadia_api.SUPPORT_OFFERS:
            assert offer["payments_enabled"] is False
            assert offer["availability"] == "not_for_sale"
            assert "price_display" not in offer, offer["id"]
            for text in walk_strings(offer):
                assert not PRICE.search(text), f"{offer['id']} announces a price: {text!r}"


def violet_hue(hex_colour: str) -> bool:
    """True when a colour sits in the violet band, judged by hue not by name."""
    raw = hex_colour.lstrip('#')
    if len(raw) == 3:
        raw = ''.join(char * 2 for char in raw)
    red, green, blue = (int(raw[index:index + 2], 16) / 255 for index in (0, 2, 4))
    high, low = max(red, green, blue), min(red, green, blue)
    delta = high - low
    if delta == 0:
        return False
    lightness = (high + low) / 2
    saturation = delta / (1 - abs(2 * lightness - 1))
    if high == red:
        hue = 60 * (((green - blue) / delta) % 6)
    elif high == green:
        hue = 60 * ((blue - red) / delta + 2)
    else:
        hue = 60 * ((red - green) / delta + 4)
    hue %= 360
    return 252 <= hue <= 306 and saturation > 0.16 and 0.12 < lightness < 0.8


class TestPalette:
    def test_no_violet_in_moods_or_content_colours(self):
        colours = [mood["color"] for mood in engine_module.MOODS.values()]
        colours += [
            match.group(0)
            for text in walk_strings([C.GOALS, C.RESIDENTS, C.ENDINGS, C.INTERVENTIONS])
            for match in re.finditer(r"#[0-9a-fA-F]{6}", text)
        ]
        offenders = [colour for colour in colours if violet_hue(colour)]
        assert not offenders, f"violet hues are banned: {offenders}"


class TestApiPayloadStyle:
    """Nothing the interface receives may contain a picture glyph."""

    ENDPOINTS = (
        "/api/identity",
        "/api/support/offers",
        "/api/locations",
        "/api/game/state",
        "/api/characters",
        "/api/logs",
        "/api/world",
        "/api/build/catalog",
        "/api/game/save",
    )

    def test_payloads_are_plain(self, local_client):
        offenders = []
        for path in self.ENDPOINTS:
            response = local_client.get(path)
            if response.status_code == 404:
                continue
            assert response.status_code == 200, f"{path} -> {response.status_code}"
            for text in payload_strings(response):
                match = FORBIDDEN.search(text)
                if match:
                    offenders.append(f"{path}: {text[:60]!r} -> U+{ord(match.group(0)):04X}")
        assert not offenders, "\n".join(offenders)

    def test_no_emoji_field_survives_in_the_catalogue(self, local_client):
        for location in local_client.get("/api/locations").json():
            assert "emoji" not in location
            assert location["icon"] == location["type"]
        for item in local_client.get("/api/build/catalog").json():
            assert "emoji" not in item
            assert item["icon"] == item["id"]

    def test_a_full_iteration_stays_plain(self, local_client):
        local_client.post("/api/game/reset", json={})
        offenders = []
        for _ in range(6):
            response = local_client.post("/api/game/cycle")
            if response.status_code != 200:
                break
            for text in payload_strings(response):
                match = FORBIDDEN.search(text)
                if match:
                    offenders.append(f"{text[:60]!r} -> U+{ord(match.group(0)):04X}")
        assert not offenders, "\n".join(offenders)

    def test_exported_save_is_plain(self, local_client):
        body = local_client.get("/api/game/save").json()
        offenders = [text[:60] for text in walk_strings(body) if FORBIDDEN.search(text)]
        assert not offenders, "\n".join(offenders)
