"""Daily message quota per user in DynamoDB: the hard limit that keeps model costs small."""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any, Protocol
from zoneinfo import ZoneInfo

from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import Table
else:
    Table = Any

BERLIN = ZoneInfo("Europe/Berlin")


class QuotaExceededError(Exception):
    """The user has used up today's messages."""


class Quota(Protocol):
    def take(self, user_id: str) -> int: ...


def berlin_today() -> date:
    return datetime.now(BERLIN).date()


class DailyQuota:
    """
    One counter item per user and day (`USER#<sub>`, `DAY#<date>`), counted up atomically with
    a condition, so parallel requests can never exceed the limit. Old counters expire via TTL.
    """

    def __init__(self, table: Table, limit: int, today: Callable[[], date] = berlin_today) -> None:
        self._table = table
        self._limit = limit
        self._today = today

    def take(self, user_id: str) -> int:
        """Counts one message; returns how many are left today."""
        day = self._today()
        expires = datetime.combine(day + timedelta(days=2), datetime.min.time(), tzinfo=UTC)
        try:
            result = self._table.update_item(
                Key={"PK": f"USER#{user_id}", "SK": f"DAY#{day.isoformat()}"},
                UpdateExpression="ADD #count :one SET expiresAt = if_not_exists(expiresAt, :exp)",
                ConditionExpression="attribute_not_exists(#count) OR #count < :limit",
                ExpressionAttributeNames={"#count": "count"},
                ExpressionAttributeValues={
                    ":one": 1,
                    ":limit": self._limit,
                    ":exp": int(expires.timestamp()),
                },
                ReturnValues="UPDATED_NEW",
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise QuotaExceededError from error
            raise
        used = int(str(result.get("Attributes", {}).get("count", self._limit)))
        return max(self._limit - used, 0)
