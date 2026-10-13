"""
The fixed test bed: the example bed of the Playwright tests (2 × 1 m, eight plantings) plus a
broccoli before the kale, so the rule engine reports a known set of findings. Dates follow the
day of the run, so the plantings are always current:

- Lauch and Rote Bete, Rote Bete and Spinat: bad neighbours
- Grünkohl and Lauch: heavy feeders too close together
- Grünkohl follows Brokkoli on the same spot (both Kreuzblütler): crop rotation
- Grünkohl and Mangold: good neighbours
"""

import secrets
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

#: Seed plant ids (packages/catalog-seed), the same as in e2e/tests/garden.ts.
PLANTS = {
    "chives": "01M49THV00JTGP22ZW0RKZZT9K",  # Schnittlauch
    "thyme": "01M49THV00Y146B7QH3XHMRCBA",  # Thymian
    "parsley": "01M49THV00W2T9ZJHHDX8H5YMY",  # Petersilie
    "kale": "01M49THV00A6TVTS7JDM60G9YY",  # Grünkohl
    "chard": "01M49THV00PAF8V0RQKEJ6T6FT",  # Mangold
    "leek": "01M49THV00BS8T7Z8ZDSW03PXH",  # Lauch
    "beetroot": "01M49THV007QZ49TY1XCYCQ54J",  # Rote Bete
    "spinach": "01M49THV009C9ACEM9APGSMT4E",  # Spinat
    "broccoli": "01M49THV00NFVX46FHMDBVTEXW",  # Brokkoli
}

WIDTH_CM = 200
DEPTH_CM = 100
BED_PREFIX = "Eval "

_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def ulid() -> str:
    """A new ULID (48-bit time, 80 random bits), as the services expect for ids."""
    value = (int(time.time() * 1000) << 80) | secrets.randbits(80)
    return "".join(_CROCKFORD[(value >> (5 * i)) & 31] for i in reversed(range(26)))


def monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def soil_renewals(previous_end: date, next_start: date) -> list[str]:
    """
    Renewal dates that keep the crop rotation finding: the soil counts as renewed on 1 March
    of every year without own dates, so each year whose 1 March falls between the two
    plantings gets an own date outside that gap.
    """
    dates = []
    for year in range(previous_end.year, next_start.year + 1):
        if previous_end < date(year, 3, 1) <= next_start:
            early, late = date(year, 1, 2), date(year, 12, 30)
            dates.append(early if early <= previous_end else late)
    return [d.isoformat() for d in dates]


@dataclass(frozen=True)
class EvalBed:
    name: str
    #: Body of POST /api/garden/import.
    payload: dict[str, Any]
    #: The bed as the tools and the suggestion check see it.
    width_cm: int = WIDTH_CM
    depth_cm: int = DEPTH_CM


def eval_bed(today: date, run: str) -> EvalBed:
    week = monday(today)
    start = week - timedelta(weeks=6)
    broccoli_start = start - timedelta(weeks=14)
    broccoli_end = start - timedelta(days=7)
    bed_id = ulid()

    def planting(plant: str, x: int, y: int, **extra: Any) -> dict[str, Any]:
        return {
            "id": ulid(),
            "bedId": bed_id,
            "plantId": PLANTS[plant],
            "kind": "SINGLE",
            "x": x,
            "y": y,
            "startDate": start.isoformat(),
            "endDate": None,
            "removedDate": None,
            **extra,
        }

    def row(plant: str, x: int, y: int, orientation: str, length: int, **extra: Any) -> Any:
        return planting(plant, x, y, kind="ROW", orientation=orientation, lengthCm=length, **extra)

    name = f"{BED_PREFIX}{run}"
    plantings = [
        planting("chives", 15, 15),
        planting("thyme", 15, 50),
        planting("parsley", 15, 85),
        planting(
            "broccoli",
            50,
            50,
            startDate=broccoli_start.isoformat(),
            endDate=broccoli_end.isoformat(),
        ),
        planting("kale", 50, 50),
        row("chard", 90, 25, "H", 30),
        row("leek", 85, 75, "H", 45),
        row("beetroot", 160, 10, "V", 80),
        row("spinach", 185, 10, "V", 80, startDate=(week - timedelta(weeks=4)).isoformat()),
    ]
    bed = {
        "id": bed_id,
        "name": name,
        "widthCm": WIDTH_CM,
        "depthCm": DEPTH_CM,
        "mainRowDirection": "V",
        "soilRenewals": soil_renewals(broccoli_end, start),
    }
    payload = {"importId": ulid(), "beds": [bed], "plantings": plantings}
    return EvalBed(name=name, payload=payload)
