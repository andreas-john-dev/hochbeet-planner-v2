from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import pytest

from bed_assistant import responder as module
from bed_assistant.auth import Caller
from bed_assistant.config import Settings
from bed_assistant.responder import (
    TOOL_LIMIT_MESSAGE,
    StrandsResponder,
    ToolCallLimit,
    gateway_client,
)
from bed_assistant.suggest import SuggestionError

from .helpers import token

USER_TOKEN = token({"sub": "u-1", "cognito:groups": ["ai-testers"]})
USER = Caller("u-1", frozenset({"ai-testers"}), USER_TOKEN)


def caller(sub: str) -> Caller:
    return Caller(sub, frozenset(), token({"sub": sub}))


def settings(**env: str) -> Settings:
    return Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t", **env})


@dataclass
class FakeGateway:
    """Stands in for the MCP client of the gateway; records how it was built and calls."""

    url: str
    token: str
    calls: list[str] = field(default_factory=list)

    async def call_tool_async(self, _id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(name)
        if name == "garden___get_bed":
            text = '{"bed": {"widthCm": 200, "depthCm": 100, "mainRowDirection": "H"}}'
        else:
            text = '{"findings": [], "unknownCandidates": []}'
        return {"status": "success", "content": [{"text": text}]}


@dataclass
class FakeAgent:
    """Captures what the responder builds and streams like a Strands agent."""

    kwargs: dict[str, Any]
    chunks: list[Any] = field(default_factory=lambda: ["Im Beet ", "stehen Tomaten."])
    cleaned_up: bool = False

    async def stream_async(self, prompt: str) -> AsyncIterator[dict[str, Any]]:
        self.kwargs["prompt"] = prompt
        yield {"init_event_loop": True}
        for chunk in self.chunks:
            yield {"data": chunk} if isinstance(chunk, str) else chunk

    async def invoke_async(self, prompt: str, structured_output_model: Any) -> Any:
        self.kwargs.setdefault("prompts", []).append(prompt)
        answer = structured_output_model.model_validate(
            {
                "suggestions": [
                    {
                        "plantId": "01M49THV00QS1SEJEM64991JH5",
                        "kind": "SINGLE",
                        "x": 52,
                        "y": 40,
                        "startDate": "2026-05-06",
                        "reason": "Sonnig.",
                    }
                ],
                "summary": "Eine Tomate.",
            }
        )
        return type("Result", (), {"structured_output": answer})()

    def cleanup(self) -> None:
        self.cleaned_up = True


@pytest.fixture
def agents(monkeypatch: pytest.MonkeyPatch) -> list[FakeAgent]:
    created: list[FakeAgent] = []

    def fake_agent(**kwargs: Any) -> FakeAgent:
        agent = FakeAgent(kwargs)
        created.append(agent)
        return agent

    monkeypatch.setattr(module, "Agent", fake_agent)
    return created


async def collect(chunks: AsyncIterator[str]) -> list[str]:
    return [chunk async for chunk in chunks]


async def test_uses_the_gateway_tools_with_the_callers_token(agents: list[FakeAgent]) -> None:
    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp", MAX_TOOL_CALLS="4"), FakeGateway
    )
    text = await collect(responder.stream("Was steht im Beet?", USER, None))
    assert text == ["Im Beet ", "stehen Tomaten."]
    [agent] = agents
    assert agent.kwargs["tools"] == [FakeGateway("https://gw.example/mcp", USER_TOKEN)]
    [limit] = agent.kwargs["hooks"]
    assert isinstance(limit, ToolCallLimit)
    assert limit.limit == 4
    assert agent.kwargs["prompt"] == "Was steht im Beet?"
    # The MCP session to the gateway is closed after every answer.
    assert agent.cleaned_up


async def test_a_new_agent_and_session_per_request(agents: list[FakeAgent]) -> None:
    responder = StrandsResponder(settings(GATEWAY_URL="https://gw.example/mcp"), FakeGateway)
    await collect(responder.stream("Erste", caller("a"), None))
    await collect(responder.stream("Zweite", caller("b"), None))
    tokens = [agent.kwargs["tools"][0].token for agent in agents]
    assert tokens == [token({"sub": "a"}), token({"sub": "b"})]


async def test_answers_without_tools_when_no_gateway_is_configured(
    agents: list[FakeAgent],
) -> None:
    responder = StrandsResponder(settings(), FakeGateway)
    await collect(responder.stream("Hallo", USER, None))
    assert agents[0].kwargs["tools"] == []


@dataclass
class FakeToolCall:
    tool_use: dict[str, Any] = field(default_factory=lambda: {"name": "garden___get_bed"})
    cancel_tool: bool | str = False


def test_refuses_tool_calls_beyond_the_limit() -> None:
    limit = ToolCallLimit(2)
    calls = [FakeToolCall() for _ in range(4)]
    for call in calls:
        limit.before_tool_call(call)  # type: ignore[arg-type]
    assert [c.cancel_tool for c in calls] == [False, False, TOOL_LIMIT_MESSAGE, TOOL_LIMIT_MESSAGE]


def test_the_structured_output_tool_does_not_count() -> None:
    limit = ToolCallLimit(1)
    gateway, structured = FakeToolCall(), FakeToolCall({"name": "SuggestionList"})
    for call in (gateway, structured):
        limit.before_tool_call(call)  # type: ignore[arg-type]
    assert (gateway.cancel_tool, structured.cancel_tool, limit.calls) == (False, False, 1)


