import json
from collections.abc import AsyncIterator
from typing import Any

from starlette.responses import Response, StreamingResponse

from bed_assistant.app import UNAVAILABLE, handle
from bed_assistant.config import Settings
from bed_assistant.quota import QuotaExceededError

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

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        self.prompts.append(prompt)
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
