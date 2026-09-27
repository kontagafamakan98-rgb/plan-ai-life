"""Persistence for ARCADIA-9.

Historically this project hard-required MongoDB (``os.environ['MONGO_URL']``),
which made a local demo impossible without provisioning a database server.

This module keeps the exact same *shape* of API the rest of the code already
uses (``db.characters.find_one(...)``, ``db.characters.update_one(...)``, ...)
but backs it with an atomically-written JSON document by default. If
``MONGO_URL`` is set *and* an async Mongo driver is importable *and* the server
answers, we transparently use MongoDB instead so existing deployments keep
working.

Design goals:
  * zero mandatory external services for local play;
  * durable progress (atomic ``os.replace`` writes, no half-written saves);
  * deterministic, easily testable behaviour.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = Path(os.environ.get("ARCADIA_DATA_DIR", ROOT_DIR / "data"))
SAVE_FILE = DEFAULT_DATA_DIR / "save.json"

_MISSING = object()


def to_jsonable(value: Any) -> Any:
    """Recursively convert a document to something ``json.dumps`` accepts."""
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, datetime):
        return value.replace(tzinfo=value.tzinfo or timezone.utc).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (set, frozenset)):
        return [to_jsonable(v) for v in value]
    if hasattr(value, "__str__") and value.__class__.__name__ == "ObjectId":
        return str(value)
    return value


def _match_value(doc_value: Any, condition: Any) -> bool:
    """Evaluate a single field condition (supports a useful subset of Mongo)."""
    if isinstance(condition, dict) and any(k.startswith("$") for k in condition):
        for op, operand in condition.items():
            if op == "$in":
                if doc_value not in operand:
                    return False
            elif op == "$nin":
                if doc_value in operand:
                    return False
            elif op == "$ne":
                if doc_value == operand:
                    return False
            elif op == "$gt":
                if not (_comparable(doc_value) and doc_value > operand):
                    return False
            elif op == "$gte":
                if not (_comparable(doc_value) and doc_value >= operand):
                    return False
            elif op == "$lt":
                if not (_comparable(doc_value) and doc_value < operand):
                    return False
            elif op == "$lte":
                if not (_comparable(doc_value) and doc_value <= operand):
                    return False
            elif op == "$exists":
                exists = doc_value is not _MISSING
                if bool(operand) != exists:
                    return False
            else:  # pragma: no cover - defensive
                return False
        return True
    return doc_value == condition


def _comparable(value: Any) -> bool:
    return isinstance(value, (int, float, str)) and not isinstance(value, bool)


def matches(doc: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    if not query:
        return True
    for key, condition in query.items():
        if key == "$or":
            if not any(matches(doc, sub) for sub in condition):
                return False
            continue
        if key == "$and":
            if not all(matches(doc, sub) for sub in condition):
                return False
            continue
        # Support dotted paths (``"appearance.skin_color"``).
        cursor: Any = doc
        for part in key.split("."):
            if isinstance(cursor, dict) and part in cursor:
                cursor = cursor[part]
            else:
                cursor = _MISSING
                break
        if not _match_value(cursor, condition):
            return False
    return True


class Cursor:
    """Minimal async cursor: ``sort(...).limit(...).to_list(n)``."""

    def __init__(self, docs: Iterable[Dict[str, Any]]):
        self._docs: List[Dict[str, Any]] = list(docs)
        self._ordered = False

    def sort(self, key: str, direction: int = 1) -> "Cursor":
        if not self._ordered:
            self._docs.sort(
                key=lambda d: _sort_key(d.get(key)),
                reverse=direction < 0,
            )
            self._ordered = True
        return self

    def limit(self, count: int) -> "Cursor":
        self._docs = self._docs[:count]
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        docs = self._docs if length is None else self._docs[:length]
        return [json.loads(json.dumps(to_jsonable(d))) for d in docs]

    def __await__(self):  # pragma: no cover - convenience only
        return self.to_list().__await__()


def _sort_key(value: Any) -> Any:
    if value is None:
        return (0, "")
    if isinstance(value, (int, float)):
        return (1, value)
    return (2, str(value))


class _Batch:
    """Async batching context manager.

    Deliberately async-only: a synchronous ``with`` could not guarantee the
    write actually happens, and a fire-and-forget task would risk losing the
    save on shutdown.
    """

    def __init__(self, store: "JsonStore"):
        self._store = store

    async def __aenter__(self) -> "JsonStore":
        self._store._defer_depth += 1
        return self._store

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        self._store._defer_depth = max(0, self._store._defer_depth - 1)
        if self._store._defer_depth == 0 and self._store._dirty:
            await self._store.flush(force=True)
        return False


class JsonCollection:
    """Mongo-ish collection API over an in-memory list persisted to disk."""

    def __init__(self, store: "JsonStore", name: str):
        self._store = store
        self._name = name

    @property
    def _rows(self) -> List[Dict[str, Any]]:
        return self._store.data.setdefault(self._name, [])

    async def find_one(self, query: Optional[Dict[str, Any]] = None, *args, **kwargs):
        for row in self._rows:
            if matches(row, query):
                return json.loads(json.dumps(to_jsonable(row)))
        return None

    def find(self, query: Optional[Dict[str, Any]] = None, *args, **kwargs) -> Cursor:
        return Cursor([r for r in self._rows if matches(r, query)])

    async def insert_one(self, doc: Dict[str, Any]):
        self._rows.append(json.loads(json.dumps(to_jsonable(doc))))
        await self._store.flush()
        return doc

    async def insert_many(self, docs: Iterable[Dict[str, Any]]):
        for doc in docs:
            self._rows.append(json.loads(json.dumps(to_jsonable(doc))))
        await self._store.flush()

    async def update_one(
        self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False
    ):
        for row in self._rows:
            if matches(row, query):
                _apply_update(row, update)
                await self._store.flush()
                return row
        if upsert:
            doc: Dict[str, Any] = {}
            for key, value in (query or {}).items():
                if not key.startswith("$") and not isinstance(value, dict):
                    doc[key] = value
            _apply_update(doc, update)
            self._rows.append(json.loads(json.dumps(to_jsonable(doc))))
            await self._store.flush()
            return doc
        return None

    async def delete_one(self, query: Dict[str, Any]):
        for index, row in enumerate(self._rows):
            if matches(row, query):
                del self._rows[index]
                await self._store.flush()
                return _DeleteResult(1)
        return _DeleteResult(0)

    async def delete_many(self, query: Optional[Dict[str, Any]] = None):
        before = len(self._rows)
        self._rows[:] = [r for r in self._rows if not matches(r, query)]
        removed = before - len(self._rows)
        if removed:
            await self._store.flush()
        return _DeleteResult(removed)

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        return sum(1 for r in self._rows if matches(r, query))


class _DeleteResult:
    def __init__(self, count: int):
        self.deleted_count = count
        self.acknowledged = True


def _apply_update(row: Dict[str, Any], update: Dict[str, Any]) -> None:
    set_ops = update.get("$set")
    if set_ops:
        for key, value in set_ops.items():
            row[key] = to_jsonable(value)
    push_ops = update.get("$push")
    if push_ops:
        for key, value in push_ops.items():
            row.setdefault(key, []).append(to_jsonable(value))
    inc_ops = update.get("$inc")
    if inc_ops:
        for key, value in inc_ops.items():
            row[key] = (row.get(key) or 0) + value
    unset_ops = update.get("$unset")
    if unset_ops:
        for key in unset_ops:
            row.pop(key, None)
    plain = {k: v for k, v in update.items() if not k.startswith("$")}
    if plain:
        for key, value in plain.items():
            row[key] = to_jsonable(value)


class JsonStore:
    """Database facade: ``db.characters``, ``db.world_state``, ..."""

    def __init__(self, path: Optional[Path] = None):
        self.path = Path(path or SAVE_FILE)
        self.data: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()
        self._collections: Dict[str, JsonCollection] = {}
        self._defer_depth = 0
        self._dirty = False
        self._load()

    # -- lifecycle ---------------------------------------------------------
    def _load(self) -> None:
        if not self.path.exists():
            self.data = {}
            return
        try:
            with self.path.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            if isinstance(loaded, dict):
                self.data = {
                    str(k): list(v) for k, v in loaded.items() if isinstance(v, list)
                }
            else:
                logger.warning("Save file %s has unexpected shape; starting empty", self.path)
                self.data = {}
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Could not read %s (%s); starting from a fresh world", self.path, exc)
            self.data = {}

    def batch(self) -> "_Batch":
        """Defer writes: inside this context mutations only mark the store dirty.

        Seeding dozens of rows would otherwise rewrite the entire save file once
        per row. The context still guarantees exactly one atomic write on exit.
        """
        return _Batch(self)

    async def flush(self, force: bool = False) -> None:
        """Atomically persist the whole world.

        Writes are collapsed while a :meth:`batch` block is open.
        """
        self._dirty = True
        if self._defer_depth and not force:
            return
        async with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            payload = json.dumps(to_jsonable(self.data), ensure_ascii=False, indent=1)
            handle = tempfile.NamedTemporaryFile(
                "w", encoding="utf-8", dir=str(self.path.parent), delete=False, suffix=".tmp"
            )
            try:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            finally:
                handle.close()
            os.replace(handle.name, self.path)
            self._dirty = False

    async def reset(self) -> None:
        self.data = {}
        await self.flush()

    # -- access ------------------------------------------------------------
    def __getitem__(self, name: str) -> JsonCollection:
        return self.__getattr__(name)

    def __getattr__(self, name: str) -> JsonCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        cached = self._collections.get(name)
        if cached is None:
            cached = JsonCollection(self, name)
            self._collections[name] = cached
        return cached

    def collection_names(self) -> List[str]:
        return sorted(self.data)


# ---------------------------------------------------------------------------
# Mongo passthrough (only when explicitly configured and reachable)
# ---------------------------------------------------------------------------

_MONGO_CLIENT = None
_JSON_STORE: Optional[JsonStore] = None


def json_store() -> JsonStore:
    """Process-wide JSON store singleton (keeps one in-memory world)."""
    global _JSON_STORE
    if _JSON_STORE is None:
        _JSON_STORE = JsonStore()
    return _JSON_STORE


async def _try_mongo():
    """Return a Mongo database handle, or None when unavailable."""
    global _MONGO_CLIENT
    mongo_url = os.environ.get("MONGO_URL", "").strip()
    if not mongo_url:
        return None
    try:
        from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore

        client = AsyncIOMotorClient(
            mongo_url,
            serverSelectionTimeoutMS=1500,
            connectTimeoutMS=1500,
            uuidRepresentation="standard",
        )
        await client.admin.command("ping")
        _MONGO_CLIENT = client
        logger.info("ARCADIA-9 persistence: MongoDB")
        return client[os.environ.get("DB_NAME", "life_simulator")]
    except Exception as exc:  # pragma: no cover - depends on environment
        logger.warning(
            "MONGO_URL is set but MongoDB is unreachable (%s). "
            "Falling back to the local JSON save file.",
            exc,
        )
        return None


async def get_db():
    """Resolve the active database facade."""
    mongo_db = await _try_mongo()
    if mongo_db is not None:
        return mongo_db
    store = json_store()
    logger.info("ARCADIA-9 persistence: local JSON save file (%s)", store.path)
    return store


def close_mongo_client() -> None:
    """Release the optional Mongo connection on shutdown."""
    global _MONGO_CLIENT
    if _MONGO_CLIENT is not None:
        try:
            _MONGO_CLIENT.close()
        except Exception:  # pragma: no cover - defensive
            logger.debug("Mongo client close failed", exc_info=True)
        _MONGO_CLIENT = None
