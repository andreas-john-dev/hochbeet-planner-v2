import asyncio
from datetime import date
from typing import Any

import pytest

from bed_assistant.suggest import (
    TIMEOUT_MESSAGE,
    Bed,
    McpGardenTools,
    SuggestionError,
    monday_of,
    occupied,
    sanitize,
    snap,
    suggest,
)

TOMATO = "01M49THV00QS1SEJEM64991JH5"
BASIL = "01M49THV0081S9TVW6N7P7AW3Q"
BED_ID = "01J9ZQ3W8D6V2K5M7N8P9R0S1A"
BED = Bed(width_cm=200, depth_cm=100, main_row_direction="H")


def item(**overrides: Any) -> dict[str, Any]:
    return {
        "plantId": TOMATO,
        "kind": "SINGLE",
        "x": 40,
        "y": 50,
        "startDate": "2026-05-04",
        "reason": "Sonnig.",
        **overrides,
    }


def test_snaps_to_the_grid_and_the_monday() -> None:
    [kept], dropped = sanitize([item(x=47, y=51.4, startDate="2026-05-07")], BED)
    assert (kept["x"], kept["y"], kept["startDate"], dropped) == (45, 50, "2026-05-04", 0)
    assert snap(2.4) == 0
    assert monday_of("2026-05-10") == "2026-05-04"
    assert monday_of("kein Datum") is None


@pytest.mark.parametrize(
    "bad",
    [
        item(x=-10),
        item(x=250),
        item(y=120),
        item(plantId="Tomate"),
        item(startDate="morgen"),
        # A row that runs past the bed edge.
        item(kind="ROW", x=180, orientation="H", lengthCm=50),
        "kein Vorschlag",
    ],
)
def test_drops_suggestions_outside_the_bed_or_without_valid_data(bad: Any) -> None:
    assert sanitize([bad], BED) == ([], 1)


def test_rows_get_direction_and_length_on_the_grid() -> None:
    [row], _ = sanitize([item(kind="ROW", x=10, y=20, lengthCm=53)], BED)
    assert row == item(kind="ROW", x=10, y=20, orientation="H", lengthCm=55)


def test_keeps_at_most_six_and_fills_missing_reasons() -> None:
    kept, dropped = sanitize([item(x=10 * i, reason="") for i in range(8)], BED)
    assert (len(kept), dropped) == (6, 2)
    assert kept[0]["reason"] == "Vorschlag des Assistenten."


#: An onion harvested in April and a perennial chive plant still in the bed.
BED_DATA: dict[str, Any] = {
    "plantings": [
        {
            "plant": "Zwiebel",
            "kind": "ROW",
            "from": "2025-10-06",
            "until": "2026-04-27",
            "area": {"x0": 0, "y0": 0, "x1": 100, "y1": 25},
        },
        {
            "plant": "Schnittlauch",
            "kind": "SINGLE",
            "from": "2024-04-01",
            "until": None,
            "area": {"x0": 20, "y0": 60, "x1": 40, "y1": 80},
        },
    ]
}


