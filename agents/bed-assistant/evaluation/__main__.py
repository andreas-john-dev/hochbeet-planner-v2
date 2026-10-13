"""
Runs the model comparison against prod (`PYTHONPATH=src uv run python -m evaluation`). Needs
AWS credentials that may invoke the compared models and read the gateway URL (the role of the
workflow `assistant-eval.yml`), plus the smoke user (SMOKE_USER_EMAIL, SMOKE_USER_PASSWORD).
"""

import argparse
import asyncio
import json
import logging
import os
from collections.abc import Callable
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

from bed_assistant.auth import caller_from_headers
from bed_assistant.config import Settings
from bed_assistant.responder import Responder, StrandsResponder

from .bed import eval_bed
from .cases import CASES
from .models import MODELS, EvalModel
from .prod import Prod, gateway_url
from .report import markdown, summarize
from .runner import CaseResult, run_model


def responder_factory(gateway: str, region: str) -> Callable[..., Responder]:
    """The agent as deployed (same prompt, tools and limits), with the model to compare."""

    def build(model: EvalModel, observe: Callable[[Any], None]) -> Responder:
        settings = Settings.from_env(
            {
                "MODEL_ID": model.model_id,
                "AWS_REGION": region,
                "QUOTA_TABLE": "-",
                "GATEWAY_URL": gateway,
            }
        )
        return StrandsResponder(settings, observe=observe)

    return build


async def main(args: argparse.Namespace) -> int:
    models = [MODELS[key] for key in args.models.split(",")]
    cases = [c for c in CASES if not args.cases or c.id in args.cases.split(",")]
    prod = Prod(args.base_url)
    token = prod.sign_in(os.environ["SMOKE_USER_EMAIL"], os.environ["SMOKE_USER_PASSWORD"])
    caller = caller_from_headers({"Authorization": f"Bearer {token}"})
    if caller is None:
        raise SystemExit("Die Anmeldung des Smoke-Users lieferte kein lesbares Token.")
    today = date.today()
    bed = eval_bed(today, args.run)
    prod.delete_test_beds()
    bed_id = prod.create_test_bed(bed)
    results: list[CaseResult] = []
    try:
        names = prod.plant_names()
        build = responder_factory(gateway_url(args.stage, args.region), args.region)
        for model in models:
            spent = sum(r.cost_usd for r in results)
            results += await run_model(
                model,
                cases,
                build,
                caller=caller,
                bed=bed,
                bed_id=bed_id,
                plant_names=names,
                spent_usd=spent,
            )
    finally:
        prod.delete_test_beds()
    summaries = [summarize(m, [r for r in results if r.model == m.key]) for m in models]
    report = markdown(summaries, results, cases, date=today.isoformat())
    write_results(Path(args.out), report, results)
    print(report)
    return 0


def write_results(out: Path, report: str, results: list[CaseResult]) -> None:
    """report.md for people (job summary, docs), results.json with every answer."""
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(report, encoding="utf-8")
    (out / "results.json").write_text(
        json.dumps([asdict(r) for r in results], ensure_ascii=False, indent=2), encoding="utf-8"
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Modellvergleich des Beet-Assistenten")
    parser.add_argument("--base-url", default="https://hochbeet.andi-john-dev.de")
    parser.add_argument("--stage", default="prod")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--models", default=",".join(MODELS))
    parser.add_argument("--cases", default="", help="Nur diese Fälle (IDs, kommagetrennt)")
    parser.add_argument("--run", default=os.environ.get("GITHUB_RUN_ID", "lokal"))
    parser.add_argument("--out", default="eval-out")
    return parser.parse_args(argv)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    raise SystemExit(asyncio.run(main(parse_args())))
