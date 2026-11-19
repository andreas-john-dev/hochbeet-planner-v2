"""AgentCore entry point: checks caller, input and quota, then streams the answer as SSE."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Mapping
from functools import cache
from typing import Any

import boto3
from bedrock_agentcore import BedrockAgentCoreApp
from starlette.responses import JSONResponse, Response, StreamingResponse

from .auth import Caller, caller_from_headers
from .config import Settings
from .memory import AgentCoreMemoryStore, MemoryStore
from .messages import Language, language_of, message
from .prompt import (
    DEFAULT_VIEW,
    InvalidRequestError,
    MemoryRequest,
    View,
    parse_memory_request,
    parse_request,
    user_prompt,
)
from .quota import DailyQuota, Quota, QuotaExceededError
from .responder import Responder, StrandsResponder
from .suggest import SuggestionError, SuggestionResult

logger = logging.getLogger("bed_assistant")


def error(text: str, status: int) -> JSONResponse:
    """Same shape as ErrorResponse of the services: a `message` in the request's language."""
    return JSONResponse({"message": text}, status_code=status)


def sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def events(
    chunks: AsyncIterator[str], remaining: int, language: Language = "de"
) -> AsyncIterator[str]:
    """`{"text"}` per chunk, then `{"done", "remaining"}`; a model error ends with `{"error"}`."""
    try:
        async for chunk in chunks:
            yield sse({"text": chunk})
    except Exception:
        logger.exception("model call failed")
        yield sse({"error": message(language, "unavailable")})
        return
    yield sse({"done": True, "remaining": remaining})


async def handle(
    payload: object,
    headers: Mapping[str, str],
    *,
    settings: Settings,
    quota: Quota,
    responder: Responder,
    memory: MemoryStore | None = None,
    session_id: str | None = None,
) -> Response:
    # Refusals before the request is parsed use its language if it has a valid one.
    language = language_of(payload)
    caller = caller_from_headers(headers)
    if caller is None:
        return error(message(language, "sign_in"), 401)
    # The runtime's authorizer checks the groups already; this is the second line of defence.
    if not caller.groups & settings.allowed_groups:
        return error(message(language, "not_enabled"), 403)
    if isinstance(payload, dict) and "memory" in payload:
        try:
            memory_request = parse_memory_request(payload)
        except InvalidRequestError as invalid:
            return error(str(invalid), 400)
        return await memory_response(memory_request, caller, memory)
    try:
        request = parse_request(payload, settings.max_input_chars)
    except InvalidRequestError as invalid:
        return error(str(invalid), 400)
    try:
        remaining = quota.take(caller.user_id)
    except QuotaExceededError:
        return error(message(request.language, "quota", limit=settings.daily_limit), 429)
    logger.info(
        "question",
        extra={
            "userId": caller.user_id,
            "remaining": remaining,
            "language": request.language,
            "view": request.view,
        },
    )
    stream = (
        suggestion_events(
            responder,
            request.message,
            caller,
            request.bed_id,
            remaining,
            request.language,
            request.view,
        )
        if request.suggest and request.bed_id
        else events(
            responder.stream(
                user_prompt(request), caller, session_id, request.language, request.view
            ),
            remaining,
            request.language,
        )
    )
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Quota-Remaining": str(remaining)},
    )


async def memory_response(
    request: MemoryRequest, caller: Caller, memory: MemoryStore | None
) -> Response:
    """Lists or forgets what the assistant remembers about the caller; never about others."""
    unavailable = message(request.language, "memory_unavailable")
    if memory is None:
        return error(unavailable, 503)
    try:
        if request.memory == "list":
            memories = await asyncio.to_thread(memory.preferences, caller.user_id)
            return JSONResponse({"memories": memories})
        records, conversation = await asyncio.to_thread(memory.forget, caller.user_id)
    except Exception:
        logger.exception("memory request failed")
        return error(unavailable, 503)
    logger.info("forgot", extra={"userId": caller.user_id, "memories": records})
    return JSONResponse({"memories": records, "events": conversation})


def suggestion_text(result: SuggestionResult, language: Language = "de") -> str:
    """What the chat shows with the suggestions: the summary and any warnings left."""
    if not result.suggestions:
        return result.summary or message(language, "no_suggestion")
    text = result.summary or message(language, "suggestion_count", count=len(result.suggestions))
    if result.warnings:
        text += "\n\n" + message(language, "warnings_left") + " " + " ".join(result.warnings)
    return text


async def suggestion_events(
    responder: Responder,
    question: str,
    caller: Caller,
    bed_id: str,
    remaining: int,
    language: Language = "de",
    view: View = DEFAULT_VIEW,
) -> AsyncIterator[str]:
    """The summary as text, then the checked suggestions with remaining warnings, then done."""
    try:
        result = await responder.suggest(question, caller, bed_id, language, view)
    except SuggestionError as failed:
        yield sse({"error": str(failed)})
        return
    except Exception:
        logger.exception("suggestions failed")
        yield sse({"error": message(language, "unavailable")})
        return
    logger.info(
        "suggestions",
        extra={
            "count": len(result.suggestions),
            "warnings": len(result.warnings),
            "rounds": result.rounds,
        },
    )
    yield sse({"text": suggestion_text(result, language)})
    yield sse({"suggestions": result.suggestions, "warnings": result.warnings})
    yield sse({"done": True, "remaining": remaining})


@cache
def dependencies() -> tuple[Settings, Quota, Responder, MemoryStore | None]:
    settings = Settings.from_env()
    table = boto3.resource("dynamodb", region_name=settings.region).Table(settings.quota_table)
    memory = (
        AgentCoreMemoryStore(
            boto3.client("bedrock-agentcore", region_name=settings.region), settings.memory_id
        )
        if settings.memory_id
        else None
    )
    responder = StrandsResponder(settings, memory=memory)
    return settings, DailyQuota(table, settings.daily_limit), responder, memory


app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload: dict[str, Any], context: Any) -> Response:
    settings, quota, responder, memory = dependencies()
    headers: Mapping[str, str] = getattr(context, "request_headers", None) or {}
    return await handle(
        payload,
        headers,
        settings=settings,
        quota=quota,
        responder=responder,
        memory=memory,
        session_id=getattr(context, "session_id", None),
    )
