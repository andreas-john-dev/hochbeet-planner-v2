import re
from collections.abc import AsyncIterator, Callable
from datetime import date
from types import SimpleNamespace
from typing import Any, ClassVar

import pytest

from bed_assistant.auth import Caller
from bed_assistant.suggest import SuggestionResult
from evaluation.bed import PLANTS, eval_bed, monday, soil_renewals, ulid
from evaluation.cases import (
    CASES,
    Case,
    Outcome,
    checks_for,
    in_english,
    in_german,
    mentions,
    no_ids,
    suggestions_in_bed,
    suggests_plant,
    uses,
)
from evaluation.models import BUDGET_USD, MODELS, EvalModel
from evaluation.report import markdown, summarize
from evaluation.runner import MAX_CASE_USD, describe, run_model

TODAY = date(2026, 10, 12)
HAIKU = MODELS["haiku"]
CALLER = Caller("smoke", frozenset({"ai-testers"}), "token")
BED = eval_bed(TODAY, "1")
BED_ID = "01J9ZQ3W8D6V2K5M7N8P9R0S1A"


def test_the_test_bed_is_current_and_keeps_its_crop_rotation_warning() -> None:
    bed = BED.payload["beds"][0]
    plantings = BED.payload["plantings"]
    assert re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{26}", BED.payload["importId"])
    assert {p["bedId"] for p in plantings} == {bed["id"]}
    assert BED.name == "Eval 1"
    for planting in plantings:
        start = date.fromisoformat(planting["startDate"])
        assert start.weekday() == 0
        assert start <= monday(TODAY)
    broccoli = next(p for p in plantings if p["plantId"] == PLANTS["broccoli"])
    kale = next(p for p in plantings if p["plantId"] == PLANTS["kale"])
    assert (broccoli["x"], broccoli["y"]) == (kale["x"], kale["y"])
    assert broccoli["endDate"] < kale["startDate"]


@pytest.mark.parametrize("today", [date(2026, 1, 20), date(2026, 3, 30), date(2026, 10, 12)])
def test_no_soil_renewal_falls_between_broccoli_and_kale(today: date) -> None:
    plantings = eval_bed(today, "x").payload["plantings"]
    end = date.fromisoformat(plantings[3]["endDate"])
    start = date.fromisoformat(plantings[4]["startDate"])
    renewals = [date.fromisoformat(d) for d in soil_renewals(end, start)]
    for year in range(end.year, start.year + 1):
        own = [d for d in renewals if d.year == year]
        effective = own or [date(year, 3, 1)]
        assert not any(end < d <= start for d in effective)


def test_soil_renewals_only_where_1_march_is_in_the_gap() -> None:
    assert soil_renewals(date(2026, 8, 30), date(2026, 9, 7)) == []
    assert soil_renewals(date(2026, 2, 22), date(2026, 3, 2)) == ["2026-01-02"]
    # Across the turn of the year, 2 January would fall into the gap as well.
    assert soil_renewals(date(2025, 12, 28), date(2026, 3, 2)) == ["2026-12-30"]


def test_ulids_are_unique() -> None:
    assert len({ulid() for _ in range(100)}) == 100


def outcome(text: str, **extra: Any) -> Outcome:
    return Outcome(text=text, bed=BED, **extra)


def test_checks_read_the_answer() -> None:
    assert mentions("Brokkoli|Fruchtfolge", "Spinat").passes(outcome("Fruchtfolge und SPINAT"))
    assert not mentions("Spinat").passes(outcome("Grünkohl"))
    assert mentions("Fuchsschwanz").passes(outcome("Fuchsschwanzgewächse"))
    assert not no_ids().passes(outcome("Beet 01J9ZQ3W8D6V2K5M7N8P9R0S1A"))
    assert in_german().passes(outcome("Das ist nicht gut und du solltest"))
    assert not in_german().passes(outcome("Tomatoes need 60 cm between plants."))
    assert in_english().passes(outcome("You should keep 60 cm between the plants."))
    assert uses("get_bed").passes(outcome("", tools=["list_beds", "get_bed"]))


