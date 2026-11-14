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


@pytest.mark.parametrize(
    "tool", ["list_beds", "get_bed", "find_plants", "list_sowings", "evaluate_bed"]
)
def test_the_prompt_names_every_gateway_tool(tool: str) -> None:
    from bed_assistant.prompt import SYSTEM_PROMPT

    assert f"{tool}:" in SYSTEM_PROMPT


def test_the_prompt_explains_raising_with_the_users_last_frost() -> None:
    from bed_assistant.prompt import SYSTEM_PROMPT

    assert "Anzucht-Chargen" in SYSTEM_PROMPT
    assert "letzter Frosttermin" in SYSTEM_PROMPT
    assert "nach dem letzten Frost des Users" in SYSTEM_PROMPT
    # The assistant only reads batches; the user creates them.
    assert "Chargen legt er auf der Seite Anzucht an" in SYSTEM_PROMPT


def test_suggestions_still_see_only_find_plants() -> None:
    from bed_assistant.suggest import SUGGESTION_TOOLS

    assert SUGGESTION_TOOLS == ("find_plants",)


def test_the_prompt_asks_for_the_markdown_the_app_renders() -> None:
    from bed_assistant.prompt import SYSTEM_PROMPT

    # apps/web renders bold, italic, code and lists (src/lib/markdown.ts), nothing more.
    assert "Markdown" in SYSTEM_PROMPT
    assert "Keine Tabellen, Links, Bilder oder Überschriften" in SYSTEM_PROMPT
