from collections.abc import Iterator
from datetime import date
from typing import Any

import boto3
import pytest
from moto import mock_aws

from bed_assistant.quota import DailyQuota, QuotaExceededError


@pytest.fixture
def table() -> Iterator[Any]:
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
        yield dynamodb.create_table(
            TableName="quota",
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )


def test_counts_down_and_stops_at_the_limit(table: Any) -> None:
    quota = DailyQuota(table, limit=3, today=lambda: date(2026, 10, 9))
    assert [quota.take("u-1") for _ in range(3)] == [2, 1, 0]
    with pytest.raises(QuotaExceededError):
        quota.take("u-1")
    # Other users and other days have their own counter.
    assert quota.take("u-2") == 2
    tomorrow = DailyQuota(table, limit=3, today=lambda: date(2026, 10, 10))
    assert tomorrow.take("u-1") == 2


def test_counter_expires_two_days_later(table: Any) -> None:
    DailyQuota(table, limit=3, today=lambda: date(2026, 10, 9)).take("u-1")
    item = table.get_item(Key={"PK": "USER#u-1", "SK": "DAY#2026-10-09"})["Item"]
    assert item["count"] == 1
    assert item["expiresAt"] == 1791676800  # 2026-10-11T00:00:00Z
