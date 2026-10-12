import json
from collections.abc import AsyncIterator
from typing import Any

from starlette.responses import Response, StreamingResponse

from bed_assistant.app import MEMORY_UNAVAILABLE, UNAVAILABLE, handle
from bed_assistant.auth import Caller
from bed_assistant.config import Settings
from bed_assistant.quota import QuotaExceededError
from bed_assistant.suggest import SuggestionError, SuggestionResult

from .helpers import token

SETTINGS = Settings.from_env(
    {"MODEL_ID": "model", "QUOTA_TABLE": "quota", "DAILY_LIMIT": "20", "MAX_INPUT_CHARS": "50"}
)


class FakeQuota:
    def __init__(self, remaining: int | None = 19) -> None:
        self.remaining = remaining
        self.users: list[str] = []

    def take(self, user_id: str) -> int:
        self.users.append(user_id)
        if self.remaining is None:
            raise QuotaExceededError
        return self.remaining


class FakeResponder:
    def __init__(self, chunks: list[str], fail: bool = False) -> None:
        self.chunks = chunks
        self.fail = fail
        self.prompts: list[str] = []
        self.tokens: list[str] = []
        self.sessions: list[str | None] = []

    async def suggest(self, question: str, caller: Caller, bed_id: str) -> SuggestionResult:
        self.prompts.append(f"suggest:{bed_id}:{question}")
        self.tokens.append(caller.token)
        if self.fail:
            raise SuggestionError("Das Beet gibt es nicht.")
        return SuggestionResult(
            suggestions=[
                {
                    "plantId": "P",
                    "kind": "SINGLE",
                    "x": 10,
                    "y": 20,
                    "startDate": "2026-05-04",
                    "reason": "r",
                }
            ],
            warnings=["Zu dicht."],
            summary="Ein Vorschlag.",
            rounds=2,
        )

    async def stream(
        self, prompt: str, caller: Caller, session_id: str | None
    ) -> AsyncIterator[str]:
        self.prompts.append(prompt)
        self.tokens.append(caller.token)
        self.sessions.append(session_id)
        for chunk in self.chunks:
            yield chunk
        if self.fail:
            raise RuntimeError("Bedrock down")


