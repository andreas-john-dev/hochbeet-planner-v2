"""
The test set: about 20 questions with the properties a good answer has. The checks are rules
on the answer, not a judge model, so a run costs only the answers themselves and gives the
same verdict every time.
"""

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from .bed import EvalBed


@dataclass
class Outcome:
    """What one question produced, as the checks see it."""

    text: str
    #: Gateway tools the model called (without the `garden___` prefix), in order.
    tools: list[str] = field(default_factory=list)
    #: Checked planting suggestions (suggestion mode only).
    suggestions: list[dict[str, Any]] = field(default_factory=list)
    #: Rule engine warnings left for the suggestions.
    warnings: list[str] = field(default_factory=list)
    #: Plant names by id, to read suggestions.
    plant_names: dict[str, str] = field(default_factory=dict)
    bed: EvalBed | None = None


@dataclass(frozen=True)
class Check:
    label: str
    passes: Callable[[Outcome], bool]


def _norm(text: str) -> str:
    return text.casefold().replace("ß", "ss")


def mentions(*words: str) -> Check:
    """Each word (alternatives with `|`) occurs in the answer, ignoring case."""

    def passes(outcome: Outcome) -> bool:
        text = _norm(outcome.text)
        return all(any(_norm(w) in text for w in word.split("|")) for word in words)

    return Check(f"nennt {', '.join(words)}", passes)


def avoids(*words: str) -> Check:
    def passes(outcome: Outcome) -> bool:
        text = _norm(outcome.text)
        return not any(_norm(w) in text for w in words)

    return Check(f"ohne {', '.join(words)}", passes)


def uses(*tools: str) -> Check:
    """The model called at least one of these tools."""
    return Check(f"nutzt {' oder '.join(tools)}", lambda o: any(t in o.tools for t in tools))


def uses_no_tools() -> Check:
    return Check("ohne Werkzeuge", lambda o: not o.tools)


_ULID = re.compile(r"\b[0-9A-HJKMNP-TV-Z]{26}\b")
_GERMAN = re.compile(r"\b(und|der|die|das|ist|nicht|mit|du|dein)\b", re.IGNORECASE)


def no_ids() -> Check:
    return Check("keine IDs", lambda o: not _ULID.search(o.text))


def in_german() -> Check:
    return Check("auf Deutsch", lambda o: len(_GERMAN.findall(o.text)) >= 3)


def at_most_words(limit: int) -> Check:
    return Check(f"höchstens {limit} Wörter", lambda o: len(o.text.split()) <= limit)


def suggests(at_least: int = 1) -> Check:
    return Check(f"mindestens {at_least} Vorschlag", lambda o: len(o.suggestions) >= at_least)


def suggestions_in_bed() -> Check:
    def passes(outcome: Outcome) -> bool:
        bed = outcome.bed
        if bed is None or not outcome.suggestions:
            return False
        for s in outcome.suggestions:
            length = int(s.get("lengthCm", 0)) if s.get("kind") == "ROW" else 0
            end_x = s["x"] + (length if s.get("orientation") == "H" else 0)
            end_y = s["y"] + (length if s.get("orientation") == "V" else 0)
            if not (0 <= s["x"] <= end_x <= bed.width_cm and 0 <= s["y"] <= end_y <= bed.depth_cm):
                return False
        return True

    return Check("bleibt im Beet", passes)


def no_warnings_left() -> Check:
    return Check("Vorschläge ohne Warnungen", lambda o: bool(o.suggestions) and not o.warnings)


def suggests_plant(*names: str) -> Check:
    def passes(outcome: Outcome) -> bool:
        suggested = [_norm(outcome.plant_names.get(s["plantId"], "")) for s in outcome.suggestions]
        return any(_norm(n) in s for s in suggested for n in names)

    return Check(f"schlägt {' oder '.join(names)} vor", passes)


@dataclass(frozen=True)
class Case:
    id: str
    question: str
    checks: Sequence[Check]
    #: Asked about the test bed (the user looks at it in the editor).
    with_bed: bool = False
    suggest: bool = False
    #: Simple task in the sense of the recommendation (e.g. explain a warning).
    simple: bool = False


#: Applied to every plain answer on top of the case's own checks.
COMMON_CHECKS: Sequence[Check] = (no_ids(), in_german(), at_most_words(220))

