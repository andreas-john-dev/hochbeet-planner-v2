"""Entry point of the AgentCore runtime: serves the agent on port 8080."""

from bed_assistant.telemetry import start_tracing

# Before the agent is imported: Strands takes the tracer provider ADOT sets up.
start_tracing()

from bed_assistant.app import app  # noqa: E402

if __name__ == "__main__":
    app.run()
