"""System prompt and the request the agent answers, with its limits."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

SYSTEM_PROMPT = """\
Du bist der Beet-Assistent im Hochbeet-Planer, ein freundlicher, kundiger Gemüsegärtner.
Du hilfst beim Planen von Hochbeeten: Pflanzabstände, gute und schlechte Nachbarn,
Starkzehrer, Fruchtfolge und Pflanzzeiten.

Werkzeuge (nur lesend, immer mit den Daten des angemeldeten Users):
- list_beds: Beete des Users. get_bed: ein Beet mit seinen Pflanzungen.
- find_plants: Sorten mit Abständen, Nachbarn, Familie und Standzeit.
- evaluate_bed: Hinweise der Regel-Engine des Planers zu einem Beet.
Nutze sie, wenn die Frage Beete, Pflanzungen oder Sorten betrifft, aber sparsam: meist
reichen ein bis drei Aufrufe. Du kannst nichts ändern; Änderungen macht der User im Editor.

Regeln:
- Antworte in der Sprache der Frage (meist Deutsch), knapp und konkret, höchstens etwa 150
  Wörter. Namen von Sorten und Fundstellen der Regel-Engine darfst du deutsch lassen.
- Längen in cm, Daten als Wochen bzw. Monate.
- Erfinde keine Pflanzungen oder Beete; stütze dich auf die Werkzeuge.
- Nenne Beete und Sorten beim Namen, nie mit ihrer ID.
- Vorlieben des Users, die du dir gemerkt hast, stehen vor seiner Frage in <user_context>.
  Berücksichtige sie, ohne sie aufzuzählen. Was du dir merkst, sieht und löscht der User
  im Profil.
- Bist du dir unsicher, sag es. Warnungen des Planers ersetzt du nicht, du erklärst sie.
- Lehne Fragen ohne Bezug zu Garten, Pflanzen oder dem Planer freundlich ab.
"""

_ULID = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")


class InvalidRequestError(Exception):
    """The payload does not match AssistantRequest; the message is shown to the user."""


class AssistantRequest(BaseModel):
    """Mirrors AssistantRequestSchema in packages/contracts/src/api/assistant.ts."""

    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(min_length=1)
    #: The bed the user is looking at; the agent reads it itself with get_bed.
    bed_id: str | None = Field(default=None, alias="bedId")
    #: Planting suggestions for `bed_id` instead of a plain answer.
    suggest: bool = False

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()

    @field_validator("bed_id")
    @classmethod
    def check_bed_id(cls, value: str | None) -> str | None:
        if value is not None and not _ULID.match(value):
            raise ValueError("Keine gültige Beet-ID.")
        return value


def parse_request(payload: object, max_input_chars: int) -> AssistantRequest:
    try:
        request = AssistantRequest.model_validate(payload)
    except ValidationError as error:
        raise InvalidRequestError("Bitte schreib eine Frage an den Assistenten.") from error
    if not request.message:
        raise InvalidRequestError("Bitte schreib eine Frage an den Assistenten.")
    if request.suggest and request.bed_id is None:
        raise InvalidRequestError("Für Pflanzvorschläge brauche ich ein Beet.")
    if len(request.message) > max_input_chars:
        raise InvalidRequestError(
            f"Deine Frage ist zu lang. Bitte fasse dich kürzer (höchstens {max_input_chars} "
            "Zeichen)."
        )
    return request


class MemoryRequest(BaseModel):
    """Mirrors AssistantMemoryRequestSchema: list or forget what the assistant remembers."""

    memory: Literal["list", "forget"]


def parse_memory_request(payload: object) -> MemoryRequest:
    try:
        return MemoryRequest.model_validate(payload)
    except ValidationError as error:
        raise InvalidRequestError("Unbekannte Anfrage an das Gedächtnis.") from error


def user_prompt(request: AssistantRequest) -> str:
    """The question, preceded by the id of the bed on screen if the client sent one."""
    if request.bed_id is None:
        return request.message
    return (
        f"Der User sieht gerade das Beet mit der ID {request.bed_id} (nur für die Werkzeuge, "
        f"nicht in der Antwort nennen).\n\nFrage:\n{request.message}"
    )