CASES: Sequence[Case] = (
    # Warnings of the test bed: does it find and explain them?
    Case(
        "warnungen",
        "Welche Warnungen hat mein Beet?",
        (uses("evaluate_bed"), mentions("Brokkoli|Fruchtfolge", "Rote Bete", "Spinat", "Lauch")),
        with_bed=True,
    ),
    Case(
        "fruchtfolge",
        "Warum bekomme ich eine Warnung zur Fruchtfolge?",
        (mentions("Grünkohl", "Brokkoli", "Kreuzblütler"),),
        with_bed=True,
        simple=True,
    ),
    Case(
        "nachbarn-lauch",
        "Was ist das Problem mit Lauch und Roter Bete?",
        (mentions("Nachbar"),),
        with_bed=True,
        simple=True,
    ),
    Case(
        "starkzehrer",
        "Warum warnt der Planer bei Grünkohl und Lauch?",
        (mentions("Starkzehrer", "30 cm|Abstand"),),
        with_bed=True,
        simple=True,
    ),
    Case(
        "spinat",
        "Erkläre mir die Warnung zu Roter Bete und Spinat.",
        (mentions("Spinat", "Nachbar"),),
        with_bed=True,
        simple=True,
    ),
    Case(
        "gute-nachbarn",
        "Gibt es in meinem Beet auch gute Nachbarn?",
        (mentions("Mangold", "Grünkohl"),),
        with_bed=True,
        simple=True,
    ),
    Case(
        "inhalt",
        "Was wächst gerade in meinem Beet?",
        (uses("get_bed"), mentions("Grünkohl", "Lauch", "Spinat", "Mangold")),
        with_bed=True,
    ),
    Case(
        "fenchel",
        "Kann ich in diesem Beet noch Fenchel pflanzen?",
        (uses("get_bed", "find_plants", "evaluate_bed"), mentions("Fenchel")),
        with_bed=True,
    ),
    Case(
        "beet-id",
        "Wie lautet die ID von diesem Beet?",
        (),
        with_bed=True,
    ),
    # Catalogue knowledge, read with the tools.
    Case(
        "abstand-tomate",
        "Wie viel Abstand brauchen Tomaten?",
        (uses("find_plants"), mentions("60")),
        simple=True,
    ),
    Case(
        "nachbarn-salat",
        "Welche guten Nachbarn hat Kopfsalat?",
        (uses("find_plants"), mentions("Radieschen|Kohlrabi|Tomate|Erdbeere")),
        simple=True,
    ),
    Case(
        "kartoffel",
        "Darf ich Tomaten neben Kartoffeln pflanzen?",
        (mentions("nicht|schlecht|besser"),),
        simple=True,
    ),
    Case(
        "familie-mangold",
        "Zu welcher Pflanzenfamilie gehört Mangold?",
        (mentions("Fuchsschwanz"),),
        simple=True,
    ),
    Case(
        "beete",
        "Welche Beete habe ich?",
        (uses("list_beds"), mentions("Eval")),
    ),
    Case(
        "englisch",
        "How far apart should I plant tomatoes?",
        (mentions("60"),),
        simple=True,
    ),
    # Off topic: refuse kindly, without tools.
    Case("mathe", "Was ist 5+5?", (uses_no_tools(), avoids("= 10", "ist 10", "lautet 10"))),
    Case(
        "gedicht",
        "Schreib mir ein Gedicht über Autos.",
        (uses_no_tools(), mentions("Garten|Beet|Pflanz")),
    ),
    # Checked planting suggestions.
    Case(
        "vorschlag",
        "Was kann ich in dieses Beet noch pflanzen?",
        (suggests(), suggestions_in_bed(), no_warnings_left()),
        with_bed=True,
        suggest=True,
    ),
    Case(
        "vorschlag-salat",
        "Ich möchte noch Salat ergänzen.",
        (suggests(), suggestions_in_bed(), no_warnings_left(), suggests_plant("salat")),
        with_bed=True,
        suggest=True,
    ),
    Case(
        "vorschlag-kraeuter",
        "Welche Kräuter passen noch dazu?",
        (suggests(), suggestions_in_bed(), no_warnings_left()),
        with_bed=True,
        suggest=True,
    ),
)


def checks_for(case: Case) -> Sequence[Check]:
    return (*case.checks, *(() if case.suggest else COMMON_CHECKS))
