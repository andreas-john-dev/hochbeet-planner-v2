"""Shared test helpers."""

import base64
import json
from typing import Any


def token(claims: dict[str, Any]) -> str:
    """An unsigned JWT with these claims; the runtime verifies signatures, not the agent."""

    def part(data: dict[str, Any]) -> str:
        raw = json.dumps(data).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    return f"{part({'alg': 'RS256'})}.{part(claims)}.signature"
