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
    #: MCP endpoint of the AgentCore Gateway with the read-only tools; empty means no tools.
    gateway_url: str = ""
    #: Tool calls per question; further calls are refused.
    max_tool_calls: int = 6
    #: Rounds of suggest → check → revise for planting suggestions.
    suggestion_rounds: int = 2
    #: Time for one suggestion request; below the 60 s read timeout of CloudFront.
    suggestion_seconds: float = 50.0
    #: AgentCore Memory for conversations and preferences; empty means no memory.
    memory_id: str = ""
    #: Messages of a conversation the agent keeps in its context (older ones drop out).
    history_messages: int = 20

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
            gateway_url=env.get("GATEWAY_URL", ""),
            max_tool_calls=int(env.get("MAX_TOOL_CALLS", "6")),
            suggestion_rounds=int(env.get("SUGGESTION_ROUNDS", "2")),
            suggestion_seconds=float(env.get("SUGGESTION_SECONDS", "50")),
            memory_id=env.get("MEMORY_ID", ""),
            history_messages=int(env.get("HISTORY_MESSAGES", "20")),
        )
