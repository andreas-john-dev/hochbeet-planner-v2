"""The model behind the assistant: Strands Agents on Bedrock, streamed as text chunks."""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable, Sequence
from datetime import date
from typing import Any, Protocol

import boto3
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
from strands.tools.executors import SequentialToolExecutor
from strands.tools.mcp import MCPClient

from .auth import Caller
from .config import Settings
from .memory import PREFERENCE_NAMESPACE, MemoryStore, memory_session_id
from .messages import BLOCKED_MESSAGES, DEFAULT_LANGUAGE, Language, localize_blocked, message
from .prompt import CHAT_TOOLS, DEFAULT_VIEW, View, system_prompt
from .schema_model import suggestion_list_model
from .suggest import (
    SUGGESTION_TOOLS,
    TOOLS_TARGET,
    McpGardenTools,
    SuggestionError,
    SuggestionResult,
    suggest,
)

logger = logging.getLogger("bed_assistant")

#: Preferences recalled per question: few and fairly relevant ones, to keep the prompt small.
RECALL_TOP_K = 5
RECALL_MIN_SCORE = 0.3

#: Replaces a blocked question in the conversation, so it is neither kept nor sent again.
REDACTED_QUESTION = "[Vom Schutzfilter entfernte Frage]"

#: Tool result the model gets once a question has used up its tool calls.
TOOL_LIMIT_MESSAGE = (
    "Für diese Frage sind keine weiteren Werkzeugaufrufe mehr möglich. "
    "Antworte mit dem, was du schon weißt."
)


class Responder(Protocol):
    def stream(
        self,
        prompt: str,
        caller: Caller,
        session_id: str | None,
        language: Language = DEFAULT_LANGUAGE,
        view: View = DEFAULT_VIEW,
    ) -> AsyncIterator[str]: ...

    async def suggest(
        self,
        question: str,
        caller: Caller,
        bed_id: str,
        language: Language = DEFAULT_LANGUAGE,
        view: View = DEFAULT_VIEW,
    ) -> SuggestionResult: ...


class GuardrailCheck(Protocol):
    def blocked(self, text: str, language: Language = DEFAULT_LANGUAGE) -> str | None:
        """The message in `language` if the guardrail blocks `text` as user input, else None."""
        ...


