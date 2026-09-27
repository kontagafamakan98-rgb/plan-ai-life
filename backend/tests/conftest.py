"""Shared pytest fixtures.

Two families of tests live here:

* **Hermetic tests** use ``local_client``: the real FastAPI app running inside
  the test process against a throw-away JSON save file. They need no server, no
  database and no network, so they always run, including in CI.
* **Live tests** (legacy integration suite) use ``api_client``: plain HTTP against
  a running backend. They skip with a clear message when no server answers,
  instead of erroring out at collection time the way they used to.
"""

import os
import socket
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import pytest
import requests
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(REPO_DIR / "frontend" / ".env")
load_dotenv(BACKEND_DIR / ".env")

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("ARCADIA_BACKEND_URL")
    or "http://127.0.0.1:8000"
).rstrip("/")
API = f"{BASE_URL}/api"

# Hermetic runs get their own save file so they can never touch a developer's
# real progress.
HERMETIC_DATA_DIR = tempfile.mkdtemp(prefix="arcadia9-tests-")
os.environ["ARCADIA_DATA_DIR"] = HERMETIC_DATA_DIR
os.environ.pop("MONGO_URL", None)


def _server_reachable(url: str, timeout: float = 1.5) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def live_api_url():
    if not _server_reachable(BASE_URL):
        pytest.skip(
            f"Aucun backend joignable sur {BASE_URL}. "
            "Lancez `uvicorn server:app --port 8000` dans backend/ puis relancez."
        )
    return API


@pytest.fixture(scope="session")
def api_client(live_api_url):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def local_app():
    """The FastAPI application imported in-process."""
    import server  # noqa: WPS433 (import inside fixture keeps env vars first)

    return server.app


@pytest.fixture(scope="session")
def local_client(local_app):
    """Hermetic client: real app, temp save file, no network."""
    from fastapi.testclient import TestClient

    with TestClient(local_app) as client:
        client.post("/api/game/reset")
        yield client


@pytest.fixture()
def fresh_client(local_app):
    """Same as ``local_client`` but guarantees a pristine iteration per test."""
    from fastapi.testclient import TestClient

    with TestClient(local_app) as client:
        client.post("/api/game/reset")
        yield client