def test_suggestion_checks() -> None:
    inside = {"plantId": "P", "kind": "ROW", "x": 150, "y": 20, "orientation": "V", "lengthCm": 80}
    outside = inside | {"lengthCm": 85}
    assert suggestions_in_bed().passes(outcome("", suggestions=[inside]))
    assert not suggestions_in_bed().passes(outcome("", suggestions=[outside]))
    assert not suggestions_in_bed().passes(outcome("", suggestions=[]))
    named = outcome("", suggestions=[inside], plant_names={"P": "Kopfsalat"})
    assert suggests_plant("salat").passes(named)


def test_the_test_set() -> None:
    assert 18 <= len(CASES) <= 25
    assert len({c.id for c in CASES}) == len(CASES)
    assert any(c.suggest for c in CASES)
    assert sum(c.simple for c in CASES) >= 5
    # Plain answers are always checked for ids, language and length.
    plain = next(c for c in CASES if not c.suggest)
    assert {"keine IDs", "auf Deutsch"} <= {check.label for check in checks_for(plain)}
    # Questions in English get answers in English.
    english = next(c for c in CASES if c.id == "englisch")
    labels = {check.label for check in checks_for(english)}
    assert "auf Englisch" in labels
    assert "auf Deutsch" not in labels


class FakeAgent:
    def __init__(self, tokens: tuple[int, int], tools: dict[str, int]) -> None:
        self.event_loop_metrics = SimpleNamespace(
            accumulated_usage={"inputTokens": tokens[0], "outputTokens": tokens[1]},
            tool_metrics={name: SimpleNamespace(call_count=n) for name, n in tools.items()},
        )


class FakeResponder:
    def __init__(self, observe: Callable[[Any], None], answer: str, fail: bool = False) -> None:
        self.observe = observe
        self.answer = answer
        self.fail = fail
        self.prompts: list[str] = []

    async def stream(
        self, prompt: str, caller: Caller, session_id: str | None
    ) -> AsyncIterator[str]:
        self.prompts.append(prompt)
        if self.fail:
            raise RuntimeError("Bedrock down")
        self.observe(FakeAgent((1000, 200), {"garden___get_bed": 1, "garden___evaluate_bed": 1}))
        for word in self.answer.split(" "):
            yield word + " "

    async def suggest(self, question: str, caller: Caller, bed_id: str) -> SuggestionResult:
        self.observe(FakeAgent((5000, 400), {"garden___find_plants": 2, "SuggestionList": 2}))
        suggestion = {"plantId": "S", "kind": "SINGLE", "x": 100, "y": 50, "reason": "r"}
        return SuggestionResult([suggestion], [], "Ein Vorschlag.", 1)


def factory(answer: str, fail: bool = False) -> Any:
    built: list[FakeResponder] = []

    def build(model: EvalModel, observe: Callable[[Any], None]) -> FakeResponder:
        responder = FakeResponder(observe, answer, fail)
        built.append(responder)
        return responder

    build.built = built  # type: ignore[attr-defined]
    return build


ANSWER = "Grünkohl folgt auf Brokkoli, beide sind Kreuzblütler und das ist nicht gut für dich."


async def test_runs_and_scores_a_plain_question_with_the_bed() -> None:
    case = next(c for c in CASES if c.id == "fruchtfolge")
    build = factory(ANSWER)
    [result] = await run_model(
        HAIKU, [case], build, caller=CALLER, bed=BED, bed_id="B" * 26, plant_names={}
    )
    assert result.ok, result.failed
    assert (result.input_tokens, result.output_tokens, result.tool_calls) == (1000, 200, 2)
    assert result.cost_usd == pytest.approx((1000 * 1.10 + 200 * 5.50) / 1_000_000)
    assert result.first_text_seconds is not None
    # Asked like the app asks: with the bed the user looks at.
    assert "B" * 26 in build.built[0].prompts[0]


async def test_suggestions_count_only_gateway_tools() -> None:
    case = next(c for c in CASES if c.id == "vorschlag")
    [result] = await run_model(
        HAIKU, [case], factory(""), caller=CALLER, bed=BED, bed_id=BED_ID, plant_names={}
    )
    assert result.ok, result.failed
    assert result.tool_calls == 2
    assert result.answer == "Ein Vorschlag."


