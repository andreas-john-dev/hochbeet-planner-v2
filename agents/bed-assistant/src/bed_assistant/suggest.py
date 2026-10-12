"""
Planting suggestions: the model proposes plantings (structured output), the code puts them on
the grid and into the bed, the rule engine (`evaluate_bed` with candidates) checks them, and the
model revises them while warnings remain, for at most `rounds` rounds. Warnings left after the
last round are passed on openly. Nothing here ever saves a planting.
"""

import json
import re
import uuid
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Protocol

GRID_CM = 5
MAX_SUGGESTIONS = 6
DEFAULT_ROW_CM = 50
MAX_REASON_CHARS = 300

#: Target name of the tools in the gateway (infra: TOOLS_TARGET_NAME); tools are `garden___<x>`.
TOOLS_TARGET = "garden"

_ULID = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")


class SuggestionError(Exception):
    """Suggestions cannot be made; the message is German and goes to the user."""


@dataclass(frozen=True)
class Bed:
    width_cm: int
    depth_cm: int
    main_row_direction: str

    @classmethod
    def from_tool(cls, data: dict[str, Any]) -> "Bed":
        bed = data.get("bed")
        if not isinstance(bed, dict):
            raise SuggestionError("Das Beet konnte nicht gelesen werden.")
        return cls(int(bed["widthCm"]), int(bed["depthCm"]), str(bed["mainRowDirection"]))


@dataclass(frozen=True)
class SuggestionResult:
    suggestions: list[dict[str, Any]]
    #: Rule engine warnings that still involve the suggestions after the last round.
    warnings: list[str]
    summary: str
    rounds: int


def snap(cm: float) -> int:
    return int(round(cm / GRID_CM) * GRID_CM)


def monday_of(value: str) -> str | None:
    try:
        day = date.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    return (day - timedelta(days=day.weekday())).isoformat()


def sanitize(raw: Sequence[Any], bed: Bed) -> tuple[list[dict[str, Any]], int]:
    """
    Puts suggestions onto the 5 cm grid and the Monday of their week; drops those without a
    valid plant id or date, or outside the bed. Returns the kept ones and how many were dropped.
    """
    kept: list[dict[str, Any]] = []
    dropped = 0
    for item in raw:
        suggestion = _sanitize_one(item, bed)
        if suggestion is None or len(kept) >= MAX_SUGGESTIONS:
            dropped += 1
        else:
            kept.append(suggestion)
    return kept, dropped


def _sanitize_one(item: Any, bed: Bed) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    plant_id = item.get("plantId")
    start = monday_of(str(item.get("startDate", "")))
    if not isinstance(plant_id, str) or not _ULID.match(plant_id) or start is None:
        return None
    try:
        x, y = snap(float(item["x"])), snap(float(item["y"]))
    except (KeyError, TypeError, ValueError):
        return None
    if not (0 <= x <= bed.width_cm and 0 <= y <= bed.depth_cm):
        return None
    reason = (
        str(item.get("reason") or "").strip()[:MAX_REASON_CHARS] or "Vorschlag des Assistenten."
    )
    suggestion: dict[str, Any] = {
        "plantId": plant_id,
        "kind": "ROW" if item.get("kind") == "ROW" else "SINGLE",
        "x": x,
        "y": y,
        "startDate": start,
        "reason": reason,
    }
    if suggestion["kind"] == "ROW":
        orientation = item.get("orientation")
        if orientation not in ("H", "V"):
            orientation = bed.main_row_direction
        length = max(GRID_CM, snap(float(item.get("lengthCm") or DEFAULT_ROW_CM)))
        end = x + length if orientation == "H" else y + length
        if end > (bed.width_cm if orientation == "H" else bed.depth_cm):
            return None
        suggestion["orientation"] = orientation
        suggestion["lengthCm"] = length
    return suggestion


