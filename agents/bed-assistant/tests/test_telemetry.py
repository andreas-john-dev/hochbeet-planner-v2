import pytest

from bed_assistant.telemetry import REDACT_ALL, configure, start_tracing, tracing_enabled


def test_only_with_tracing_switched_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TRACING", raising=False)
    assert not start_tracing()
    assert tracing_enabled({"TRACING": "true"})
    assert not tracing_enabled({"TRACING": "false"})


def test_traces_go_to_xray_without_any_conversation_content() -> None:
    environ = {"SERVICE_NAME": "prod_bed_assistant"}
    configure(environ)
    assert environ["AGENT_OBSERVABILITY_ENABLED"] == "true"
    assert environ["OTEL_PYTHON_DISTRO"] == "aws_distro"
    assert environ["OTEL_TRACES_EXPORTER"] == "otlp"
    assert environ["OTEL_RESOURCE_ATTRIBUTES"] == "service.name=prod_bed_assistant"
    # Strands redacts messages, prompts and tool inputs/results; ADOT keeps no content.
    assert environ["OTEL_SEMCONV_STABILITY_OPT_IN"] == REDACT_ALL
    assert environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] == "false"
    assert environ["OTEL_LOGS_EXPORTER"] == "none"


def test_keeps_what_the_runtime_presets_but_never_the_content() -> None:
    environ = {
        "OTEL_RESOURCE_ATTRIBUTES": "service.name=runtime",
        "OTEL_TRACES_EXPORTER": "otlp,console",
        "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT": "true",
        "OTEL_LOGS_EXPORTER": "otlp",
        "OTEL_SEMCONV_STABILITY_OPT_IN": (
            "gen_ai_latest_experimental, gen_ai_unredacted_attributes=gen_ai.*"
        ),
    }
    configure(environ)
    assert environ["OTEL_RESOURCE_ATTRIBUTES"] == "service.name=runtime"
    assert environ["OTEL_TRACES_EXPORTER"] == "otlp,console"
    assert environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] == "false"
    assert environ["OTEL_LOGS_EXPORTER"] == "none"
    assert environ["OTEL_SEMCONV_STABILITY_OPT_IN"] == f"gen_ai_latest_experimental,{REDACT_ALL}"
