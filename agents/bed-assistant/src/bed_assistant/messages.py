"""
What the runtime itself says to the user, in German and English (T-72): refusals, errors and
the texts around suggestions. The app sends its language with every request (`language`);
without one, everything stays German. The model's own answers follow the system prompt.
"""

from typing import Literal

Language = Literal["de", "en"]

LANGUAGES: tuple[Language, ...] = ("de", "en")
DEFAULT_LANGUAGE: Language = "de"

#: ASSISTANT_BLOCKED_MESSAGES in packages/contracts (a test compares them). The guardrail is
#: configured with the German ones; the agent replaces them with the request's language.
BLOCKED_MESSAGES: dict[Language, dict[str, str]] = {
    "de": {
        "input": (
            "Dabei kann ich dir leider nicht helfen. Frag mich gern etwas zu deinen Beeten, "
            "Pflanzen oder zur Anzucht."
        ),
        "output": (
            "Diese Antwort kann ich dir leider nicht geben. Frag mich gern etwas anderes zu "
            "deinen Beeten und Pflanzen."
        ),
    },
    "en": {
        "input": (
            "Sorry, I can't help you with that. Feel free to ask me about your beds, plants or "
            "raising seedlings."
        ),
        "output": (
            "Sorry, I can't give you that answer. Feel free to ask me something else about your "
            "beds and plants."
        ),
    },
}

MESSAGES: dict[Language, dict[str, str]] = {
    "de": {
        "sign_in": "Bitte melde dich an.",
        "not_enabled": "Der Assistent ist noch nicht für dein Konto freigeschaltet.",
        "quota": "Du hast heute schon {limit} Fragen gestellt. Morgen geht es weiter.",
        "unavailable": (
            "Der Assistent ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal."
        ),
        "memory_unavailable": "Das Gedächtnis des Assistenten ist gerade nicht erreichbar.",
        "question_required": "Bitte schreib eine Frage an den Assistenten.",
        "bed_required": "Für Pflanzvorschläge brauche ich ein Beet.",
        "too_long": ("Deine Frage ist zu lang. Bitte fasse dich kürzer (höchstens {max} Zeichen)."),
        "unknown_memory_request": "Unbekannte Anfrage an das Gedächtnis.",
        "no_suggestion": "Ich habe gerade keinen passenden Vorschlag für dieses Beet.",
        "suggestion_count": "{count} Vorschläge für dein Beet.",
        "warnings_left": "Die Regel-Engine meldet noch:",
        "suggestions_unavailable": "Pflanzvorschläge sind gerade nicht verfügbar.",
        "bed_unreadable": "Das Beet konnte nicht gelesen werden.",
        "garden_unreachable": "Die Gartendaten sind gerade nicht erreichbar.",
        "timeout": (
            "Die Vorschläge haben zu lange gedauert. Bitte versuche es noch einmal, gern mit "
            "einem genaueren Wunsch."
        ),
        "default_reason": "Vorschlag des Assistenten.",
    },
    "en": {
        "sign_in": "Please sign in.",
        "not_enabled": "The assistant has not been enabled for your account yet.",
        "quota": "You have already asked {limit} questions today. You can continue tomorrow.",
        "unavailable": "The assistant cannot be reached right now. Please try again in a moment.",
        "memory_unavailable": "The assistant's memory cannot be reached right now.",
        "question_required": "Please write a question to the assistant.",
        "bed_required": "I need a bed for planting suggestions.",
        "too_long": "Your question is too long. Please keep it shorter (at most {max} characters).",
        "unknown_memory_request": "Unknown request to the memory.",
        "no_suggestion": "I have no suitable suggestion for this bed right now.",
        "suggestion_count": "{count} suggestions for your bed.",
        "warnings_left": "The rule engine still reports:",
        "suggestions_unavailable": "Planting suggestions are not available right now.",
        "bed_unreadable": "The bed could not be read.",
        "garden_unreachable": "The garden data cannot be reached right now.",
        "timeout": (
            "The suggestions took too long. Please try again, ideally with a more specific wish."
        ),
        "default_reason": "Suggested by the assistant.",
    },
}


def message(language: Language, key: str, **params: object) -> str:
    """The text `key` in `language`, with `params` filled in."""
    return MESSAGES[language][key].format(**params)


def language_of(payload: object) -> Language:
    """The request's language, also before the request is valid; German without a known one."""
    value = payload.get("language") if isinstance(payload, dict) else None
    return next((language for language in LANGUAGES if language == value), DEFAULT_LANGUAGE)


def localize_blocked(text: str, language: Language) -> str:
    """The guardrail's German message (input or output) in `language`; other text unchanged."""
    stripped = text.strip()
    for kind, german in BLOCKED_MESSAGES["de"].items():
        if stripped == german:
            return BLOCKED_MESSAGES[language][kind]
    return text
