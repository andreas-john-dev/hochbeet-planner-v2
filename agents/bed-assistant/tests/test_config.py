import pytest

from bed_assistant.config import Settings


def test_reads_the_runtime_environment_with_defaults() -> None:
    settings = Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t"})
    assert settings.daily_limit == 20
    assert settings.allowed_groups == frozenset({"ai-testers", "admins"})
    assert settings.gateway_url == ""
    assert settings.max_tool_calls == 6
    tools = Settings.from_env(
        {
            "MODEL_ID": "m",
            "QUOTA_TABLE": "t",
            "GATEWAY_URL": "https://gw/mcp",
            "MAX_TOOL_CALLS": "3",
        }
    )
    assert (tools.gateway_url, tools.max_tool_calls) == ("https://gw/mcp", 3)


def test_needs_model_and_table() -> None:
    with pytest.raises(KeyError):
        Settings.from_env({"MODEL_ID": "m"})
