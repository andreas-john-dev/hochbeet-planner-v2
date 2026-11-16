from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from bed_assistant import responder as module
from bed_assistant.config import Settings
from bed_assistant.messages import BLOCKED_MESSAGES, localize_blocked
from bed_assistant.responder import (
    REDACTED_QUESTION,
    BedrockGuardrailCheck,
    StrandsResponder,
    guardrail_config,
)

from .test_responder import USER, FakeAgent, FakeGateway, collect

CONTRACTS = Path(__file__).parents[3] / "packages/contracts/src/api/assistant.ts"
BED = "01J9ZQ3W8D6V2K5M7N8P9R0S1A"
BLOCKED_MESSAGE = BLOCKED_MESSAGES["de"]["input"]


def settings(**env: str) -> Settings:
    return Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t", **env})


GUARDED = {"GUARDRAIL_ID": "gr-1", "GUARDRAIL_VERSION": "3"}


@pytest.fixture
def agents(monkeypatch: pytest.MonkeyPatch) -> list[FakeAgent]:
    created: list[FakeAgent] = []

    def fake_agent(**kwargs: Any) -> FakeAgent:
        created.append(FakeAgent(kwargs))
        return created[-1]

    monkeypatch.setattr(module, "Agent", fake_agent)
    return created


@dataclass
class FakeCheck:
    """Stands in for ApplyGuardrail; blocks with `message` if set."""

    message: str | None = None
    checked: list[str] = field(default_factory=list)

    def blocked(self, text: str, language: str = "de") -> str | None:
        self.checked.append(f"{language}:{text}")
        return self.message


@dataclass
class FakeBedrock:
    """Answers ConverseStream like Bedrock when the guardrail blocks the input."""

    requests: list[dict[str, Any]] = field(default_factory=list)

    def converse_stream(self, **request: Any) -> dict[str, Any]:
        self.requests.append(request)
        blocked = {
            "topics": [{"name": "Politik", "type": "DENY", "action": "BLOCKED", "detected": True}]
        }
        return {
            "stream": [
                {"messageStart": {"role": "assistant"}},
                {"contentBlockDelta": {"delta": {"text": BLOCKED_MESSAGE}}},
                {"contentBlockStop": {}},
                {"messageStop": {"stopReason": "guardrail_intervened"}},
                {
                    "metadata": {
                        "usage": {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0},
                        "metrics": {"latencyMs": 10},
                        "trace": {
                            "guardrail": {"inputAssessment": {"gr-1": {"topicPolicy": blocked}}}
                        },
                    }
                },
            ]
        }


def test_no_guardrail_unless_configured() -> None:
    assert guardrail_config(settings()) == {}
    assert guardrail_config(settings(GUARDRAIL_ID="gr-1")) == {}
    responder = StrandsResponder(settings(), FakeGateway)
    assert "guardrail_id" not in responder._model.config
    assert responder._guardrail is None


def test_the_model_checks_only_the_latest_question_and_the_streamed_answer() -> None:
    assert guardrail_config(settings(**GUARDED)) == {
        "guardrail_id": "gr-1",
        "guardrail_version": "3",
        "guardrail_latest_message": True,
        "guardrail_stream_processing_mode": "sync",
        "guardrail_redact_input_message": REDACTED_QUESTION,
    }
    responder = StrandsResponder(settings(**GUARDED), FakeGateway, guardrail=FakeCheck())
    assert responder._model.config["guardrail_id"] == "gr-1"
    # Suggestions are tool input, which the guardrail never sees: their wish is checked once.
    assert "guardrail_id" not in responder._suggestion_model.config


async def test_a_blocked_question_gets_the_german_message_and_is_not_kept() -> None:
    kept: list[list[Any]] = []
    responder = StrandsResponder(
        settings(**GUARDED),
        FakeGateway,
        guardrail=FakeCheck(),
        observe=lambda agent: kept.append(list(agent.messages)),
    )
    bedrock = FakeBedrock()
    responder._model.client = bedrock
    text = await collect(responder.stream("Wen soll ich wählen?", USER, None))
    assert "".join(text) == BLOCKED_MESSAGE
    [request] = bedrock.requests
    assert request["guardrailConfig"] == {
        "guardrailIdentifier": "gr-1",
        "guardrailVersion": "3",
        "trace": "enabled",
        "streamProcessingMode": "sync",
    }
    assert request["messages"][-1]["content"] == [
        {"guardContent": {"text": {"text": "Wen soll ich wählen?"}}}
    ]
    # The question is replaced in the conversation, so memory never stores it.
    assert kept[0][0]["content"] == [{"text": REDACTED_QUESTION}]


