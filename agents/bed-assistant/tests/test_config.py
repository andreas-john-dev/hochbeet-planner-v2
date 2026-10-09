import pytest

from bed_assistant.config import Settings


def test_reads_the_runtime_environment_with_defaults() -> None:
    settings = Settings.from_env({"MODEL_ID": "m", "QUOTA_TABLE": "t"})
    assert settings.daily_limit == 20
    assert settings.allowed_groups == frozenset({"ai-testers", "admins"})


def test_needs_model_and_table() -> None:
    with pytest.raises(KeyError):
        Settings.from_env({"MODEL_ID": "m"})
