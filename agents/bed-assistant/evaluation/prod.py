"""
Access to prod as the smoke user: Cognito sign-in (SRP, like the app), the garden API for the
test bed, the catalogue for plant names and the gateway URL from SSM. Nothing here logs the
password or the token.
"""

import json
import urllib.request
from typing import Any

import boto3
from pycognito import Cognito

from .bed import BED_PREFIX, EvalBed

#: SSM parameter with the MCP endpoint of the tools (infra/lib/config/ssm.ts).
GATEWAY_URL_PARAMETER = "/hochbeet/{stage}/assistant/gateway-url"


class Prod:
    def __init__(self, base_url: str, token: str = "") -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def request(self, method: str, path: str, body: object | None = None) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(  # noqa: S310 - fixed https base URL
            f"{self.base_url}{path}", data=data, method=method, headers=headers
        )
        with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
            raw = response.read()
        return json.loads(raw) if raw else None

    def sign_in(self, email: str, password: str) -> str:
        """The smoke user's ID token, signed in with SRP against the app's user pool."""
        config = self.request("GET", "/config.json")
        user = Cognito(
            config["userPoolId"],
            config["userPoolClientId"],
            username=email,
            user_pool_region=config["region"],
        )
        user.authenticate(password=password)
        self.token = str(user.id_token)
        return self.token

    def plant_names(self) -> dict[str, str]:
        plants = self.request("GET", "/api/catalog/plants")["plants"]
        return {str(p["id"]): str(p["name"]) for p in plants}

    def delete_test_beds(self) -> int:
        """Deletes test beds of this and earlier (aborted) runs; returns how many."""
        beds = self.request("GET", "/api/garden/beds")["beds"]
        old = [b for b in beds if str(b["name"]).startswith(BED_PREFIX)]
        for bed in old:
            self.request("DELETE", f"/api/garden/beds/{bed['id']}")
        return len(old)

    def create_test_bed(self, bed: EvalBed) -> str:
        """Imports the test bed; returns its new id."""
        result = self.request("POST", "/api/garden/import", bed.payload)
        return str(result["bedIds"][bed.payload["beds"][0]["id"]])


def gateway_url(stage: str, region: str) -> str:
    ssm = boto3.client("ssm", region_name=region)
    name = GATEWAY_URL_PARAMETER.format(stage=stage)
    return str(ssm.get_parameter(Name=name)["Parameter"]["Value"])
