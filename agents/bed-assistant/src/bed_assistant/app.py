"""AgentCore entry point: checks caller, input and quota, then streams the answer as SSE."""

import json
import logging
from collections.abc import AsyncIterator, Mapping
from functools import cache
from typing import Any

import boto3
from bedrock_agentcore import BedrockAgentCoreApp
from starlette.responses import JSONResponse, Response, StreamingResponse

from .auth import caller_from_headers
from .config import Settings
from .prompt import InvalidRequestError, parse_request, user_prompt
from .quota import DailyQuota, Quota, QuotaExceededError
from .responder import Responder, StrandsResponder

logger = logging.getLogger("bed_assistant")

UNAVAILABLE = "Der Assistent ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal."


def error(message: str, status: int) -> JSONResponse:
    """Same shape as ErrorResponse of the services: a German `message`."""
    return JSONResponse({"message": message}, status_code=status)


def sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def events(chunks: AsyncIterator[str], remaining: int) -> AsyncIterator[str]:
    """`{"text"}` per chunk, then `{"done", "remaining"}`; a model error ends with `{"error"}`."""
    try:
        async for chunk in chunks:
            yield sse({"text": chunk})
    except Exception:
        logger.exception("model call failed")
        yield sse({"error": UNAVAILABLE})
        return
    yield sse({"done": True, "remaining": remaining})


async def handle(
    payload: object,
    headers: Mapping[str, str],
    *,
    settings: Settings,
    quota: Quota,
    responder: Responder,
) -> Response:
    caller = caller_from_headers(headers)
    if caller is None:
        return error("Bitte melde dich an.", 401)
    # The runtime's authorizer checks the groups already; this is the second line of defence.
    if not caller.groups & settings.allowed_groups:
        return error("Der Assistent ist noch nicht für dein Konto freigeschaltet.", 403)
    try:
        request = parse_request(payload, settings.max_input_chars)
    except InvalidRequestError as invalid:
        return error(str(invalid), 400)
    try:
        remaining = quota.take(caller.user_id)
    except QuotaExceededError:
        return error(
            f"Du hast heute schon {settings.daily_limit} Fragen gestellt. Morgen geht es weiter.",
            429,
        )
    logger.info("question", extra={"userId": caller.user_id, "remaining": remaining})
    return StreamingResponse(
        events(responder.stream(user_prompt(request)), remaining),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Quota-Remaining": str(remaining)},
    )


@cache
def dependencies() -> tuple[Settings, Quota, Responder]:
    settings = Settings.from_env()
    table = boto3.resource("dynamodb", region_name=settings.region).Table(settings.quota_table)
    return settings, DailyQuota(table, settings.daily_limit), StrandsResponder(settings)


app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload: dict[str, Any], context: Any) -> Response:
    settings, quota, responder = dependencies()
    headers: Mapping[str, str] = getattr(context, "request_headers", None) or {}
    return await handle(payload, headers, settings=settings, quota=quota, responder=responder)
