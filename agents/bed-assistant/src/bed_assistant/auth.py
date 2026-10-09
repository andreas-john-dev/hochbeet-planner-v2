"""The caller, from the ID token the runtime's JWT authorizer has already verified."""

import base64
import binascii
import json
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Caller:
    #: Cognito `sub`; the only source of the user id.
    user_id: str
    groups: frozenset[str]


def _header(headers: Mapping[str, str], name: str) -> str | None:
    wanted = name.lower()
    return next((value for key, value in headers.items() if key.lower() == wanted), None)


def caller_from_headers(headers: Mapping[str, str]) -> Caller | None:
    """
    Reads `sub` and `cognito:groups` from the bearer token. The runtime only lets requests
    through whose token it verified (issuer, audience, groups), so the signature is not checked
    again here; a token that cannot be read means no caller.
    """
    authorization = _header(headers, "Authorization") or ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token.count(".") != 2:
        return None
    payload = token.split(".")[1]
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (binascii.Error, ValueError):
        return None
    if not isinstance(claims, dict):
        return None
    sub = claims.get("sub")
    groups = claims.get("cognito:groups", [])
    if not isinstance(sub, str) or not sub:
        return None
    if isinstance(groups, str):
        groups = groups.strip("[]").replace(",", " ").split()
    if not isinstance(groups, list):
        groups = []
    return Caller(user_id=sub, groups=frozenset(str(g) for g in groups))
