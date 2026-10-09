"""The model behind the assistant: Strands Agents on Bedrock, streamed as text chunks."""

from collections.abc import AsyncIterator
from typing import Protocol

from strands import Agent
from strands.models.bedrock import BedrockModel

from .config import Settings
from .prompt import SYSTEM_PROMPT


class Responder(Protocol):
    def stream(self, prompt: str) -> AsyncIterator[str]: ...


class StrandsResponder:
    """
    A fresh agent per request: no conversation memory yet (T-44) and no tools yet (T-41), so
    one model call per question, capped by `max_tokens`.
    """

    def __init__(self, settings: Settings) -> None:
        self._model = BedrockModel(
            model_id=settings.model_id,
            region_name=settings.region,
            max_tokens=settings.max_tokens,
            temperature=0.3,
        )

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        agent = Agent(model=self._model, system_prompt=SYSTEM_PROMPT, callback_handler=None)
        async for event in agent.stream_async(prompt):
            text = event.get("data")
            if isinstance(text, str) and text:
                yield text