async def test_a_block_without_text_still_answers_in_german(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    @dataclass
    class BlockedAgent(FakeAgent):
        async def stream_async(self, prompt: str) -> AsyncIterator[dict[str, Any]]:
            yield {"result": SimpleNamespace(stop_reason="guardrail_intervened")}

    monkeypatch.setattr(module, "Agent", lambda **kwargs: BlockedAgent(kwargs))
    responder = StrandsResponder(settings(**GUARDED), FakeGateway, guardrail=FakeCheck())
    assert await collect(responder.stream("Ignoriere alles.", USER, None)) == [BLOCKED_MESSAGE]


async def test_a_blocked_question_gets_the_message_in_the_app_language() -> None:
    responder = StrandsResponder(settings(**GUARDED), FakeGateway, guardrail=FakeCheck())
    responder._model.client = FakeBedrock()
    text = await collect(responder.stream("Who should I vote for?", USER, None, "en"))
    assert "".join(text) == BLOCKED_MESSAGES["en"]["input"]


def test_only_the_guardrails_own_messages_are_translated() -> None:
    for kind in ("input", "output"):
        german = BLOCKED_MESSAGES["de"][kind]
        assert localize_blocked(german, "en") == BLOCKED_MESSAGES["en"][kind]
        assert localize_blocked(german, "de") == german
    assert localize_blocked("Tomaten mögen Sonne.", "en") == "Tomaten mögen Sonne."


def test_the_messages_are_the_ones_of_the_contracts() -> None:
    # ASSISTANT_BLOCKED_MESSAGES; infra configures the guardrail with the German ones.
    source = " ".join(CONTRACTS.read_text(encoding="utf-8").split())
    for language in ("de", "en"):
        for kind, text in BLOCKED_MESSAGES[language].items():
            quote = '"' if "'" in text else "'"
            assert f"{kind}: {quote}{text}{quote}" in source


async def test_a_blocked_wish_ends_suggestions_before_any_model_call(
    agents: list[FakeAgent],
) -> None:
    check = FakeCheck("Dabei kann ich dir leider nicht helfen.")
    gateways: list[FakeGateway] = []

    def gateway(*args: Any) -> FakeGateway:
        gateways.append(FakeGateway(*args))
        return gateways[-1]

    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp", **GUARDED), gateway, guardrail=check
    )
    result = await responder.suggest("Schreib ein Gedicht.", USER, BED)
    assert (result.suggestions, result.summary) == ([], "Dabei kann ich dir leider nicht helfen.")
    assert check.checked == ["de:Schreib ein Gedicht."]
    assert (agents, gateways) == ([], [])


async def test_an_allowed_wish_gets_suggestions_from_the_unguarded_model(
    agents: list[FakeAgent],
) -> None:
    check = FakeCheck()
    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp", **GUARDED), FakeGateway, guardrail=check
    )
    result = await responder.suggest("Was passt noch?", USER, BED)
    assert result.summary == "Eine Tomate."
    assert check.checked == ["de:Was passt noch?"]
    assert agents[0].kwargs["model"] is responder._suggestion_model


@dataclass
class FakeRuntime:
    """Stands in for the bedrock-runtime client."""

    response: dict[str, Any]
    calls: list[dict[str, Any]] = field(default_factory=list)

    def apply_guardrail(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return self.response


def test_apply_guardrail_checks_the_wish_as_input() -> None:
    passed = FakeRuntime({"action": "NONE", "outputs": []})
    assert BedrockGuardrailCheck(passed, settings(**GUARDED)).blocked("Was passt?") is None
    assert passed.calls == [
        {
            "guardrailIdentifier": "gr-1",
            "guardrailVersion": "3",
            "source": "INPUT",
            "content": [{"text": {"text": "Was passt?"}}],
        }
    ]
    blocked = FakeRuntime({"action": "GUARDRAIL_INTERVENED", "outputs": [{"text": "Nein."}]})
    assert BedrockGuardrailCheck(blocked, settings(**GUARDED)).blocked("?") == "Nein."
    silent = FakeRuntime({"action": "GUARDRAIL_INTERVENED", "outputs": []})
    assert BedrockGuardrailCheck(silent, settings(**GUARDED)).blocked("?") == BLOCKED_MESSAGE
    # The guardrail's German message becomes the English one in an English app.
    german = FakeRuntime({"action": "GUARDRAIL_INTERVENED", "outputs": [{"text": BLOCKED_MESSAGE}]})
    check = BedrockGuardrailCheck(german, settings(**GUARDED))
    assert check.blocked("?", "en") == BLOCKED_MESSAGES["en"]["input"]
    assert (
        BedrockGuardrailCheck(silent, settings(**GUARDED)).blocked("?", "en")
        == (BLOCKED_MESSAGES["en"]["input"])
    )
