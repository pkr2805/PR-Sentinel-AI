"""PR Sentinel core engine: collect PR facts, classify them, ask the LLM only when needed, plan and take actions.

Nothing in this package depends on FastAPI or the database, so it can run from the API, a CLI or a GitHub Action.
"""