class BedrockGuardrailCheck:
    """Checks a text with ApplyGuardrail: the same guardrail and version as the model's."""

    def __init__(self, client: Any, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    def blocked(self, text: str, language: Language = DEFAULT_LANGUAGE) -> str | None:
        response = self._client.apply_guardrail(
            guardrailIdentifier=self._settings.guardrail_id,
            guardrailVersion=self._settings.guardrail_version,
            source="INPUT",
            content=[{"text": {"text": text}}],
        )
        # Without masking filters (PII), every intervention is a block.
        if response.get("action") != "GUARDRAIL_INTERVENED":
            return None
        # The guardrail answers with its German message; the user gets it in `language`.
        text = "".join(str(o.get("text", "")) for o in response.get("outputs") or [])
        return localize_blocked(text, language).strip() or BLOCKED_MESSAGES[language]["input"]


def guardrail_config(settings: Settings) -> dict[str, Any]:
    """
    BedrockModel settings for the guardrail, none without one. Bedrock checks the latest user
    text of the conversation (Strands wraps it in guardContent on every model call of the
    question), not the older messages, and the answer while it streams (sync: chunks only leave
    after their check). Tool results and tool inputs are never checked by Bedrock. A blocked
    question is replaced in the conversation, also in AgentCore Memory.
    """
    if not (settings.guardrail_id and settings.guardrail_version):
        return {}
    return {
        "guardrail_id": settings.guardrail_id,
        "guardrail_version": settings.guardrail_version,
        "guardrail_latest_message": True,
        "guardrail_stream_processing_mode": "sync",
        "guardrail_redact_input_message": REDACTED_QUESTION,
    }


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


class ViewArgument(HookProvider):
    """
    Sets `view` of every `evaluate_bed` call to the view of the request, whatever the model put
    there: in the simple view the rule engine checks only the spatial rules of this week. The
    view is harmless as tool input; this only keeps the model from leaving it out.
    """

    def __init__(self, view: View) -> None:
        self.view = view

    def register_hooks(self, registry: HookRegistry, **_: Any) -> None:
        registry.add_callback(BeforeToolCallEvent, self.before_tool_call)

    def before_tool_call(self, event: BeforeToolCallEvent) -> None:
        tool_use = event.tool_use
        if tool_use.get("name") != f"{TOOLS_TARGET}___evaluate_bed":
            return
        arguments = tool_use.get("input")
        event.tool_use = {
            **tool_use,
            "input": {**(arguments if isinstance(arguments, dict) else {}), "view": self.view},
        }


def gateway_client(
    url: str,
    token: str,
    tools: Sequence[str] | None = None,
    language: Language = DEFAULT_LANGUAGE,
) -> MCPClient:
    """
    MCP client for the gateway, authenticated with the caller's own ID token. With `tools`,
    the model only sees these gateway tools; the code can still call all of them directly.
    `Accept-Language` sets the language of the tools' texts: the gateway's request interceptor
    hands it to the tool Lambda, so it comes from the request, not from the model.
    """
    return MCPClient(
        url=url,
        headers={"Authorization": f"Bearer {token}", "Accept-Language": language},
        tool_filters=(
            {"allowed": [f"{TOOLS_TARGET}___{tool}" for tool in tools]} if tools else None
        ),
    )


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
    cost of one question. With a guardrail configured, Bedrock checks questions and answers of
    the chat; a wish for suggestions is checked once up front (`guardrail`), because their
    answer is tool input, which the guardrail never sees.
    """

    def __init__(
        self,
        settings: Settings,
        client_factory: Callable[..., Any] = gateway_client,
        *,
        memory: MemoryStore | None = None,
        session_factory: Callable[[Settings, str, str], Any] = memory_session,
        observe: Callable[[Agent], None] | None = None,
        guardrail: GuardrailCheck | None = None,
    ) -> None:
        self._settings = settings
        self._client_factory = client_factory
        self._memory = memory
        self._session_factory = session_factory
        #: Sees each agent after its answer, e.g. its token usage (model comparison, T-45).
        self._observe = observe
        model: dict[str, Any] = {
            "model_id": settings.model_id,
            "region_name": settings.region,
            "max_tokens": settings.max_tokens,
            "temperature": 0.3,
        }
        guarded = guardrail_config(settings)
        self._model = BedrockModel(**model, **guarded)
        self._suggestion_model = BedrockModel(**model)
        if guardrail is None and guarded:
            guardrail = BedrockGuardrailCheck(
                boto3.client("bedrock-runtime", region_name=settings.region), settings
            )
        self._guardrail = guardrail

    def agent(
        self,
        caller: Caller,
        client: Any = None,
        session_id: str | None = None,
        model: BedrockModel | None = None,
        language: Language = DEFAULT_LANGUAGE,
        view: View = DEFAULT_VIEW,
    ) -> Agent:
        """
        The agent for one request. Without `client` it gets the gateway tools of the chat in
        `view` (the simple view has no batches); `evaluate_bed` always checks in `view`.
        """
        if client is None and self._settings.gateway_url:
            client = self._client_factory(
                self._settings.gateway_url, caller.token, CHAT_TOOLS[view], language=language
            )
        tools = [client] if client is not None else []
        session = memory_session_id(session_id) if self._settings.memory_id else None
        return Agent(
            model=model or self._model,
            system_prompt=system_prompt(language, view),
            tools=tools,
            hooks=[ToolCallLimit(self._settings.max_tool_calls), ViewArgument(view)],
            # One gateway call at a time: parallel calls closed the MCP session (T-48 evaluation).
            tool_executor=SequentialToolExecutor(),
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
        self,
        prompt: str,
        caller: Caller,
        session_id: str | None,
        language: Language = DEFAULT_LANGUAGE,
        view: View = DEFAULT_VIEW,
    ) -> AsyncIterator[str]:
        """
        The answer in chunks, for the app's `view`. The guardrail's messages are German (one
        text per guardrail); a chunk that is one of them is replaced with the message in
        `language`. Bedrock sends the message as one chunk of its own.
        """
        # Restoring the conversation reads AgentCore Memory synchronously: off the event loop.
        agent = await asyncio.to_thread(self.agent, caller, None, session_id, None, language, view)
        try:
            used_tool = False
            emitted = False
            blocked = False
            async for event in agent.stream_async(prompt):
                result = event.get("result")
                if getattr(result, "stop_reason", None) == "guardrail_intervened":
                    blocked = True
                if "current_tool_use" in event:
                    used_tool = True
                text = event.get("data")
                if isinstance(text, str) and text:
                    # Text after a tool call starts a new paragraph instead of running on.
                    if used_tool and emitted:
                        text = "\n\n" + text.lstrip()
                    used_tool = False
                    emitted = True
                    yield localize_blocked(text, language)
            if blocked:
                # Counted without content: the question stays out of the logs.
                logger.info("guardrail intervened")
                if not emitted:
                    yield BLOCKED_MESSAGES[language]["input"]
        finally:
            self._done(agent)

    async def suggest(
        self,
        question: str,
        caller: Caller,
        bed_id: str,
        language: Language = DEFAULT_LANGUAGE,
        view: View = DEFAULT_VIEW,
    ) -> SuggestionResult:
        """
        Checked planting suggestions; one agent and gateway session for all rounds. The model
        only looks up plants (`SUGGESTION_TOOLS`); the bed and the checks come from the code.
        The rounds are not stored as conversation, but the caller's fitting preferences go into
        the prompt. The whole request ends after `suggestion_seconds`. A wish the guardrail
        blocks ends before any model call, with its message as the summary. Reasons, summary,
        warnings and errors are in `language`; in the simple `view` all suggestions start this
        week and only the spatial rules check them.
        """
        if not self._settings.gateway_url:
            raise SuggestionError(message(language, "suggestions_unavailable"))
        if self._guardrail is not None:
            blocked = await asyncio.to_thread(self._guardrail.blocked, question, language)
            if blocked:
                logger.info("guardrail intervened")
                return SuggestionResult([], [], blocked, 0)
        client = self._client_factory(
            self._settings.gateway_url, caller.token, SUGGESTION_TOOLS, language=language
        )
        agent = self.agent(
            caller, client, model=self._suggestion_model, language=language, view=view
        )
        model = suggestion_list_model()
        preferences = await self.recall(caller, question)

        async def ask(prompt: str) -> dict[str, Any]:
            result = await agent.invoke_async(prompt, structured_output_model=model)
            output = result.structured_output
            return output.model_dump(exclude_none=True) if output is not None else {}

        try:
            return await suggest(
                ask,
                McpGardenTools(client, language),
                bed_id=bed_id,
                question=question,
                rounds=self._settings.suggestion_rounds,
                today=date.today(),
                preferences=preferences,
                seconds=self._settings.suggestion_seconds,
                language=language,
                view=view,
            )
        finally:
            self._done(agent)

    def _done(self, agent: Agent) -> None:
        try:
            if self._observe is not None:
                self._observe(agent)
        finally:
            # Closes the MCP session to the gateway. A session that broke during the answer fails
            # here again; logged with its cause instead of hiding the answer or the first error.
            try:
                agent.cleanup()
            except Exception:
                logger.warning("closing the gateway session failed", exc_info=True)

    async def recall(self, caller: Caller, query: str) -> list[str]:
        """The caller's preferences that fit `query`; none if memory is off or unavailable."""
        if self._memory is None:
            return []
        try:
            return await asyncio.to_thread(self._memory.recall, caller.user_id, query)
        except Exception:
            logger.exception("recalling preferences failed")
            return []
