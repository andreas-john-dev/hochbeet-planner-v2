"""Settings of the agent, from the environment the runtime stack sets (infra/lib/assistant)."""

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    model_id: str
    region: str
    quota_table: str
    daily_limit: int
    max_tokens: int
    max_input_chars: int
    allowed_groups: frozenset[str]

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        return cls(
            model_id=env["MODEL_ID"],
            region=env.get("AWS_REGION", "eu-central-1"),
            quota_table=env["QUOTA_TABLE"],
            daily_limit=int(env.get("DAILY_LIMIT", "20")),
            max_tokens=int(env.get("MAX_TOKENS", "1024")),
            max_input_chars=int(env.get("MAX_INPUT_CHARS", "2000")),
            allowed_groups=frozenset(
                g for g in env.get("ALLOWED_GROUPS", "ai-testers,admins").split(",") if g
            ),
        )
