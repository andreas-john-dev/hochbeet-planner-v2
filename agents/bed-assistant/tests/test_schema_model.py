from typing import Any

import pytest
from pydantic import ValidationError

from bed_assistant.schema_model import load_schema, model_from_schema, suggestion_list_model


def test_builds_the_suggestion_model_from_the_exported_contract() -> None:
    model = suggestion_list_model()
    schema = model.model_json_schema()
    item = schema["$defs"]["SuggestionListSuggestionsItem"]
    assert set(item["required"]) == {"plantId", "kind", "x", "y", "startDate", "reason"}
    assert item["properties"]["kind"]["enum"] == ["SINGLE", "ROW"]
    assert "ID der Sorte" in item["properties"]["plantId"]["description"]
    assert load_schema("suggestion_list.json")["properties"]["suggestions"]["maxItems"] == 6


def test_accepts_off_grid_values_for_correction_but_not_wrong_types() -> None:
    model = suggestion_list_model()
    off_grid: dict[str, Any] = {
        "suggestions": [
            {"plantId": "x", "kind": "SINGLE", "x": 47, "y": 3, "startDate": "?", "reason": "r"}
        ],
        "summary": "s",
    }
    assert model.model_validate(off_grid).model_dump(exclude_none=True) == off_grid
    with pytest.raises(ValidationError):
        model.model_validate({"suggestions": [{"kind": "TREE"}], "summary": "s"})


def test_rejects_schemas_it_does_not_understand() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        model_from_schema({"type": "object", "properties": {"a": {"anyOf": []}}}, "Odd")
