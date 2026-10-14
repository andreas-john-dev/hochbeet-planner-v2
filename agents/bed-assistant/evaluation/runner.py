"""Asks every case with one model, through the agent's own responder, and scores the answers."""

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from bed_assistant.app import suggestion_text
from bed_assistant.auth import Caller
from bed_assistant.prompt import AssistantRequest, user_prompt
from bed_assistant.responder import Responder

from .bed import EvalBed
from .cases import Case, Outcome, checks_for
from .models import BUDGET_USD, EvalModel

logger = logging.getLogger("evaluation")

#: Upper estimate of one case's cost; the run stops before a case could exceed the budget.
MAX_CASE_USD = 0.05


@dataclass
class Usage:
    """Token usage and gateway tool calls of the agents that answered one question."""

    input_tokens: int = 0
    output_tokens: int = 0
    tools: list[str] = field(default_factory=list)

    def observe(self, agent: Any) -> None:
        metrics = agent.event_loop_metrics
        usage = metrics.accumulated_usage
        self.input_tokens += int(usage.get("inputTokens", 0))
        self.output_tokens += int(usage.get("outputTokens", 0))
        for name, tool in metrics.tool_metrics.items():
            # Only the gateway's tools (`garden___<tool>`), not Strands' structured output.
            if "___" in name:
                self.tools += [name.split("___", 1)[1]] * int(tool.call_count)


@dataclass
class CaseResult:
    model: str
    case: str
    simple: bool
    passed: list[str]
    failed: list[str]
    input_tokens: int
    output_tokens: int
    tool_calls: int
    seconds: float
    #: Time to the first text chunk (plain answers only).
    first_text_seconds: float | None
    cost_usd: float
    answer: str
    error: str | None = None
    skipped: bool = False

    @property
    def ok(self) -> bool:
        return not self.failed and not self.skipped and self.error is None


ResponderFactory = Callable[[EvalModel, Callable[[Any], None]], Responder]


async def run_model(
    model: EvalModel,
    cases: Sequence[Case],
    responder_for: ResponderFactory,
    *,
    caller: Caller,
    bed: EvalBed,
    bed_id: str,
    plant_names: dict[str, str],
    spent_usd: float = 0.0,
) -> list[CaseResult]:
    """All cases with `model`; stops (skips the rest) before the run could exceed the budget."""
    results = []
    for case in cases:
        if spent_usd + MAX_CASE_USD > BUDGET_USD:
            results.append(skipped(model, case))
            continue
        result = await run_case(
            model,
            case,
            responder_for,
            caller=caller,
            bed=bed,
            bed_id=bed_id,
            plant_names=plant_names,
        )
        spent_usd += result.cost_usd
        logger.info(
            "%s %s: %s (%.4f USD)",
            model.key,
            case.id,
            "ok" if result.ok else result.failed,
            result.cost_usd,
        )
        if not result.ok:
            # Artifacts are not always at hand; the job log shows why a case failed.
            logger.info("  %s", result.error or result.answer[:300].replace("\n", " "))
        results.append(result)
    return results


def skipped(model: EvalModel, case: Case) -> CaseResult:
    return CaseResult(
        model.key, case.id, case.simple, [], [], 0, 0, 0, 0.0, None, 0.0, "", skipped=True
    )


def describe(failure: BaseException) -> str:
    """The error with its causes, innermost last (an MCP session hides why it closed)."""
    parts: list[str] = []
    seen: set[int] = set()
    current: BaseException | None = failure
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        parts.append(f"{type(current).__name__}: {current}")
        current = current.__cause__ or current.__context__
    return " ← ".join(parts)


async def run_case(
    model: EvalModel,
    case: Case,
    responder_for: ResponderFactory,
    *,
    caller: Caller,
    bed: EvalBed,
    bed_id: str,
    plant_names: dict[str, str],
) -> CaseResult:
    usage = Usage()
    responder = responder_for(model, usage.observe)
    outcome = Outcome(text="", plant_names=plant_names, bed=bed)
    error: str | None = None
    first_text: float | None = None
    started = time.perf_counter()
    try:
        if case.suggest:
            result = await responder.suggest(case.question, caller, bed_id)
            outcome.text = suggestion_text(result)
            outcome.suggestions = result.suggestions
            outcome.warnings = result.warnings
        else:
            request = AssistantRequest(
                message=case.question, bedId=bed_id if case.with_bed else None
            )
            async for chunk in responder.stream(user_prompt(request), caller, None):
                if first_text is None:
                    first_text = time.perf_counter() - started
                outcome.text += chunk
    except Exception as failure:
        logger.warning("%s %s failed", model.key, case.id, exc_info=True)
        error = describe(failure)[:300]
    seconds = time.perf_counter() - started
    outcome.tools = usage.tools
    checks = checks_for(case)
    passed = [c.label for c in checks if error is None and c.passes(outcome)]
    failed = [c.label for c in checks if c.label not in passed]
    return CaseResult(
        model=model.key,
        case=case.id,
        simple=case.simple,
        passed=passed,
        failed=failed,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        tool_calls=len(usage.tools),
        seconds=round(seconds, 2),
        first_text_seconds=round(first_text, 2) if first_text is not None else None,
        cost_usd=model.cost_usd(usage.input_tokens, usage.output_tokens),
        answer=outcome.text,
        error=error,
    )
