import pytest

from bed_assistant.prompt import (
    MAX_CONTEXT_CHARS,
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


def test_puts_the_bed_before_the_question_and_cuts_huge_beds() -> None:
    small = user_prompt(AssistantRequest(message="Passt das?", bed={"name": "Süd"}))
    assert small == 'Aktuelles Beet (JSON):\n{"name":"Süd"}\n\nFrage:\nPasst das?'
    huge = user_prompt(AssistantRequest(message="?", bed={"x": "y" * (MAX_CONTEXT_CHARS * 2)}))
    assert "…(gekürzt)" in huge
    assert len(huge) < MAX_CONTEXT_CHARS + 100
    assert user_prompt(AssistantRequest(message="Nur Text")) == "Nur Text"
