"""
Tracing on the AgentCore runtime (T-47): the AWS Distro for OpenTelemetry (ADOT) instruments
Strands, botocore and httpx and sends the spans to the X-Ray OTLP endpoint; the runtime's trace
delivery puts them into CloudWatch (GenAI Observability). Only with `TRACING=true`, which infra
sets together with `tracingEnabled`; tests, the model comparison and local runs stay untraced.

Spans carry steps, durations, tool names and token counts, never the conversation: Strands
redacts messages, system prompt and tool inputs/results, ADOT does not capture message content,
and the content events ADOT would split off into logs are not exported.
"""

import os
from collections.abc import MutableMapping

#: Strands: redact every sensitive attribute (an empty allowlist of unredacted attributes).
REDACT_ALL = "gen_ai_unredacted_attributes="

#: What the runtime may preset is kept; ADOT's agent mode with X-Ray as the trace backend.
DEFAULTS = {
    "AGENT_OBSERVABILITY_ENABLED": "true",
    "OTEL_PYTHON_DISTRO": "aws_distro",
    "OTEL_PYTHON_CONFIGURATOR": "aws_configurator",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_TRACES_EXPORTER": "otlp",
}

#: Always, whatever is preset: no prompts or answers in spans or logs.
ENFORCED = {
    "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT": "false",
    "OTEL_LOGS_EXPORTER": "none",
    "OTEL_METRICS_EXPORTER": "none",
}


def tracing_enabled(environ: MutableMapping[str, str]) -> bool:
    return environ.get("TRACING", "").lower() == "true"


def configure(environ: MutableMapping[str, str]) -> None:
    """Sets the OpenTelemetry environment for the runtime (before ADOT reads it)."""
    for key, value in DEFAULTS.items():
        environ.setdefault(key, value)
    environ.update(ENFORCED)
    opt_in = [
        token.strip()
        for token in environ.get("OTEL_SEMCONV_STABILITY_OPT_IN", "").split(",")
        if token.strip() and not token.strip().startswith("gen_ai_unredacted_attributes=")
    ]
    environ["OTEL_SEMCONV_STABILITY_OPT_IN"] = ",".join([*opt_in, REDACT_ALL])
    if "OTEL_RESOURCE_ATTRIBUTES" not in environ and environ.get("SERVICE_NAME"):
        environ["OTEL_RESOURCE_ATTRIBUTES"] = f"service.name={environ['SERVICE_NAME']}"


def start_tracing() -> bool:
    """
    Instruments the process like `opentelemetry-instrument` would; call before importing the
    agent so that Strands finds the tracer provider. Returns whether tracing is on.
    """
    if not tracing_enabled(os.environ):
        return False
    configure(os.environ)
    from opentelemetry.instrumentation.auto_instrumentation import initialize

    initialize()
    return True
