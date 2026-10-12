import json
from collections.abc import AsyncIterator
from typing import Any

from starlette.responses import Response, StreamingResponse

from bed_assistant.app import UNAVAILABLE, handle
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

    async def suggest(self, question: str, token: str, bed_id: str) -> SuggestionResult:
        self.prompts.append(f"suggest:{bed_id}:{question}")
        self.tokens.append(token)
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

    async def stream(self, prompt: str, token: str) -> AsyncIterator[str]:
        self.prompts.append(prompt)
        self.tokens.append(token)
        for chunk in self.chunks:
            yield chunk
        if self.fail:
            raise RuntimeError("Bedrock down")


def headers(groups: list[str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {token({'sub': 'u-1', 'cognito:groups': groups})}"}


async def call(
    payload: object,
    hdrs: dict[str, str],
    quota: FakeQuota | None = None,
    responder: FakeResponder | None = None,
) -> Response:
    return await handle(
        payload,
        hdrs,
        settings=SETTINGS,
        quota=quota or FakeQuota(),
        responder=responder or FakeResponder(["Hallo"]),
    )


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
    response = await call({"message": "Was passt?"}, headers(["ai-testers"]), quota, responder)
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
