"""System prompt and the request the agent answers, with its limits."""

import json
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

SYSTEM_PROMPT = """\
Du bist der Beet-Assistent im Hochbeet-Planer, ein freundlicher, kundiger Gemüsegärtner.
Du hilfst beim Planen von Hochbeeten: Pflanzabstände, gute und schlechte Nachbarn,
Starkzehrer, Fruchtfolge und Pflanzzeiten.

Regeln:
- Antworte immer auf Deutsch, knapp und konkret, höchstens etwa 150 Wörter.
- Längen in cm, Daten als Wochen bzw. Monate.
- Nutze die mitgeschickten Beetdaten, wenn vorhanden; erfinde keine Pflanzungen.
- Bist du dir unsicher, sag es. Warnungen des Planers ersetzt du nicht, du erklärst sie.
- Lehne Fragen ohne Bezug zu Garten, Pflanzen oder dem Planer freundlich ab.
"""

#: Bed data longer than this is cut, so a huge bed cannot blow up the input tokens.
MAX_CONTEXT_CHARS = 6000


class InvalidRequestError(Exception):
    """The payload does not match AssistantRequest; the message is shown to the user."""


class AssistantRequest(BaseModel):
    """Mirrors AssistantRequestSchema in packages/contracts/src/api/assistant.ts."""

    message: str = Field(min_length=1)
    bed: dict[str, Any] | None = None

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()


def parse_request(payload: object, max_input_chars: int) -> AssistantRequest:
    try:
        request = AssistantRequest.model_validate(payload)
    except ValidationError as error:
        raise InvalidRequestError("Bitte schreib eine Frage an den Assistenten.") from error
    if not request.message:
        raise InvalidRequestError("Bitte schreib eine Frage an den Assistenten.")
    if len(request.message) > max_input_chars:
        raise InvalidRequestError(
            f"Deine Frage ist zu lang. Bitte fasse dich kürzer (höchstens {max_input_chars} "
            "Zeichen)."
        )
    return request


def user_prompt(request: AssistantRequest) -> str:
    """The question, preceded by the current bed as compact JSON if the client sent one."""
    if request.bed is None:
        return request.message
    context = json.dumps(request.bed, ensure_ascii=False, separators=(",", ":"))
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[:MAX_CONTEXT_CHARS] + " …(gekürzt)"
    return f"Aktuelles Beet (JSON):\n{context}\n\nFrage:\n{request.message}"
