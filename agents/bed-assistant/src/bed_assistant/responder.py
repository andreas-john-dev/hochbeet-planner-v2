"""The model behind the assistant: Strands Agents on Bedrock, streamed as text chunks."""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from datetime import date
from typing import Any, Protocol

from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands import Agent
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands.hooks import BeforeToolCallEvent, HookProvider, HookRegistry
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient

from .auth import Caller
from .config import Settings
from .memory import PREFERENCE_NAMESPACE, MemoryStore, memory_session_id
from .prompt import SYSTEM_PROMPT
from .schema_model import suggestion_list_model
from .suggest import McpGardenTools, SuggestionError, SuggestionResult, suggest

logger = logging.getLogger("bed_assistant")

#: Preferences recalled per question: few and fairly relevant ones, to keep the prompt small.
RECALL_TOP_K = 5
RECALL_MIN_SCORE = 0.3

#: Tool result the model gets once a question has used up its tool calls.
TOOL_LIMIT_MESSAGE = (
    "Für diese Frage sind keine weiteren Werkzeugaufrufe mehr möglich. "
    "Antworte mit dem, was du schon weißt."
)


class Responder(Protocol):
    def stream(self, prompt: str, caller: Caller, session_id: str | None) -> AsyncIterator[str]: ...

    async def suggest(self, question: str, caller: Caller, bed_id: str) -> SuggestionResult: ...


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


def memory_session(settings: Settings, user_id: str, session_id: str) -> Any:
    """
    Strands session manager on AgentCore Memory: restores the conversation `session_id` of
    `user_id` (actor) and stores each new message; before each question it adds the user's
    preferences that fit the question. Old tool results are not restored, to keep the context
    small; the user's id only ever comes from the verified token.
    """
    config = AgentCoreMemoryConfig(
        memory_id=settings.memory_id,
        session_id=session_id,
        actor_id=user_id,
        retrieval_config={
            PREFERENCE_NAMESPACE: RetrievalConfig(
                top_k=RECALL_TOP_K, relevance_score=RECALL_MIN_SCORE
            )
        },
        filter_restored_tool_context=True,
        async_mode=True,
    )
    return AgentCoreMemorySessionManager(config, region_name=settings.region)


class StrandsResponder:
    """
    A fresh agent per request. With AgentCore Memory configured it continues the chat's
    conversation (session) and knows the caller's preferences; otherwise every question stands
    alone. Its tools come from the AgentCore Gateway with the caller's token, so it only ever
    reads the caller's own data; `max_tool_calls`, `max_tokens` and `history_messages` cap the
    cost of one question.
    """

    def __init__(
        self,
        settings: Settings,
        client_factory: Callable[[str, str], Any] = gateway_client,
        *,
        memory: MemoryStore | None = None,
        session_factory: Callable[[Settings, str, str], Any] = memory_session,
        observe: Callable[[Agent], None] | None = None,
    ) -> None:
        self._settings = settings
        self._client_factory = client_factory
        self._memory = memory
        self._session_factory = session_factory
        #: Sees each agent after its answer, e.g. its token usage (model comparison, T-45).
        self._observe = observe
        self._model = BedrockModel(
            model_id=settings.model_id,
            region_name=settings.region,
            max_tokens=settings.max_tokens,
            temperature=0.3,
        )

    def agent(self, caller: Caller, client: Any = None, session_id: str | None = None) -> Agent:
        if client is None and self._settings.gateway_url:
            client = self._client_factory(self._settings.gateway_url, caller.token)
        tools = [client] if client is not None else []
        session = memory_session_id(session_id) if self._settings.memory_id else None
        return Agent(
            model=self._model,
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
            hooks=[ToolCallLimit(self._settings.max_tool_calls)],
            callback_handler=None,
            conversation_manager=SlidingWindowConversationManager(
                window_size=self._settings.history_messages
            ),
            **(
                {"session_manager": self._session_factory(self._settings, caller.user_id, session)}
                if session
                else {}
            ),
        )

    async def stream(
        self, prompt: str, caller: Caller, session_id: str | None
    ) -> AsyncIterator[str]:
        # Restoring the conversation reads AgentCore Memory synchronously: off the event loop.
        agent = await asyncio.to_thread(self.agent, caller, None, session_id)
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
            self._done(agent)

    async def suggest(self, question: str, caller: Caller, bed_id: str) -> SuggestionResult:
        """
        Checked planting suggestions; one agent and gateway session for all rounds. The rounds
        are not stored as conversation, but the caller's fitting preferences go into the prompt.
        """
        if not self._settings.gateway_url:
            raise SuggestionError("Pflanzvorschläge sind gerade nicht verfügbar.")
        client = self._client_factory(self._settings.gateway_url, caller.token)
        agent = self.agent(caller, client)
        model = suggestion_list_model()
        preferences = await self.recall(caller, question)

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
                preferences=preferences,
            )
        finally:
            self._done(agent)

    def _done(self, agent: Agent) -> None:
        try:
            if self._observe is not None:
                self._observe(agent)
        finally:
            # Closes the MCP session to the gateway.
            agent.cleanup()

    async def recall(self, caller: Caller, query: str) -> list[str]:
        """The caller's preferences that fit `query`; none if memory is off or unavailable."""
        if self._memory is None:
            return []
        try:
            return await asyncio.to_thread(self._memory.recall, caller.user_id, query)
        except Exception:
            logger.exception("recalling preferences failed")
            return []
