#!/usr/bin/env python3
"""ARCADIA-9 — standalone backend smoke check.

The previous version of this file pointed at a hardcoded deployment URL that no
longer exists and asserted on characters that have since been replaced, so it
could never pass. This version targets a configurable local server and checks
the surfaces that actually exist.

Usage
-----
    # 1. start the backend
    cd backend && python -m uvicorn server:app --host 127.0.0.1 --port 8000

    # 2. in another terminal
    python backend_test.py
    python backend_test.py --url http://127.0.0.1:8000

Exits non-zero if anything fails, so it is safe to use in a pipeline.
For thorough coverage use pytest instead: ``cd backend && python -m pytest tests -q``.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Callable, Dict, List

import requests

RESIDENTS = {"res_aya", "res_tobias", "res_priya", "res_elias", "res_mika", "res_simon"}
NEEDS = {"hunger", "energy", "social", "hygiene", "fun", "bladder", "comfort"}


def _configure_output() -> None:
    """Pick an encoding we can actually print to.

    Windows consoles default to cp1252, where the status glyphs below cannot be
    encoded at all -- the previous version of this script crashed on its very
    first line of output for that reason.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def _can_encode(text: str) -> bool:
    encoding = getattr(sys.stdout, "encoding", None) or "ascii"
    try:
        text.encode(encoding)
        return True
    except (UnicodeEncodeError, LookupError):
        return False


_configure_output()
_GLYPHS = _can_encode("✅❌")
OK_MARK = "✅" if _GLYPHS else "[OK]"
FAIL_MARK = "❌" if _GLYPHS else "[XX]"


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    DIM = "\033[2m"
    END = "\033[0m"


class Checker:
    """Tiny check runner: prints one line per check and tracks failures."""

    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.failures: List[str] = []

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.passed += 1
            print(f"{Colors.GREEN}{OK_MARK} PASS{Colors.END} - {name}")
        else:
            self.failed += 1
            self.failures.append(name)
            print(f"{Colors.RED}{FAIL_MARK} FAIL{Colors.END} - {name}")
            if detail:
                print(f"   {Colors.DIM}{detail}{Colors.END}")
        return bool(condition)

    def attempt(self, name: str, fn: Callable[[], Any]) -> Any:
        """Run ``fn``; a raised exception becomes a failed check, not a crash."""
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - report anything, keep going
            self.check(name, False, f"{type(exc).__name__}: {exc}")
            return None