class FakeMemory:
    """Remembers preferences per user id, like the namespaces in AgentCore Memory."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.by_user = {
            "u-1": [{"id": "m-1", "text": "Mag keinen Fenchel."}],
            "u-2": [{"id": "m-2", "text": "Gärtnert in Hamburg."}],
        }
        self.calls: list[str] = []

    def preferences(self, user_id: str) -> list[dict[str, str]]:
        self.calls.append(f"list:{user_id}")
        if self.fail:
            raise RuntimeError("AgentCore down")
        return self.by_user.get(user_id, [])

    def recall(self, user_id: str, query: str) -> list[str]:
        return [m["text"] for m in self.by_user.get(user_id, [])]

    def forget(self, user_id: str) -> tuple[int, int]:
        self.calls.append(f"forget:{user_id}")
        return len(self.by_user.pop(user_id, [])), 4


def headers(groups: list[str], sub: str = "u-1") -> dict[str, str]:
    return {"Authorization": f"Bearer {token({'sub': sub, 'cognito:groups': groups})}"}


async def call(
    payload: object,
    hdrs: dict[str, str],
    quota: FakeQuota | None = None,
    responder: FakeResponder | None = None,
    memory: FakeMemory | None = None,
    session_id: str | None = None,
) -> Response:
    return await handle(
        payload,
        hdrs,
        settings=SETTINGS,
        quota=quota or FakeQuota(),
        responder=responder or FakeResponder(["Hallo"]),
        memory=memory,
        session_id=session_id,
    )


def json_body(response: Response) -> Any:
    return json.loads(bytes(response.body))


async def body_events(response: Response) -> list[dict[str, Any]]:
    assert isinstance(response, StreamingResponse)
    raw = "".join(
        [
            chunk if isinstance(chunk, str) else bytes(chunk).decode()
            async for chunk in response.body_iterator
        ]
    )
    return [json.loads(line[6:]) for line in raw.split("\n\n") if line]


def message(response: Response) -> str:
    return str(json.loads(bytes(response.body))["message"])


async def test_streams_the_answer_and_the_remaining_quota() -> None:
    quota = FakeQuota(remaining=7)
    responder = FakeResponder(["Tomaten ", "mögen Basilikum."])
    response = await call(
        {"message": "Was passt?"}, headers(["ai-testers"]), quota, responder, session_id="chat-1"
    )
    assert response.status_code == 200
    assert response.headers["X-Quota-Remaining"] == "7"
    assert await body_events(response) == [
        {"text": "Tomaten "},
        {"text": "mögen Basilikum."},
        {"done": True, "remaining": 7},
    ]
    assert quota.users == ["u-1"]
    assert responder.prompts == ["Was passt?"]
    # The agent calls the gateway with the caller's own token.
    assert responder.tokens == [headers(["ai-testers"])["Authorization"].removeprefix("Bearer ")]
    # The conversation continues in the chat's session.
    assert responder.sessions == ["chat-1"]


async def test_401_without_token_and_403_without_group() -> None:
    assert (await call({"message": "Hi"}, {})).status_code == 401
    forbidden = await call({"message": "Hi"}, headers(["others"]))
    assert forbidden.status_code == 403
    assert "nicht für dein Konto freigeschaltet" in message(forbidden)


async def test_400_for_invalid_input_without_using_quota() -> None:
    quota = FakeQuota()
    response = await call({"message": "x" * 51}, headers(["admins"]), quota)
    assert response.status_code == 400
    assert "zu lang" in message(response)
    assert quota.users == []


async def test_429_with_a_german_message_when_the_quota_is_used_up() -> None:
    response = await call({"message": "Hi"}, headers(["admins"]), FakeQuota(remaining=None))
    assert response.status_code == 429
    assert message(response) == "Du hast heute schon 20 Fragen gestellt. Morgen geht es weiter."


async def test_a_model_error_ends_the_stream_with_a_german_message() -> None:
    responder = FakeResponder(["Teil"], fail=True)
    response = await call({"message": "Hi"}, headers(["admins"]), responder=responder)
    assert await body_events(response) == [{"text": "Teil"}, {"error": UNAVAILABLE}]


BED = "01J9ZQ3W8D6V2K5M7N8P9R0S1A"


async def test_suggestions_come_as_text_then_an_event_with_the_remaining_warnings() -> None:
    responder = FakeResponder([])
    response = await call(
        {"message": "Was passt noch?", "bedId": BED, "suggest": True},
        headers(["ai-testers"]),
        FakeQuota(remaining=5),
        responder,
    )
    events = await body_events(response)
    assert events[0] == {"text": "Ein Vorschlag.\n\nDie Regel-Engine meldet noch: Zu dicht."}
    assert events[1]["warnings"] == ["Zu dicht."]
    assert events[1]["suggestions"][0]["plantId"] == "P"
    assert events[2] == {"done": True, "remaining": 5}
    assert responder.prompts == [f"suggest:{BED}:Was passt noch?"]


async def test_suggestions_need_a_bed_and_report_failures_in_german() -> None:
    no_bed = await call({"message": "Vorschläge?", "suggest": True}, headers(["admins"]))
    assert no_bed.status_code == 400
    assert "brauche ich ein Beet" in message(no_bed)

    failing = FakeResponder([], fail=True)
    response = await call(
        {"message": "Vorschläge?", "bedId": BED, "suggest": True},
        headers(["admins"]),
        responder=failing,
    )
    assert await body_events(response) == [{"error": "Das Beet gibt es nicht."}]


async def test_lists_only_the_callers_own_preferences_without_using_quota() -> None:
    memory, quota = FakeMemory(), FakeQuota()
    response = await call({"memory": "list"}, headers(["ai-testers"]), quota, memory=memory)
    assert response.status_code == 200
    assert json_body(response) == {"memories": [{"id": "m-1", "text": "Mag keinen Fenchel."}]}
    other = await call({"memory": "list"}, headers(["ai-testers"], sub="u-3"), memory=memory)
    assert json_body(other) == {"memories": []}
    assert memory.calls == ["list:u-1", "list:u-3"]
    assert quota.users == []


async def test_forgets_everything_about_the_caller_only() -> None:
    memory = FakeMemory()
    response = await call({"memory": "forget"}, headers(["admins"], sub="u-2"), memory=memory)
    assert json_body(response) == {"memories": 1, "events": 4}
    assert list(memory.by_user) == ["u-1"]


async def test_memory_requests_need_the_group_a_known_action_and_a_memory() -> None:
    assert (await call({"memory": "list"}, {}, memory=FakeMemory())).status_code == 401
    assert (await call({"memory": "list"}, headers(["x"]), memory=FakeMemory())).status_code == 403
    unknown = await call({"memory": "dump"}, headers(["admins"]), memory=FakeMemory())
    assert unknown.status_code == 400
    for memory in (None, FakeMemory(fail=True)):
        response = await call({"memory": "list"}, headers(["admins"]), memory=memory)
        assert response.status_code == 503
        assert message(response) == MEMORY_UNAVAILABLE
