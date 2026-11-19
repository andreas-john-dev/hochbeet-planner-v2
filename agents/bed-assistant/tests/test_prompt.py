import pytest

from bed_assistant.messages import Language
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


def test_the_language_of_the_request_lands_in_the_prompt() -> None:
    from bed_assistant.prompt import system_prompt

    english = parse_request({"message": "What fits?", "language": "en"}, 100)
    assert english.language == "en"
    prompt = system_prompt(english.language)
    assert "Die App ist auf Englisch: Antworte auf Englisch (britisches Englisch)" in prompt
    # Unless the user clearly writes German; English names come from find_plants.
    assert "außer der User\n  schreibt erkennbar auf Deutsch" in prompt
    assert "nameEn, familyEn" in prompt
    assert "{" not in prompt


def test_without_a_language_the_assistant_answers_in_german() -> None:
    from bed_assistant.prompt import system_prompt

    request = parse_request({"message": "Was passt?"}, 100)
    assert request.language == "de"
    assert system_prompt() == system_prompt(request.language)
    assert "Die App ist auf Deutsch: Antworte auf Deutsch" in system_prompt()
    assert "Englisch" not in system_prompt()


def test_refuses_an_unknown_language_and_answers_refusals_in_english() -> None:
    with pytest.raises(InvalidRequestError, match="Bitte schreib eine Frage"):
        parse_request({"message": "Salut", "language": "fr"}, 100)
    with pytest.raises(InvalidRequestError, match="Please write a question"):
        parse_request({"message": " ", "language": "en"}, 100)
    with pytest.raises(InvalidRequestError, match="at most 10 characters"):
        parse_request({"message": "x" * 11, "language": "en"}, 10)


@pytest.mark.parametrize(
    "tool", ["list_beds", "get_bed", "find_plants", "list_sowings", "evaluate_bed"]
)
def test_the_prompt_names_every_gateway_tool(tool: str) -> None:
    from bed_assistant.prompt import system_prompt

    SYSTEM_PROMPT = system_prompt()

    assert f"{tool}:" in SYSTEM_PROMPT


def test_the_prompt_explains_raising_with_the_users_last_frost() -> None:
    from bed_assistant.prompt import system_prompt

    SYSTEM_PROMPT = system_prompt()

    assert "Anzucht-Chargen" in SYSTEM_PROMPT
    assert "letzter Frosttermin" in SYSTEM_PROMPT
    assert "nach dem letzten Frost des Users" in SYSTEM_PROMPT
    # The assistant only reads batches; the user creates them.
    assert "Chargen legt er auf der Seite Anzucht an" in SYSTEM_PROMPT


def test_suggestions_still_see_only_find_plants() -> None:
    from bed_assistant.suggest import SUGGESTION_TOOLS

    assert SUGGESTION_TOOLS == ("find_plants",)


def test_the_prompt_asks_for_the_markdown_the_app_renders() -> None:
    from bed_assistant.prompt import system_prompt

    SYSTEM_PROMPT = system_prompt()

    # apps/web renders bold, italic, code and lists (src/lib/markdown.ts), nothing more.
    assert "Markdown" in SYSTEM_PROMPT
    assert "Keine Tabellen, Links, Bilder oder Überschriften" in SYSTEM_PROMPT


def test_without_a_view_the_assistant_stays_in_the_expert_view() -> None:
    from bed_assistant.prompt import system_prompt

    request = parse_request({"message": "Was passt?"}, 100)
    assert request.view == "EXPERT"
    assert system_prompt() == system_prompt("de", request.view)
    assert "Fruchtfolge, Pflanzzeiten und Anzucht" in system_prompt()
    assert "einfache Ansicht" not in system_prompt()


@pytest.mark.parametrize("language", ["de", "en"])
def test_the_simple_view_lands_in_the_prompt(language: Language) -> None:
    from bed_assistant.prompt import system_prompt

    request = parse_request({"message": "Was passt?", "view": "SIMPLE", "language": language}, 100)
    assert request.view == "SIMPLE"
    prompt = system_prompt(request.language, request.view)
    assert "Der User nutzt die einfache Ansicht" in prompt
    # No rotation, soil renewal, dates or raising: the user plants this week.
    assert "Fruchtfolge, Erde erneuern, Termine" in prompt
    assert "Sprich sie nicht an" in prompt
    assert "gelten für diese Woche" in prompt
    # Same rules and language as the expert view, without the batches.
    assert system_prompt(language).endswith(prompt[prompt.index("Regeln:") :])
    assert "list_sowings" not in prompt
    assert "Anzucht-Chargen" not in prompt
    assert "{" not in prompt


def test_refuses_an_unknown_view() -> None:
    with pytest.raises(InvalidRequestError, match="Bitte schreib eine Frage"):
        parse_request({"message": "Hi", "view": "EASY"}, 100)


@pytest.mark.parametrize("tool", ["list_beds", "get_bed", "find_plants", "evaluate_bed"])
def test_the_simple_prompt_names_every_tool_of_its_chat(tool: str) -> None:
    from bed_assistant.prompt import CHAT_TOOLS, system_prompt

    assert tool in (CHAT_TOOLS["SIMPLE"] or ())
    assert f"{tool}:" in system_prompt(view="SIMPLE")
