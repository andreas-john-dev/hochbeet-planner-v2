"""
Pydantic models built at runtime from the JSON Schemas that packages/contracts exports to
`schemas/` (`pnpm --filter @hochbeet/contracts schemas`), so the contract is kept in one place.

The models carry types, required fields, enums and descriptions, which is what the model needs
for structured output. Patterns, ranges and the 5 cm grid are deliberately left out: an answer
slightly off the grid is corrected by `suggest.sanitize` instead of failing the whole answer.
"""

import json
from functools import cache
from importlib import resources
from typing import Any, Literal

from pydantic import BaseModel, Field, create_model

_TYPES: dict[str, Any] = {"string": str, "integer": int, "number": float, "boolean": bool}


def _field_type(schema: dict[str, Any], name: str) -> Any:
    if "enum" in schema:
        return Literal[tuple(schema["enum"])]
    kind = schema.get("type")
    if kind == "object":
        return model_from_schema(schema, name)
    if kind == "array":
        return list[_field_type(schema["items"], f"{name}Item")]  # type: ignore[misc]
    if kind in _TYPES:
        return _TYPES[kind]
    raise ValueError(f"Unsupported JSON schema for {name}: {schema}")


def model_from_schema(schema: dict[str, Any], name: str) -> type[BaseModel]:
    """A pydantic model for an object schema; optional fields default to None."""
    required = set(schema.get("required", []))
    fields: dict[str, Any] = {}
    for key, prop in schema.get("properties", {}).items():
        annotation = _field_type(prop, f"{name}{key[:1].upper()}{key[1:]}")
        description = prop.get("description")
        if key in required:
            fields[key] = (annotation, Field(description=description))
        else:
            fields[key] = (annotation | None, Field(default=None, description=description))
    model: type[BaseModel] = create_model(name, __doc__=schema.get("description"), **fields)
    return model


@cache
def load_schema(file: str) -> dict[str, Any]:
    text = resources.files("bed_assistant").joinpath("schemas", file).read_text("utf-8")
    schema: dict[str, Any] = json.loads(text)
    return schema


@cache
def suggestion_list_model() -> type[BaseModel]:
    """`SuggestionListSchema` of packages/contracts as pydantic model."""
    return model_from_schema(load_schema("suggestion_list.json"), "SuggestionList")
