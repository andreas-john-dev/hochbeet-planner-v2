"""The model behind the assistant: Strands Agents on Bedrock, streamed as text chunks."""

from collections.abc import AsyncIterator, Callable
from typing import Any, Protocol

from strands import Agent
from strands.hooks import BeforeToolCallEvent, HookProvider, HookRegistry
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient

from .config import Settings
from .prompt import SYSTEM_PROMPT

#: Tool result the model gets once a question has used up its tool calls.
TOOL_LIMIT_MESSAGE = (
    "Für diese Frage sind keine weiteren Werkzeugaufrufe mehr möglich. "
    "Antworte mit dem, was du schon weißt."
)


class Responder(Protocol):
    def stream(self, prompt: str, token: str) -> AsyncIterator[str]: ...


class ToolCallLimit(HookProvider):
    """Refuses tool calls beyond `limit` per question, so one question stays cheap."""

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.calls = 0

    def register_hooks(self, registry: HookRegistry, **_: Any) -> None:
        registry.add_callback(BeforeToolCallEvent, self.before_tool_call)

    def before_tool_call(self, event: BeforeToolCallEvent) -> None:
        self.calls += 1
        if self.calls > self.limit:
            event.cancel_tool = TOOL_LIMIT_MESSAGE


def gateway_client(url: str, token: str) -> MCPClient:
    """MCP client for the gateway, authenticated with the caller's own ID token."""
    return MCPClient(url=url, headers={"Authorization": f"Bearer {token}"})


class StrandsResponder:
    """
    A fresh agent per request: no conversation memory yet (T-44). Its tools come from the
    AgentCore Gateway with the caller's token, so it only ever reads the caller's own data;
    `max_tool_calls` and `max_tokens` cap the cost of one question.
    """

    def __init__(
        self,
        settings: Settings,
        client_factory: Callable[[str, str], Any] = gateway_client,
    ) -> None:
        self._settings = settings
        self._client_factory = client_factory
        self._model = BedrockModel(
            model_id=settings.model_id,
            region_name=settings.region,
            max_tokens=settings.max_tokens,
            temperature=0.3,
        )

    def agent(self, token: str) -> Agent:
        tools = (
            [self._client_factory(self._settings.gateway_url, token)]
            if self._settings.gateway_url
            else []
        )
        return Agent(
            model=self._model,
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
            hooks=[ToolCallLimit(self._settings.max_tool_calls)],
            callback_handler=None,
        )

    async def stream(self, prompt: str, token: str) -> AsyncIterator[str]:
        agent = self.agent(token)
        try:
            async for event in agent.stream_async(prompt):
                text = event.get("data")
                if isinstance(text, str) and text:
                    yield text
        finally:
            # Closes the MCP session to the gateway.
            agent.cleanup()
