"""
The assistant's memory in AgentCore Memory (T-44), always per user (`actorId` = Cognito `sub`):

- short-term: the events of a conversation (`sessionId` = the chat's runtime session id), so
  follow-up questions such as "ja" keep their context; they expire after a few days.
- long-term: preferences the memory's user preference strategy extracts from the events in
  the background, stored under `/users/<sub>/preferences`; kept until the user deletes them.

Every read and delete here takes the user id from the verified token only, and drops records
that do not belong to exactly that user's namespace (the API filters by prefix).
"""

import re
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Protocol

#: Namespace template of the preference strategy (infra: AssistantStatefulStack).
PREFERENCE_NAMESPACE = "/users/{actorId}/preferences"

#: Session ids AgentCore Memory accepts; the app sends `chat-<uuid>`.
_SESSION_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$")

#: Upper bounds per request, so listing or forgetting stays quick and cheap.
MAX_MEMORIES = 100
MAX_EVENTS = 2000
_PAGE = 100
_DELETE_WORKERS = 8


def preference_namespace(user_id: str) -> str:
    return PREFERENCE_NAMESPACE.format(actorId=user_id)


def memory_session_id(session_id: str | None) -> str | None:
    """The runtime session id if AgentCore Memory accepts it as a session id, else None."""
    return session_id if session_id and _SESSION_ID.match(session_id) else None


class MemoryStore(Protocol):
    def preferences(self, user_id: str) -> list[dict[str, str]]: ...

    def recall(self, user_id: str, query: str) -> list[str]: ...

    def forget(self, user_id: str) -> tuple[int, int]: ...


class AgentCoreMemoryStore:
    """Reads and deletes one user's memory through the AgentCore data plane (boto3 client)."""

    def __init__(self, client: Any, memory_id: str, *, top_k: int = 5) -> None:
        self._client = client
        self._memory_id = memory_id
        self._top_k = top_k

    def preferences(self, user_id: str) -> list[dict[str, str]]:
        """The user's preferences, newest first: `{"id", "text", "createdAt"?}`."""
        memories = []
        for record in self._records(user_id):
            text = str((record.get("content") or {}).get("text") or "").strip()
            if not text:
                continue
            memory = {"id": str(record["memoryRecordId"]), "text": text}
            created = record.get("createdAt")
            if isinstance(created, datetime):
                memory["createdAt"] = created.isoformat()
            memories.append(memory)
        return sorted(memories, key=lambda m: m.get("createdAt", ""), reverse=True)

    def recall(self, user_id: str, query: str) -> list[str]:
        """The preferences that fit `query` best (semantic search), as plain text."""
        namespace = preference_namespace(user_id)
        result = self._client.retrieve_memory_records(
            memoryId=self._memory_id,
            namespace=namespace,
            searchCriteria={"searchQuery": query[:1000], "topK": self._top_k},
        )
        return [
            text
            for record in result.get("memoryRecordSummaries") or []
            if _belongs_to(record, namespace)
            and (text := str((record.get("content") or {}).get("text") or "").strip())
        ]

    def forget(self, user_id: str) -> tuple[int, int]:
        """
        Deletes all preferences and all conversation events of the user. Returns how many of
        each were deleted.
        """
        ids = [str(record["memoryRecordId"]) for record in self._records(user_id)]
        memories = 0
        for start in range(0, len(ids), _PAGE):
            result = self._client.batch_delete_memory_records(
                memoryId=self._memory_id,
                records=[{"memoryRecordId": i} for i in ids[start : start + _PAGE]],
            )
            memories += len(result.get("successfulRecords") or [])
        events = list(self._events(user_id))
        with ThreadPoolExecutor(max_workers=_DELETE_WORKERS) as pool:
            deleted = list(pool.map(lambda e: self._delete_event(user_id, *e), events))
        return memories, sum(deleted)

    def _records(self, user_id: str) -> list[dict[str, Any]]:
        namespace = preference_namespace(user_id)
        records: list[dict[str, Any]] = []
        token: str | None = None
        while len(records) < MAX_MEMORIES:
            page = self._client.list_memory_records(
                memoryId=self._memory_id,
                namespace=namespace,
                maxResults=_PAGE,
                **({"nextToken": token} if token else {}),
            )
            records += [
                r for r in page.get("memoryRecordSummaries") or [] if _belongs_to(r, namespace)
            ]
            token = page.get("nextToken")
            if not token:
                break
        return records[:MAX_MEMORIES]

    def _events(self, user_id: str) -> Iterator[tuple[str, str]]:
        """(session id, event id) of all the user's conversation events, at most MAX_EVENTS."""
        count = 0
        for session_id in self._sessions(user_id):
            token: str | None = None
            while True:
                page = self._client.list_events(
                    memoryId=self._memory_id,
                    actorId=user_id,
                    sessionId=session_id,
                    includePayloads=False,
                    maxResults=_PAGE,
                    **({"nextToken": token} if token else {}),
                )
                for event in page.get("events") or []:
                    if event.get("actorId", user_id) != user_id:
                        continue
                    yield session_id, str(event["eventId"])
                    count += 1
                    if count >= MAX_EVENTS:
                        return
                token = page.get("nextToken")
                if not token:
                    break

    def _sessions(self, user_id: str) -> Iterator[str]:
        token: str | None = None
        while True:
            page = self._client.list_sessions(
                memoryId=self._memory_id,
                actorId=user_id,
                maxResults=_PAGE,
                **({"nextToken": token} if token else {}),
            )
            for summary in page.get("sessionSummaries") or []:
                if summary.get("actorId", user_id) == user_id:
                    yield str(summary["sessionId"])
            token = page.get("nextToken")
            if not token:
                return

    def _delete_event(self, user_id: str, session_id: str, event_id: str) -> int:
        self._client.delete_event(
            memoryId=self._memory_id, actorId=user_id, sessionId=session_id, eventId=event_id
        )
        return 1


def _belongs_to(record: dict[str, Any], namespace: str) -> bool:
    """Only records stored exactly under the user's namespace (the API matches prefixes)."""
    namespaces = record.get("namespaces") or []
    return any(n.rstrip("/") == namespace for n in namespaces if isinstance(n, str))
