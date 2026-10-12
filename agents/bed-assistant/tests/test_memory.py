from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import pytest

from bed_assistant import responder as responder_module
from bed_assistant.config import Settings
from bed_assistant.memory import (
    AgentCoreMemoryStore,
    memory_session_id,
    preference_namespace,
)


@dataclass
class FakeDataPlane:
    """
    AgentCore Memory's data plane for a few users: records filtered by namespace prefix, as
    the API does, events per actor and session, and pages of `page` items.
    """

    page: int = 2
    records: list[dict[str, Any]] = field(default_factory=list)
    events: dict[tuple[str, str], list[str]] = field(default_factory=dict)
    calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    def add_record(self, record_id: str, namespace: str, text: str, day: int) -> None:
        self.records.append(
            {
                "memoryRecordId": record_id,
                "content": {"text": text},
                "namespaces": [namespace],
                "createdAt": datetime(2026, 10, day, 8, tzinfo=UTC),
            }
        )

    def _paged(self, items: list[Any], token: str | None) -> tuple[list[Any], str | None]:
        start = int(token or 0)
        end = start + self.page
        return items[start:end], str(end) if end < len(items) else None

    def list_memory_records(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("list_memory_records", kwargs))
        matching = [r for r in self.records if r["namespaces"][0].startswith(kwargs["namespace"])]
        items, token = self._paged(matching, kwargs.get("nextToken"))
        return {"memoryRecordSummaries": items, **({"nextToken": token} if token else {})}

    def retrieve_memory_records(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("retrieve_memory_records", kwargs))
        matching = [r for r in self.records if r["namespaces"][0].startswith(kwargs["namespace"])]
        return {"memoryRecordSummaries": matching[: kwargs["searchCriteria"]["topK"]]}

    def batch_delete_memory_records(self, **kwargs: Any) -> dict[str, Any]:
        ids = {r["memoryRecordId"] for r in kwargs["records"]}
        self.records = [r for r in self.records if r["memoryRecordId"] not in ids]
        return {"successfulRecords": [{"memoryRecordId": i} for i in ids], "failedRecords": []}

    def list_sessions(self, **kwargs: Any) -> dict[str, Any]:
        sessions = sorted({s for actor, s in self.events if actor == kwargs["actorId"]})
        items, token = self._paged(sessions, kwargs.get("nextToken"))
        summaries = [{"sessionId": s, "actorId": kwargs["actorId"]} for s in items]
        return {"sessionSummaries": summaries, **({"nextToken": token} if token else {})}

    def list_events(self, **kwargs: Any) -> dict[str, Any]:
        assert kwargs["includePayloads"] is False
        ids = self.events.get((kwargs["actorId"], kwargs["sessionId"]), [])
        items, token = self._paged(ids, kwargs.get("nextToken"))
        events = [{"eventId": i, "actorId": kwargs["actorId"]} for i in items]
        return {"events": events, **({"nextToken": token} if token else {})}

    def delete_event(self, **kwargs: Any) -> dict[str, Any]:
        key = (kwargs["actorId"], kwargs["sessionId"])
        self.events[key] = [e for e in self.events[key] if e != kwargs["eventId"]]
        return {"eventId": kwargs["eventId"]}


@pytest.fixture
def plane() -> FakeDataPlane:
    plane = FakeDataPlane()
    plane.add_record("a-1", "/users/alice/preferences", "Mag keinen Fenchel.", 1)
    plane.add_record("a-2", "/users/alice/preferences", "Gärtnert auf dem Balkon.", 5)
    plane.add_record("a-3", "/users/alice/preferences/", "Sonniges Beet.", 3)
    plane.add_record("b-1", "/users/bob/preferences", "Liebt Tomaten.", 2)
    # Matches the prefix of "alice", but is not her namespace: never listed or deleted for her.
    plane.add_record("x-1", "/users/alice/preferences-shared", "Mag Kürbis.", 4)
    plane.events = {
        ("alice", "chat-a"): ["e1", "e2", "e3"],
        ("alice", "chat-b"): ["e4"],
        ("bob", "chat-a"): ["e5"],
    }
    return plane


def test_lists_only_the_users_own_preferences_newest_first(plane: FakeDataPlane) -> None:
    store = AgentCoreMemoryStore(plane, "mem-1")
    alice = store.preferences("alice")
    assert [m["text"] for m in alice] == [
        "Gärtnert auf dem Balkon.",
        "Sonniges Beet.",
        "Mag keinen Fenchel.",
    ]
    assert alice[0] == {
        "id": "a-2",
        "text": "Gärtnert auf dem Balkon.",
        "createdAt": "2026-10-05T08:00:00+00:00",
    }
    assert [m["id"] for m in store.preferences("bob")] == ["b-1"]
    assert store.preferences("carol") == []
    namespaces = {c[1]["namespace"] for c in plane.calls if c[0] == "list_memory_records"}
    assert namespaces == {
        "/users/alice/preferences",
        "/users/bob/preferences",
        "/users/carol/preferences",
    }


def test_recalls_only_the_users_own_preferences(plane: FakeDataPlane) -> None:
    store = AgentCoreMemoryStore(plane, "mem-1", top_k=10)
    assert "Mag Kürbis." not in store.recall("alice", "Was passt?")
    assert store.recall("bob", "Was passt?") == ["Liebt Tomaten."]
    [*_, (name, call)] = plane.calls
    assert name == "retrieve_memory_records"
    assert call["searchCriteria"] == {"searchQuery": "Was passt?", "topK": 10}


def test_forgets_all_preferences_and_events_of_the_user_only(plane: FakeDataPlane) -> None:
    store = AgentCoreMemoryStore(plane, "mem-1")
    assert store.forget("alice") == (3, 4)
    assert store.preferences("alice") == []
    assert [m["id"] for m in store.preferences("bob")] == ["b-1"]
    assert plane.events == {
        ("alice", "chat-a"): [],
        ("alice", "chat-b"): [],
        ("bob", "chat-a"): ["e5"],
    }
    # The record outside her exact namespace stays.
    assert [r["memoryRecordId"] for r in plane.records] == ["b-1", "x-1"]


def test_the_namespace_comes_from_the_user_id() -> None:
    assert preference_namespace("4f1c-sub") == "/users/4f1c-sub/preferences"


def test_only_valid_session_ids_reach_the_memory() -> None:
    assert memory_session_id("chat-0b9c3c5e-6a0f-4b5e-9b0e-0d3b8f1a2c4d") is not None
    assert memory_session_id(None) is None
    assert memory_session_id("../alice/chat") is None
    assert memory_session_id("x" * 101) is None


def test_the_session_manager_uses_the_users_actor_and_namespace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    built: list[Any] = []

    def fake_manager(config: Any, region_name: str) -> object:
        built.append((config, region_name))
        return object()

    monkeypatch.setattr(responder_module, "AgentCoreMemorySessionManager", fake_manager)
    settings = Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t", "MEMORY_ID": "mem-1"})
    responder_module.memory_session(settings, "alice", "chat-a")
    [(config, region)] = built
    assert (config.memory_id, config.actor_id, config.session_id) == ("mem-1", "alice", "chat-a")
    assert list(config.retrieval_config) == ["/users/{actorId}/preferences"]
    assert config.filter_restored_tool_context
    assert config.async_mode
    assert region == "eu-central-1"
