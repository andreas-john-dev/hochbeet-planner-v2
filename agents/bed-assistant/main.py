"""Entry point of the AgentCore runtime: serves the agent on port 8080."""

from bed_assistant.app import app

if __name__ == "__main__":
    app.run()