async def test_errors_fail_all_checks() -> None:
    case = Case("x", "Hallo?", (mentions("Hallo"),))
    [result] = await run_model(
        HAIKU, [case], factory("", fail=True), caller=CALLER, bed=BED, bed_id=BED_ID, plant_names={}
    )
    assert result.error == "RuntimeError: Bedrock down"
    assert result.passed == []
    assert not result.ok


def test_errors_name_their_causes() -> None:
    try:
        try:
            raise ConnectionError("peer closed")
        except ConnectionError as closed:
            raise RuntimeError("Connection to the MCP server was closed") from closed
    except RuntimeError as failure:
        described = describe(failure)
    assert described == (
        "RuntimeError: Connection to the MCP server was closed ← ConnectionError: peer closed"
    )


async def test_stops_before_the_budget_is_exceeded() -> None:
    case = next(c for c in CASES if c.id == "fruchtfolge")
    results = await run_model(
        HAIKU,
        [case, case],
        factory(ANSWER),
        caller=CALLER,
        bed=BED,
        bed_id=BED_ID,
        plant_names={},
        spent_usd=BUDGET_USD - MAX_CASE_USD - 0.0005,
    )
    assert [r.skipped for r in results] == [False, True]


async def test_the_report_compares_the_models() -> None:
    cases = [
        next(c for c in CASES if c.id == "fruchtfolge"),
        Case("x", "Hallo?", (mentions("Moin"),)),
    ]
    results = []
    for model in MODELS.values():
        results += await run_model(
            model, cases, factory(ANSWER), caller=CALLER, bed=BED, bed_id=BED_ID, plant_names={}
        )
    summaries = [summarize(m, [r for r in results if r.model == m.key]) for m in MODELS.values()]
    assert (summaries[0].ok, summaries[0].asked) == (1, 2)
    report = markdown(summaries, results, cases, date="2026-10-12")
    assert "| Claude Haiku 4.5 | 1/2 (50%) |" in report
    assert "| Amazon Nova Lite |" in report
    assert "| x: Hallo? | ✗ nennt Moin | ✗ nennt Moin |" in report
    assert "unter 1 €" in report


def test_costs_follow_the_price_list() -> None:
    assert HAIKU.cost_usd(1_000_000, 0) == pytest.approx(1.10)
    assert MODELS["nova-lite"].cost_usd(0, 1_000_000) == pytest.approx(0.32)


class FakeProd:
    """Prod as the CLI sees it: sign-in, test bed and catalogue, without network."""

    calls: ClassVar[list[str]] = []

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

    def sign_in(self, email: str, password: str) -> str:
        FakeProd.calls.append(f"sign_in:{email}")
        return token_for("smoke-sub")

    def delete_test_beds(self) -> int:
        FakeProd.calls.append("delete")
        return 0

    def create_test_bed(self, bed: Any) -> str:
        FakeProd.calls.append(f"create:{bed.name}")
        return BED_ID

    def plant_names(self) -> dict[str, str]:
        return {}


def token_for(sub: str) -> str:
    from .helpers import token

    return token({"sub": sub, "cognito:groups": ["ai-testers"]})


async def test_the_cli_runs_against_a_fresh_test_bed_and_cleans_up(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    from evaluation import __main__ as cli

    FakeProd.calls = []
    monkeypatch.setattr(cli, "Prod", FakeProd)
    monkeypatch.setattr(cli, "gateway_url", lambda stage, region: "https://gw.example/mcp")
    monkeypatch.setattr(cli, "responder_factory", lambda gateway, region: factory(ANSWER))
    monkeypatch.setenv("SMOKE_USER_EMAIL", "smoke@example.com")
    monkeypatch.setenv("SMOKE_USER_PASSWORD", "secret")
    args = cli.parse_args(
        ["--models", "haiku", "--cases", "fruchtfolge", "--run", "7", "--out", str(tmp_path)]
    )
    assert await cli.main(args) == 0
    assert FakeProd.calls == ["sign_in:smoke@example.com", "delete", "create:Eval 7", "delete"]
    report = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "| Claude Haiku 4.5 | 1/1 (100%) |" in report
    assert '"case": "fruchtfolge"' in (tmp_path / "results.json").read_text(encoding="utf-8")
