import pytest

from bed_assistant.prompt import (
    AssistantRequest,
    InvalidRequestError,
    parse_request,
    user_prompt,
)


def test_parses_and_trims_the_question() -> None:
    assert parse_request({"message": "  Was passt zu Tomaten? "}, 100).message == (
        "Was passt zu Tomaten?"
    )


@pytest.mark.parametrize("payload", [{}, {"message": ""}, {"message": "   "}, "Hallo", None])
def test_refuses_requests_without_a_question(payload: object) -> None:
    with pytest.raises(InvalidRequestError, match="Bitte schreib eine Frage"):
        parse_request(payload, 100)


def test_refuses_too_long_questions() -> None:
    with pytest.raises(InvalidRequestError, match="höchstens 10 Zeichen"):
        parse_request({"message": "x" * 11}, 10)


def test_names_the_bed_on_screen_before_the_question() -> None:
    request = parse_request({"message": "Passt das?", "bedId": "01J9ZQ3W8D6V2K5M7N8P9R0S1A"}, 100)
    assert user_prompt(request) == (
        "Der User sieht gerade das Beet mit der ID 01J9ZQ3W8D6V2K5M7N8P9R0S1A (nur für die "
        "Werkzeuge, nicht in der Antwort nennen).\n\nFrage:\nPasst das?"
    )
    assert user_prompt(AssistantRequest(message="Nur Text")) == "Nur Text"


def test_refuses_a_bed_id_that_is_no_ulid() -> None:
    with pytest.raises(InvalidRequestError):
        parse_request({"message": "Hi", "bedId": "../admin"}, 100)


def test_the_assistant_answers_in_the_language_of_the_question() -> None:
    from bed_assistant.prompt import SYSTEM_PROMPT

    assert "in der Sprache der Frage" in SYSTEM_PROMPT