async def test_text_after_a_tool_call_starts_a_new_paragraph(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tool = {"current_tool_use": {"name": "garden___get_bed"}}

    def fake_agent(**kwargs: Any) -> FakeAgent:
        return FakeAgent(kwargs, chunks=[tool, "Ich schaue nach.", tool, "Im Beet stehen Tomaten."])

    monkeypatch.setattr(module, "Agent", fake_agent)
    responder = StrandsResponder(settings(GATEWAY_URL="https://gw.example/mcp"), FakeGateway)
    text = await collect(responder.stream("Was steht im Beet?", USER, None))
    assert "".join(text) == "Ich schaue nach.\n\nIm Beet stehen Tomaten."


async def test_suggestions_use_structured_output_and_check_with_the_gateway(
    agents: list[FakeAgent],
) -> None:
    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp", SUGGESTION_ROUNDS="2"), FakeGateway
    )
    result = await responder.suggest("Was passt noch?", USER, "01J9ZQ3W8D6V2K5M7N8P9R0S1A")
    # Corrected onto the grid and the Monday.
    assert result.suggestions[0] | {} == {
        "plantId": "01M49THV00QS1SEJEM64991JH5",
        "kind": "SINGLE",
        "x": 50,
        "y": 40,
        "startDate": "2026-05-04",
        "reason": "Sonnig.",
    }
    assert (result.warnings, result.summary, result.rounds) == ([], "Eine Tomate.", 1)
    [agent] = agents
    gateway = agent.kwargs["tools"][0]
    assert gateway.token == USER_TOKEN
    assert gateway.calls == ["garden___get_bed", "garden___evaluate_bed"]
    assert agent.cleaned_up


async def test_no_suggestions_without_gateway(agents: list[FakeAgent]) -> None:
    with pytest.raises(SuggestionError, match="nicht verfügbar"):
        await StrandsResponder(settings(), FakeGateway).suggest("?", USER, "B")


def test_the_gateway_client_sends_the_token_as_bearer(monkeypatch: pytest.MonkeyPatch) -> None:
    built: list[dict[str, Any]] = []

    def fake_client(**kwargs: Any) -> object:
        built.append(kwargs)
        return kwargs

    monkeypatch.setattr(module, "MCPClient", fake_client)
    gateway_client("https://gw.example/mcp", USER_TOKEN)
    assert built == [
        {"url": "https://gw.example/mcp", "headers": {"Authorization": f"Bearer {USER_TOKEN}"}}
    ]


@dataclass
class FakeSessions:
    """Records which memory sessions the responder opens, instead of AgentCore Memory."""

    opened: list[tuple[str, str, str]] = field(default_factory=list)

    def __call__(self, settings: Settings, user_id: str, session_id: str) -> str:
        self.opened.append((settings.memory_id, user_id, session_id))
        return f"session:{user_id}:{session_id}"


async def test_continues_the_conversation_of_the_callers_own_session(
    agents: list[FakeAgent],
) -> None:
    sessions = FakeSessions()
    responder = StrandsResponder(
        settings(MEMORY_ID="mem-1", HISTORY_MESSAGES="12"), FakeGateway, session_factory=sessions
    )
    await collect(responder.stream("ja", caller("a"), "chat-1234"))
    await collect(responder.stream("ja", caller("b"), "chat-1234"))
    # The actor is always the caller from the token, so two users never share a conversation.
    assert sessions.opened == [("mem-1", "a", "chat-1234"), ("mem-1", "b", "chat-1234")]
    assert [a.kwargs["session_manager"] for a in agents] == [
        "session:a:chat-1234",
        "session:b:chat-1234",
    ]
    assert agents[0].kwargs["conversation_manager"].window_size == 12


async def test_no_memory_session_without_memory_or_a_valid_session_id(
    agents: list[FakeAgent],
) -> None:
    sessions = FakeSessions()
    without = StrandsResponder(settings(), FakeGateway, session_factory=sessions)
    await collect(without.stream("Hallo", USER, "chat-1234"))
    with_memory = StrandsResponder(settings(MEMORY_ID="m"), FakeGateway, session_factory=sessions)
    await collect(with_memory.stream("Hallo", USER, None))
    await collect(with_memory.stream("Hallo", USER, "../other user"))
    assert sessions.opened == []
    assert all("session_manager" not in a.kwargs for a in agents)


class FakeRecall:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.users: list[str] = []

    def preferences(self, user_id: str) -> list[dict[str, str]]:
        return []

    def recall(self, user_id: str, query: str) -> list[str]:
        self.users.append(user_id)
        if self.fail:
            raise RuntimeError("AgentCore down")
        return ["Mag keinen Fenchel."]

    def forget(self, user_id: str) -> tuple[int, int]:
        return 0, 0


async def test_suggestions_know_the_callers_preferences(agents: list[FakeAgent]) -> None:
    recall = FakeRecall()
    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp", MEMORY_ID="m"), FakeGateway, memory=recall
    )
    await responder.suggest("Was passt noch?", USER, "01J9ZQ3W8D6V2K5M7N8P9R0S1A")
    assert recall.users == ["u-1"]
    assert "- Mag keinen Fenchel." in agents[0].kwargs["prompts"][0]
    # Suggestion rounds are not stored as conversation.
    assert "session_manager" not in agents[0].kwargs


async def test_suggestions_work_when_recalling_fails(agents: list[FakeAgent]) -> None:
    responder = StrandsResponder(
        settings(GATEWAY_URL="https://gw.example/mcp"), FakeGateway, memory=FakeRecall(fail=True)
    )
    result = await responder.suggest("Was passt noch?", USER, "01J9ZQ3W8D6V2K5M7N8P9R0S1A")
    assert result.summary == "Eine Tomate."
    assert "Vorlieben" not in agents[0].kwargs["prompts"][0]