def main() -> int:
    parser = argparse.ArgumentParser(description="ARCADIA-9 backend smoke check")
    parser.add_argument(
        "--url",
        default=(
            os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("ARCADIA_BACKEND_URL")
            or "http://127.0.0.1:8000"
        ),
        help="Base URL of the backend (default: http://127.0.0.1:8000)",
    )
    args = parser.parse_args()
    api = args.url.rstrip("/") + "/api"

    print(f"\n{Colors.BLUE}{'=' * 68}{Colors.END}")
    print(f"{Colors.BLUE}ARCADIA-9 - backend smoke check{Colors.END}")
    print(f"{Colors.BLUE}Target: {api}{Colors.END}")
    print(f"{Colors.BLUE}{'=' * 68}{Colors.END}\n")

    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    checker = Checker()

    # --- reachability ----------------------------------------------------- #
    try:
        session.get(f"{api}/health", timeout=5)
    except requests.RequestException as exc:
        print(f"{Colors.RED}Backend unreachable at {api}: {exc}{Colors.END}")
        print(
            f"{Colors.YELLOW}Start it with:{Colors.END}\n"
            f"  cd backend && python -m uvicorn server:app --host 127.0.0.1 --port 8000\n"
        )
        return 2

    # --- health / meta ---------------------------------------------------- #
    health = session.get(f"{api}/health", timeout=10).json()
    checker.check("GET /api/health", health.get("status") == "healthy", str(health))

    identity = session.get(f"{api}/identity", timeout=10).json()
    checker.check(
        "GET /api/identity exposes the original brand",
        identity.get("brand", {}).get("name") == "ARCADIA-9",
    )
    checker.check(
        "GET /api/identity lists goals with 3 milestones each",
        len(identity.get("goals", [])) == 12
        and all(len(g["milestones"]) == 3 for g in identity["goals"]),
    )

    # --- the game loop ---------------------------------------------------- #
    reset = session.post(f"{api}/game/reset", timeout=10)
    checker.check("POST /api/game/reset", reset.status_code == 200, reset.text)
    state: Dict[str, Any] = reset.json()["state"]
    checker.check(
        "a fresh iteration starts at cycle 1 with 6 residents",
        state["cycle"] == 1 and len(state["residents"]) == 6,
        f"cycle={state.get('cycle')} residents={len(state.get('residents', []))}",
    )
    checker.check(
        "residents are the six original characters",
        {r["id"] for r in state["residents"]} == RESIDENTS,
        str({r["id"] for r in state["residents"]}),
    )
    checker.check(
        "every resident has needs in range and at least one goal",
        all(
            NEEDS == set(r["needs"]) and all(0 <= v <= 100 for v in r["needs"].values())
            for r in state["residents"]
        )
        and all(len(r["goals"]) >= 2 for r in state["residents"]),
    )
    checker.check(
        "a dilemma is queued for the player",
        bool(state.get("pending_dilemma"))
        and len(state["pending_dilemma"]["choices"]) >= 2,
    )

    cycle = session.post(f"{api}/game/cycle", timeout=20).json()
    report = cycle["report"]
    checker.check(
        "POST /api/game/cycle advances and reports every resident",
        report["cycle"] == 1 and len(report["residents"]) == 6,
    )
    checker.check(
        "each resident report contains an action, a thought and a reason",
        all(
            r["action"]["id"] and r["thought"]["fr"] and r["reason"]["fr"]
            for r in report["residents"]
        ),
    )
    checker.check("the chronicle is written", bool(report["chronicle"]))

    # --- interventions ---------------------------------------------------- #
    current = session.get(f"{api}/game/state", timeout=10).json()
    affordable = [i for i in current["interventions"] if i["affordable"]]
    if checker.check("interventions are offered", bool(affordable)):
        chosen = affordable[0]
        payload = {"id": chosen["id"]}
        if chosen["target"] == "resident":
            payload["target_id"] = current["residents"][0]["id"]
        applied = session.post(f"{api}/game/intervention", json=payload, timeout=15)
        checker.check(
            f"POST /api/game/intervention ({chosen['id']})",
            applied.status_code == 200,
            applied.text,
        )
        bad = session.post(
            f"{api}/game/intervention", json={"id": "does-not-exist"}, timeout=15
        )
        checker.check(
            "an unknown intervention is rejected with 400", bad.status_code == 400
        )

    # --- decisions -------------------------------------------------------- #
    latest = session.get(f"{api}/game/state", timeout=10).json()
    if latest.get("pending_dilemma"):
        dilemma = latest["pending_dilemma"]
        resolved = session.post(
            f"{api}/game/dilemma",
            json={"dilemma_id": dilemma["id"], "choice_id": dilemma["choices"][0]["id"]},
            timeout=15,
        )
        checker.check(
            "POST /api/game/dilemma applies a choice", resolved.status_code == 200
        )

    # --- pause ------------------------------------------------------------ #
    paused = session.post(f"{api}/game/pause", json={"paused": True}, timeout=15)
    checker.check(
        "POST /api/game/pause freezes the iteration",
        paused.status_code == 200 and paused.json()["paused"] is True,
        paused.text,
    )
    refused = session.post(f"{api}/game/cycle", timeout=15)
    checker.check(
        "a paused iteration refuses to advance (409)",
        refused.status_code == 409,
        refused.text,
    )
    resumed = session.post(f"{api}/game/pause", json={"paused": False}, timeout=15)
    checker.check(
        "POST /api/game/pause resumes the iteration",
        resumed.status_code == 200 and resumed.json()["paused"] is False,
        resumed.text,
    )

    # --- persistence ------------------------------------------------------ #
    exported = session.get(f"{api}/game/save", timeout=15).json()
    checker.check(
        "GET /api/game/save exports a versioned iteration",
        exported.get("format") == "arcadia-9/save" and exported["state"]["residents"],
    )
    loaded = session.post(
        f"{api}/game/load", json={"state": exported["state"]}, timeout=15
    )
    checker.check(
        "POST /api/game/load restores that iteration",
        loaded.status_code == 200
        and loaded.json()["state"]["cycle"] == exported["state"]["cycle"],
    )
    checker.check(
        "an invalid save is rejected with 400",
        session.post(f"{api}/game/load", json={"state": {}}, timeout=15).status_code
        == 400,
    )

    # --- preserved surface ------------------------------------------------ #
    characters = session.get(f"{api}/characters", timeout=10).json()
    checker.check(
        "GET /api/characters still returns full character records",
        len(characters) == 6
        and all(
            {"id", "name", "needs", "attributes", "personality", "objectives", "hobbies"}
            <= set(c)
            for c in characters
        ),
    )
    locations = session.get(f"{api}/locations", timeout=10).json()
    checker.check(
        "GET /api/locations still returns the 31-place catalogue",
        len(locations) == 31,
        f"got {len(locations)}",
    )
    catalog = session.get(f"{api}/build/catalog", timeout=10).json()
    checker.check(
        "GET /api/build/catalog still returns 24 buildable items",
        len(catalog) == 24,
        f"got {len(catalog)}",
    )
    checker.check(
        "GET /api/objectives and /api/hobbies are intact",
        len(session.get(f"{api}/objectives", timeout=10).json()) == 12
        and len(session.get(f"{api}/hobbies", timeout=10).json()) == 16,
    )
    checker.check(
        "GET /api/translations/fr still serves French labels",
        session.get(f"{api}/translations/fr", timeout=10).json().get("strength")
        == "Force",
    )
    simulated = session.post(f"{api}/simulate", timeout=20).json()
    checker.check(
        "POST /api/simulate still answers in its historical shape",
        simulated.get("status") in {"success", "paused"}
        and (
            simulated.get("status") == "paused"
            or all("thought" in r for r in simulated.get("results", []))
        ),
    )

    # --- monetisation posture --------------------------------------------- #
    offers = session.get(f"{api}/support/offers", timeout=10).json()
    checker.check(
        "GET /api/support/offers disables payments and states what it never gives",
        offers.get("payments_enabled") is False
        and all(o["never_grants"]["fr"] for o in offers["offers"]),
    )

    # --- summary ---------------------------------------------------------- #
    total = checker.passed + checker.failed
    print(f"\n{Colors.BLUE}{'=' * 68}{Colors.END}")
    if checker.failed == 0:
        print(f"{Colors.GREEN}ALL CHECKS PASSED: {checker.passed}/{total}{Colors.END}")
    else:
        print(f"{Colors.YELLOW}PASSED: {checker.passed}/{total}{Colors.END}")
        print(f"{Colors.RED}FAILED: {checker.failed}/{total}{Colors.END}")
        for name in checker.failures:
            print(f"{Colors.RED}  • {name}{Colors.END}")
    print(f"{Colors.BLUE}{'=' * 68}{Colors.END}\n")
    return 0 if checker.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