def candidates(suggestions: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """The suggestions as `evaluate_bed` candidates (without the reason)."""
    return [{k: v for k, v in s.items() if k != "reason"} for s in suggestions]


class GardenTools(Protocol):
    async def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]: ...


class McpGardenTools:
    """Calls the gateway tools directly (not through the model) with the caller's session."""

    def __init__(self, client: Any) -> None:
        self._client = client

    async def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result = await self._client.call_tool_async(
            str(uuid.uuid4()), f"{TOOLS_TARGET}___{tool}", arguments
        )
        content = result.get("content") or []
        text = next((c.get("text") for c in content if isinstance(c, dict) and "text" in c), None)
        try:
            data = json.loads(text) if isinstance(text, str) else None
        except json.JSONDecodeError:
            data = None
        if result.get("status") == "error" or not isinstance(data, dict):
            raise SuggestionError("Die Gartendaten sind gerade nicht erreichbar.")
        if isinstance(data.get("error"), str):
            raise SuggestionError(data["error"])
        return data


def suggestion_prompt(question: str, bed_id: str, today: date) -> str:
    return (
        f"Heute ist {today.isoformat()}. Mache Pflanzvorschläge für das Beet mit der ID {bed_id}"
        f" (höchstens {MAX_SUGGESTIONS}).\n"
        "Lies das Beet mit get_bed und suche passende Sorten mit find_plants (für die plantId).\n"
        "Positionen in cm im Beet auf dem 5-cm-Raster, Abstände der Sorten beachten, "
        "startDate ist der Montag der Pflanzwoche. Begründe jeden Vorschlag kurz.\n\n"
        f"Wunsch des Users:\n{question}"
    )


def revision_prompt(warnings: Sequence[str], dropped: int, unknown: int) -> str:
    lines = ["Die Regel-Engine meldet für deine Vorschläge noch Warnungen:"]
    lines += [f"- {w}" for w in warnings]
    if dropped:
        lines.append(f"{dropped} Vorschläge lagen außerhalb des Beets und wurden verworfen.")
    if unknown:
        lines.append(f"{unknown} Vorschläge hatten eine unbekannte Sorte und wurden verworfen.")
    lines.append("Überarbeite die Vorschläge so, dass die Warnungen verschwinden.")
    return "\n".join(lines)


async def suggest(
    ask: Callable[[str], Awaitable[dict[str, Any]]],
    tools: GardenTools,
    *,
    bed_id: str,
    question: str,
    rounds: int,
    today: date,
) -> SuggestionResult:
    """
    Runs the check loop: `ask` returns the model's structured answer for a prompt (the same
    conversation across rounds); `evaluate_bed` checks the sanitized suggestions.
    """
    bed = Bed.from_tool(await tools.call("get_bed", {"bedId": bed_id}))
    prompt = suggestion_prompt(question, bed_id, today)
    suggestions: list[dict[str, Any]] = []
    warnings: list[str] = []
    summary = ""
    done = 0
    for done in range(1, max(1, rounds) + 1):
        answer = await ask(prompt)
        summary = str(answer.get("summary") or "").strip()
        suggestions, dropped = sanitize(answer.get("suggestions") or [], bed)
        if not suggestions:
            warnings = []
            break
        evaluation = await tools.call(
            "evaluate_bed", {"bedId": bed_id, "candidates": candidates(suggestions)}
        )
        unknown = set(evaluation.get("unknownCandidates") or [])
        known = [i for i in range(len(suggestions)) if i not in unknown]
        warnings = list(
            dict.fromkeys(
                str(f["message"])
                for f in evaluation.get("findings") or []
                if f.get("severity") == "WARNING" and set(f.get("candidates") or []) & set(known)
            )
        )
        suggestions = [suggestions[i] for i in known]
        if not warnings or done >= rounds:
            break
        prompt = revision_prompt(warnings, dropped, len(unknown))
    return SuggestionResult(suggestions, warnings, summary, done)
