"""The models to compare, with the Bedrock prices the cost estimate uses."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalModel:
    key: str
    label: str
    #: EU cross-region inference profile the agent calls.
    model_id: str
    #: USD per million input and output tokens. Upper estimates for EU cross-region inference
    #: (Bedrock price list, October 2026); the report therefore rather overstates the cost.
    usd_per_million_input: float
    usd_per_million_output: float

    def cost_usd(self, input_tokens: int, output_tokens: int) -> float:
        return (
            input_tokens * self.usd_per_million_input + output_tokens * self.usd_per_million_output
        ) / 1_000_000


MODELS: dict[str, EvalModel] = {
    model.key: model
    for model in (
        EvalModel(
            key="haiku",
            label="Claude Haiku 4.5",
            model_id="eu.anthropic.claude-haiku-4-5-20251001-v1:0",
            usd_per_million_input=1.10,
            usd_per_million_output=5.50,
        ),
        EvalModel(
            key="nova-lite",
            label="Amazon Nova Lite",
            model_id="eu.amazon.nova-lite-v1:0",
            usd_per_million_input=0.08,
            usd_per_million_output=0.32,
        ),
    )
}

#: Hard limit of one run in USD, below 1 € at any plausible exchange rate.
BUDGET_USD = 0.90
