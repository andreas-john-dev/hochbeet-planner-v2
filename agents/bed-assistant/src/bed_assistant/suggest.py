"""
Planting suggestions: the model proposes plantings (structured output), the code puts them on
the grid and into the bed, the rule engine (`evaluate_bed` with candidates) checks them, and the
model revises them while warnings remain, for at most `rounds` rounds. Warnings left after the
last round are passed on openly. Nothing here ever saves a planting.

The model gets the bed with the areas its plantings occupy in the prompt and only looks up
plants itself; checking is the code's job. The whole request has a deadline below the 60 s
read timeout of CloudFront: a round that would run past it is dropped, and the last checked
round is answered instead.
"""

import asyncio
import json
import re
import time
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

#: The only gateway tool the model may use for suggestions; get_bed and evaluate_bed run in code.
SUGGESTION_TOOLS = ("find_plants",)

TIMEOUT_MESSAGE = (
    "Die Vorschläge haben zu lange gedauert. Bitte versuche es noch einmal, gern mit einem "
    "genaueren Wunsch."
)

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


def occupied(bed_data: dict[str, Any], today: date) -> list[dict[str, Any]]:
    """Plantings still in the bed from `today` on: plant, kind, occupied area and end."""
    current = []
    for planting in bed_data.get("plantings") or []:
        until = planting.get("until")
        if isinstance(until, str) and until < today.isoformat():
            continue
        entry = {"plant": planting.get("plant"), "kind": planting.get("kind")}
        if isinstance(planting.get("area"), dict):
            entry["area"] = planting["area"]
        entry["until"] = until
        current.append(entry)
    return current


def suggestion_prompt(
    question: str,
    bed: Bed,
    bed_data: dict[str, Any],
    today: date,
    preferences: Sequence[str] = (),
) -> str:
    known = (
        "Bekannte Vorlieben des Users (berücksichtigen):\n"
        + "".join(f"- {p}\n" for p in preferences)
        + "\n"
        if preferences
        else ""
    )
    plantings = json.dumps(occupied(bed_data, today), ensure_ascii=False, separators=(",", ":"))
    return (
        f"Heute ist {today.isoformat()}. Mache Pflanzvorschläge (höchstens {MAX_SUGGESTIONS}) "
        f"für ein Beet von {bed.width_cm} × {bed.depth_cm} cm (x nach rechts, y nach unten, "
        f"Hauptreihenrichtung {bed.main_row_direction}).\n"
        "Belegte Flächen der Pflanzungen, die noch im Beet stehen (area in cm, until = "
        f"Ende, null = dauerhaft):\n{plantings}\n\n"
        "So gehst du vor:\n"
        "- Suche passende Sorten mit find_plants (für plantId und Abstände). Andere Werkzeuge "
        "hast du hier nicht, das Beet steht oben: Das System prüft deine Vorschläge mit der "
        "Regel-Engine und meldet dir Warnungen zurück.\n"
        "- Setze Vorschläge auf freie Flächen: Eine Einzelpflanze belegt einen Kreis mit dem "
        "halben Abstand in der Reihe als Radius, eine Reihe einen Streifen in Reihenabstand "
        "Breite. Positionen in cm auf dem 5-cm-Raster.\n"
        "- Konflikte zwischen vorhandenen Pflanzungen sind nicht deine Aufgabe; schlage trotzdem "
        "vor. Eine leere Liste nur, wenn wirklich keine freie Fläche da ist, auch nicht nach dem "
        "Ende einer Pflanzung.\n"
        "- startDate ist der Montag der Pflanzwoche. Begründe jeden Vorschlag kurz.\n\n"
        f"{known}Wunsch des Users:\n{question}"
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
    preferences: Sequence[str] = (),
    seconds: float = 50.0,
    clock: Callable[[], float] = time.monotonic,
) -> SuggestionResult:
    """
    Runs the check loop: `ask` returns the model's structured answer for a prompt (the same
    conversation across rounds); `evaluate_bed` checks the sanitized suggestions. Everything
    together takes at most `seconds`: a later round that runs out of time is dropped in favour
    of the last checked one, a first round raises a German `SuggestionError`.
    """
    deadline = clock() + seconds

    async def within_deadline[T](step: Awaitable[T]) -> T:
        return await asyncio.wait_for(step, timeout=max(0.0, deadline - clock()))

    try:
        bed_data = await within_deadline(tools.call("get_bed", {"bedId": bed_id}))
    except TimeoutError as late:
        raise SuggestionError(TIMEOUT_MESSAGE) from late
    bed = Bed.from_tool(bed_data)
    prompt = suggestion_prompt(question, bed, bed_data, today, preferences)
    result: SuggestionResult | None = None
    for done in range(1, max(1, rounds) + 1):
        try:
            result, prompt = await within_deadline(
                _round(ask, tools, prompt, bed, bed_id, done, rounds)
            )
        except TimeoutError as late:
            if result is None:
                raise SuggestionError(TIMEOUT_MESSAGE) from late
            break
        if not prompt:
            break
    if result is None:
        raise SuggestionError(TIMEOUT_MESSAGE)
    return result


async def _round(
    ask: Callable[[str], Awaitable[dict[str, Any]]],
    tools: GardenTools,
    prompt: str,
    bed: Bed,
    bed_id: str,
    done: int,
    rounds: int,
) -> tuple[SuggestionResult, str]:
    """One round: ask, sanitize, check. Returns the result and the next prompt ("" = finished)."""
    answer = await ask(prompt)
    summary = str(answer.get("summary") or "").strip()
    suggestions, dropped = sanitize(answer.get("suggestions") or [], bed)
    if not suggestions:
        return SuggestionResult([], [], summary, done), ""
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
    result = SuggestionResult([suggestions[i] for i in known], warnings, summary, done)
    if not warnings or done >= rounds:
        return result, ""
    return result, revision_prompt(warnings, dropped, len(unknown))
