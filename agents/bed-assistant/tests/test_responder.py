from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import pytest

from bed_assistant import responder as module
from bed_assistant.config import Settings
from bed_assistant.responder import (
    TOOL_LIMIT_MESSAGE,
    StrandsResponder,
    ToolCallLimit,
    gateway_client,
)

from .helpers import token

USER_TOKEN = token({"sub": "u-1", "cognito:groups": ["ai-testers"]})


def settings(**env: str) -> Settings:
    return Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t", **env})


@dataclass
class FakeGateway:
    """Stands in for the MCP client of the gateway; records how it was built."""

    url: str
    token: str


@dataclass
class FakeAgent:
    """Captures what the responder builds and streams like a Strands agent."""

    kwargs: dict[str, Any]
    chunks: list[str] = field(default_factory=lambda: ["Im Beet ", "stehen Tomaten."])
    cleaned_up: bool = False

    async def stream_async(self, prompt: str) -> AsyncIterator[dict[str, Any]]:
        self.kwargs["prompt"] = prompt
        yield {"init_event_loop": True}
        for chunk in self.chunks:
            yield {"data": chunk}

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
    text = await collect(responder.stream("Was steht im Beet?", USER_TOKEN))
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
    await collect(responder.stream("Erste", token({"sub": "a"})))
    await collect(responder.stream("Zweite", token({"sub": "b"})))
    tokens = [agent.kwargs["tools"][0].token for agent in agents]
    assert tokens == [token({"sub": "a"}), token({"sub": "b"})]


async def test_answers_without_tools_when_no_gateway_is_configured(
    agents: list[FakeAgent],
) -> None:
    responder = StrandsResponder(settings(), FakeGateway)
    await collect(responder.stream("Hallo", USER_TOKEN))
    assert agents[0].kwargs["tools"] == []


@dataclass
class FakeToolCall:
    cancel_tool: bool | str = False


def test_refuses_tool_calls_beyond_the_limit() -> None:
    limit = ToolCallLimit(2)
    calls = [FakeToolCall() for _ in range(4)]
    for call in calls:
        limit.before_tool_call(call)  # type: ignore[arg-type]
    assert [c.cancel_tool for c in calls] == [False, False, TOOL_LIMIT_MESSAGE, TOOL_LIMIT_MESSAGE]


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
