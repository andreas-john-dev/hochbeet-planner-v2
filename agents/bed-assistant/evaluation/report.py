"""Summary per model and per question, as Markdown for the job summary and the docs."""

import statistics
from collections.abc import Sequence
from dataclasses import dataclass

from .cases import Case
from .models import BUDGET_USD, EvalModel
from .runner import CaseResult


@dataclass(frozen=True)
class Summary:
    model: EvalModel
    asked: int
    ok: int
    simple_asked: int
    simple_ok: int
    checks_passed: int
    checks_total: int
    tool_calls: float
    input_tokens: float
    output_tokens: float
    cost_per_question_usd: float
    #: Cost of all asked questions per passed one (T-64); None if none passed.
    cost_per_ok_usd: float | None
    cost_usd: float
    seconds_median: float
    seconds_max: float
    errors: int
    skipped: int


def summarize(model: EvalModel, results: Sequence[CaseResult]) -> Summary:
    asked = [r for r in results if not r.skipped]
    simple = [r for r in asked if r.simple]
    n = max(len(asked), 1)
    cost = sum(r.cost_usd for r in asked)
    ok = sum(r.ok for r in asked)
    return Summary(
        model=model,
        asked=len(asked),
        ok=ok,
        simple_asked=len(simple),
        simple_ok=sum(r.ok for r in simple),
        checks_passed=sum(len(r.passed) for r in asked),
        checks_total=sum(len(r.passed) + len(r.failed) for r in asked),
        tool_calls=sum(r.tool_calls for r in asked) / n,
        input_tokens=sum(r.input_tokens for r in asked) / n,
        output_tokens=sum(r.output_tokens for r in asked) / n,
        cost_per_question_usd=cost / n,
        # Failed questions cost too: a cheap model that is often wrong pays for it here.
        cost_per_ok_usd=cost / ok if ok else None,
        cost_usd=cost,
        seconds_median=statistics.median([r.seconds for r in asked]) if asked else 0.0,
        seconds_max=max((r.seconds for r in asked), default=0.0),
        errors=sum(r.error is not None for r in asked),
        skipped=len(results) - len(asked),
    )


def _rate(part: int, whole: int) -> str:
    return f"{part}/{whole} ({part / whole:.0%})" if whole else "–"


def _usd(value: float | None) -> str:
    return "–" if value is None else f"{value:.4f} $"


def markdown(
    summaries: Sequence[Summary],
    results: Sequence[CaseResult],
    cases: Sequence[Case],
    *,
    date: str,
) -> str:
    total = sum(s.cost_usd for s in summaries)
    lines = [
        f"## Modellvergleich Beet-Assistent ({date})",
        "",
        "| Modell | Fragen bestanden | davon einfache Aufgaben | Prüfungen bestanden"
        " | Tool-Aufrufe/Frage | Tokens ein/aus je Frage | Kosten/Frage | Kosten/bestandene Frage"
        " | Latenz Median (max) | Fehler |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for s in summaries:
        lines.append(
            f"| {s.model.label} | {_rate(s.ok, s.asked)} | {_rate(s.simple_ok, s.simple_asked)}"
            f" | {_rate(s.checks_passed, s.checks_total)} | {s.tool_calls:.1f}"
            f" | {s.input_tokens:,.0f} / {s.output_tokens:,.0f}"
            f" | {_usd(s.cost_per_question_usd)} | {_usd(s.cost_per_ok_usd)}"
            f" | {s.seconds_median:.1f} s ({s.seconds_max:.1f} s)"
            f" | {s.errors}{f', {s.skipped} übersprungen' if s.skipped else ''} |"
        )
    lines += [
        "",
        f"Kosten des Laufs (geschätzt, obere Grenze): **{_usd(total)}**,"
        f" Grenze {BUDGET_USD:.2f} $ (unter 1 €).",
        "Kosten/bestandene Frage: Kosten aller gestellten Fragen geteilt durch die bestandenen;"
        " übersprungene Fragen zählen nicht.",
        "",
        "### Je Frage",
        "",
        "| Frage | " + " | ".join(s.model.label for s in summaries) + " |",
        "| --- | " + " | ".join("---" for _ in summaries) + " |",
    ]
    by_key = {(r.model, r.case): r for r in results}
    for case in cases:
        cells = []
        for s in summaries:
            r = by_key.get((s.model.key, case.id))
            if r is None or r.skipped:
                cells.append("übersprungen")
            elif r.error:
                cells.append("Fehler")
            elif r.ok:
                cells.append("✓")
            else:
                cells.append("✗ " + "; ".join(r.failed))
        lines.append(f"| {case.id}: {case.question} | " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"