class FakeTools:
    """Gateway tools: the bed, and the rule engine warning about tomatoes at x < 100."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        self.calls.append((tool, arguments))
        if tool == "get_bed":
            return {"bed": {"widthCm": 200, "depthCm": 100, "mainRowDirection": "H"}, **BED_DATA}
        findings = [
            {"severity": "WARNING", "message": "Tomate steht zu dicht.", "candidates": [i]}
            for i, c in enumerate(arguments["candidates"])
            if c["plantId"] == TOMATO and c["x"] < 100
        ]
        findings.append({"severity": "WARNING", "message": "Altlast im Beet.", "candidates": []})
        unknown = [i for i, c in enumerate(arguments["candidates"]) if c["plantId"] == BASIL]
        return {"findings": findings, "unknownCandidates": unknown}


class FakeModel:
    """Answers each round with the next prepared answer; records the prompts."""

    def __init__(self, *answers: dict[str, Any]) -> None:
        self.answers = list(answers)
        self.prompts: list[str] = []

    async def __call__(self, prompt: str) -> dict[str, Any]:
        self.prompts.append(prompt)
        return self.answers.pop(0)


class SlowModel(FakeModel):
    """Like FakeModel, but the rounds listed in `slow` take longer than any test deadline."""

    def __init__(self, *answers: dict[str, Any], slow: set[int]) -> None:
        super().__init__(*answers)
        self.slow = slow

    async def __call__(self, prompt: str) -> dict[str, Any]:
        if len(self.prompts) + 1 in self.slow:
            await asyncio.sleep(5)
        return await super().__call__(prompt)


async def run(model: FakeModel, tools: FakeTools, rounds: int = 3, seconds: float = 50) -> Any:
    return await suggest(
        model,
        tools,
        bed_id=BED_ID,
        question="Was passt noch?",
        rounds=rounds,
        today=date(2026, 5, 1),
        seconds=seconds,
    )


def test_the_prompt_lists_only_the_areas_still_taken() -> None:
    assert occupied(BED_DATA, date(2026, 5, 1)) == [
        {
            "plant": "Schnittlauch",
            "kind": "SINGLE",
            "area": {"x0": 20, "y0": 60, "x1": 40, "y1": 80},
            "until": None,
        }
    ]


async def test_the_model_gets_the_bed_and_leaves_the_checks_to_the_code() -> None:
    # T-48: Haiku tested positions with evaluate_bed itself and gave up over conflicts the bed
    # already had. Now the bed is in the prompt, and only the code checks.
    model = FakeModel({"suggestions": [item(x=150)], "summary": "Tomate rechts."})
    await run(model, FakeTools())
    prompt = model.prompts[0]
    assert "200 × 100 cm" in prompt
    assert '"plant":"Schnittlauch"' in prompt
    assert "Zwiebel" not in prompt
    assert "find_plants" in prompt
    assert "get_bed" not in prompt
    assert "evaluate_bed" not in prompt
    assert "Konflikte zwischen vorhandenen Pflanzungen sind nicht deine Aufgabe" in prompt


async def test_a_first_round_past_the_deadline_ends_with_a_german_message() -> None:
    model = SlowModel({"suggestions": [item(x=150)], "summary": "Zu spät."}, slow={1})
    with pytest.raises(SuggestionError) as failed:
        await run(model, FakeTools(), seconds=0.2)
    assert str(failed.value) == TIMEOUT_MESSAGE


async def test_a_later_round_past_the_deadline_keeps_the_last_checked_round() -> None:
    model = SlowModel(
        {"suggestions": [item(x=40)], "summary": "Erster Versuch."},
        {"suggestions": [item(x=150)], "summary": "Zu spät."},
        slow={2},
    )
    result = await run(model, FakeTools(), seconds=0.5)
    assert (result.rounds, result.summary) == (1, "Erster Versuch.")
    assert result.suggestions == [item(x=40)]
    assert result.warnings == ["Tomate steht zu dicht."]


async def test_revises_until_the_rule_engine_has_no_warnings() -> None:
    model = FakeModel(
        {"suggestions": [item(x=40)], "summary": "Erster Versuch."},
        {"suggestions": [item(x=150)], "summary": "Tomate weiter rechts."},
    )
    result = await run(model, FakeTools())
    assert result.rounds == 2
    assert result.warnings == []
    assert result.suggestions == [item(x=150)]
    assert result.summary == "Tomate weiter rechts."
    assert "Heute ist 2026-05-01" in model.prompts[0]
    assert "Tomate steht zu dicht." in model.prompts[1]
    # Warnings of the bed alone are not the suggestions' business.
    assert "Altlast" not in model.prompts[1]


async def test_stops_after_the_last_round_and_reports_the_remaining_warnings() -> None:
    tomato_left = {"suggestions": [item(x=40)], "summary": "Links."}
    model = FakeModel(tomato_left, tomato_left, tomato_left)
    tools = FakeTools()
    result = await run(model, tools, rounds=2)
    assert result.rounds == 2
    assert len(model.prompts) == 2
    assert result.warnings == ["Tomate steht zu dicht."]
    assert [c[0] for c in tools.calls] == ["get_bed", "evaluate_bed", "evaluate_bed"]


async def test_drops_unknown_plants_and_skips_the_check_without_suggestions() -> None:
    model = FakeModel({"suggestions": [item(x=150), item(plantId=BASIL, x=10)], "summary": ""})
    result = await run(model, FakeTools())
    assert result.suggestions == [item(x=150)]

    empty = FakeModel({"suggestions": [item(x=999)], "summary": "Kein Platz."})
    tools = FakeTools()
    result = await run(empty, tools)
    assert (result.suggestions, result.summary) == ([], "Kein Platz.")
    assert [c[0] for c in tools.calls] == ["get_bed"]


class FakeClient:
    def __init__(self, result: dict[str, Any]) -> None:
        self.result = result
        self.names: list[str] = []

    async def call_tool_async(self, _id: str, name: str, _args: dict[str, Any]) -> dict[str, Any]:
        self.names.append(name)
        return self.result


async def test_calls_the_gateway_tools_directly_and_turns_errors_into_german_messages() -> None:
    ok = FakeClient({"status": "success", "content": [{"text": '{"beds": []}'}]})
    assert await McpGardenTools(ok).call("list_beds", {}) == {"beds": []}
    assert ok.names == ["garden___list_beds"]

    refused = FakeClient(
        {"status": "success", "content": [{"text": '{"error": "Das Beet gibt es nicht."}'}]}
    )
    with pytest.raises(SuggestionError, match=r"Das Beet gibt es nicht\."):
        await McpGardenTools(refused).call("get_bed", {"bedId": BED_ID})

    broken = FakeClient({"status": "error", "content": [{"text": "boom"}]})
    with pytest.raises(SuggestionError, match="nicht erreichbar"):
        await McpGardenTools(broken).call("get_bed", {"bedId": BED_ID})
