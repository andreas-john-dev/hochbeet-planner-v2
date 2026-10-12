"""The model behind the assistant: Strands Agents on Bedrock, streamed as text chunks."""

from collections.abc import AsyncIterator, Callable
from datetime import date
from typing import Any, Protocol

from strands import Agent
from strands.hooks import BeforeToolCallEvent, HookProvider, HookRegistry
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient

from .config import Settings
from .prompt import SYSTEM_PROMPT
from .schema_model import suggestion_list_model
from .suggest import McpGardenTools, SuggestionError, SuggestionResult, suggest

#: Tool result the model gets once a question has used up its tool calls.
TOOL_LIMIT_MESSAGE = (
    "Für diese Frage sind keine weiteren Werkzeugaufrufe mehr möglich. "
    "Antworte mit dem, was du schon weißt."
)


class Responder(Protocol):
    def stream(self, prompt: str, token: str) -> AsyncIterator[str]: ...

    async def suggest(self, question: str, token: str, bed_id: str) -> SuggestionResult: ...


class ToolCallLimit(HookProvider):
    """
    Refuses gateway tool calls beyond `limit` per question, so one question stays cheap. Only
    the gateway's tools (`<target>___<tool>`) count; Strands' own structured output tool does
    not, so a suggestion answer can always be delivered.
    """

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.calls = 0

    def register_hooks(self, registry: HookRegistry, **_: Any) -> None:
        registry.add_callback(BeforeToolCallEvent, self.before_tool_call)

    def before_tool_call(self, event: BeforeToolCallEvent) -> None:
        if "___" not in str(event.tool_use.get("name", "")):
            return
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

    def agent(self, token: str, client: Any = None) -> Agent:
        if client is None and self._settings.gateway_url:
            client = self._client_factory(self._settings.gateway_url, token)
        tools = [client] if client is not None else []
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
            used_tool = False
            emitted = False
            async for event in agent.stream_async(prompt):
                if "current_tool_use" in event:
                    used_tool = True
                text = event.get("data")
                if isinstance(text, str) and text:
                    # Text after a tool call starts a new paragraph instead of running on.
                    if used_tool and emitted:
                        text = "\n\n" + text.lstrip()
                    used_tool = False
                    emitted = True
                    yield text
        finally:
            # Closes the MCP session to the gateway.
            agent.cleanup()

    async def suggest(self, question: str, token: str, bed_id: str) -> SuggestionResult:
        """Checked planting suggestions; one agent and gateway session for all rounds."""
        if not self._settings.gateway_url:
            raise SuggestionError("Pflanzvorschläge sind gerade nicht verfügbar.")
        client = self._client_factory(self._settings.gateway_url, token)
        agent = self.agent(token, client)
        model = suggestion_list_model()

        async def ask(prompt: str) -> dict[str, Any]:
            result = await agent.invoke_async(prompt, structured_output_model=model)
            output = result.structured_output
            return output.model_dump(exclude_none=True) if output is not None else {}

        try:
            return await suggest(
                ask,
                McpGardenTools(client),
                bed_id=bed_id,
                question=question,
                rounds=self._settings.suggestion_rounds,
                today=date.today(),
            )
        finally:
            agent.cleanup()
