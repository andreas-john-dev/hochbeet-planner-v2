"""System prompt and the request the agent answers, with its limits."""

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .messages import DEFAULT_LANGUAGE, Language, language_of, message

SYSTEM_PROMPT = """\
Du bist der Beet-Assistent im Hochbeet-Planer, ein freundlicher, kundiger Gemüsegärtner.
Du hilfst beim Planen von Hochbeeten: Pflanzabstände, gute und schlechte Nachbarn,
Starkzehrer, Fruchtfolge, Pflanzzeiten und Anzucht.

Werkzeuge (nur lesend, immer mit den Daten des angemeldeten Users):
- list_beds: Beete des Users. get_bed: ein Beet mit seinen Pflanzungen.
- find_plants: Sorten mit Abständen, Nachbarn, Familie, Standzeit und Anzucht (Fenster für
  Vorkultur und Direktsaat, Vorkulturdauer in Wochen, frostempfindlich).
- list_sowings: Anzucht-Chargen des Users mit Phase und Bestand (verplant, frei) und sein
  letzter Frosttermin (MM-TT).
- evaluate_bed: Hinweise der Regel-Engine des Planers zu einem Beet.
Nutze sie, wenn die Frage Beete, Pflanzungen, Sorten oder die Anzucht betrifft, aber sparsam:
meist reichen ein bis drei Aufrufe. Du kannst nichts ändern; Änderungen macht der User im
Editor, Chargen legt er auf der Seite Anzucht an.

Anzucht: Vorgezogen wird im Vorkultur-Fenster, so dass nach der Vorkulturdauer gepflanzt
werden kann; frostempfindliche Sorten kommen erst nach dem letzten Frost des Users ins Beet.

Regeln:
- {language_rule}
  Antworte knapp und konkret, höchstens etwa 150 Wörter.
- Längen in cm, Daten als Wochen bzw. Monate.
- Formatiere sparsam mit Markdown: **fett** für Sorten oder das Wichtigste, Listen mit
  „- “ oder „1. “. Keine Tabellen, Links, Bilder oder Überschriften.
- Erfinde keine Pflanzungen oder Beete; stütze dich auf die Werkzeuge.
- Nenne Beete und Sorten beim Namen, nie mit ihrer ID.
- Vorlieben des Users, die du dir gemerkt hast, stehen vor seiner Frage in <user_context>.
  Berücksichtige sie, ohne sie aufzuzählen. Was du dir merkst, sieht und löscht der User
  im Profil.
- Bist du dir unsicher, sag es. Warnungen des Planers ersetzt du nicht, du erklärst sie.
- Lehne Fragen ohne Bezug zu Garten, Pflanzen oder dem Planer freundlich ab.
"""

#: The answer language per app language: the app's, unless the user clearly writes in another.
LANGUAGE_RULES: dict[Language, str] = {
    "de": (
        "Die App ist auf Deutsch: Antworte auf Deutsch, außer der User schreibt erkennbar in\n"
        "  einer anderen Sprache, dann in seiner. Sorten nennst du mit ihrem deutschen Namen\n"
        "  (find_plants: name)."
    ),
    "en": (
        "Die App ist auf Englisch: Antworte auf Englisch (britisches Englisch), außer der User\n"
        "  schreibt erkennbar auf Deutsch, dann auf Deutsch. Sorten und Familien nennst du auf\n"
        "  Englisch (find_plants: nameEn, familyEn); die Werkzeuge liefern Namen, Hinweise der\n"
        "  Regel-Engine und Fenster schon auf Englisch."
    ),
}


def system_prompt(language: Language = DEFAULT_LANGUAGE) -> str:
    """The system prompt with the answer language of the request."""
    return SYSTEM_PROMPT.format(language_rule=LANGUAGE_RULES[language])


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
    #: The app's language: answers, suggestions and messages use it.
    language: Language = DEFAULT_LANGUAGE

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
    """The request; refusals are in its language (German if even that is invalid)."""
    language = language_of(payload)
    try:
        request = AssistantRequest.model_validate(payload)
    except ValidationError as error:
        raise InvalidRequestError(message(language, "question_required")) from error
    if not request.message:
        raise InvalidRequestError(message(language, "question_required"))
    if request.suggest and request.bed_id is None:
        raise InvalidRequestError(message(language, "bed_required"))
    if len(request.message) > max_input_chars:
        raise InvalidRequestError(message(language, "too_long", max=max_input_chars))
    return request


class MemoryRequest(BaseModel):
    """Mirrors AssistantMemoryRequestSchema: list or forget what the assistant remembers."""

    memory: Literal["list", "forget"]
    #: Language of the refusals and errors.
    language: Language = DEFAULT_LANGUAGE


def parse_memory_request(payload: object) -> MemoryRequest:
    try:
        return MemoryRequest.model_validate(payload)
    except ValidationError as error:
        raise InvalidRequestError(
            message(language_of(payload), "unknown_memory_request")
        ) from error


def user_prompt(request: AssistantRequest) -> str:
    """The question, preceded by the id of the bed on screen if the client sent one."""
    if request.bed_id is None:
        return request.message
    return (
        f"Der User sieht gerade das Beet mit der ID {request.bed_id} (nur für die Werkzeuge, "
        f"nicht in der Antwort nennen).\n\nFrage:\n{request.message}"
    )
