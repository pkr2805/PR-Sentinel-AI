# PR Sentinel AI

An AI agent that watches your open pull requests, works out which ones are stuck, and decides what should
happen next: ping a reviewer, ask to merge, escalate to Slack, or leave it alone.

- **Backend:** FastAPI + LangGraph agent, SQLite, a scheduler that scans every 6 hours.
- **LLM:** [Groq](https://groq.com) running `openai/gpt-oss-120b` (configurable).
- **Tools:** the agent uses GitHub, Jira and Slack through [MCP](https://modelcontextprotocol.io) servers.
- **Frontend:** React + Vite dashboard to manage repos, review decisions and override them.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the roadmap.

## How a run works

1. Fetch the repository's open PRs from GitHub.
2. Start the configured MCP servers once for the run (GitHub always; Jira and Slack when configured).
3. For each PR, the LLM explores it with the tools (a bounded number of rounds), then returns one decision:
   `IGNORE`, `PING_REVIEWER`, `ASK_TO_MERGE` or `ESCALATE` (escalations are posted to Slack).
4. Decisions and run logs are stored in SQLite and shown in the dashboard, where you can override them.

## Quick start

Requirements: Python 3.11+, Node.js 20+ (also used by `npx` to run the MCP servers).

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # then set GROQ_API_KEY and GITHUB_TOKEN
uvicorn main:app --reload
```

The API runs on http://localhost:8000 (interactive docs at http://localhost:8000/docs).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env    # optional, defaults to http://localhost:8000/api
npm run dev
```

Open http://localhost:5173, add a repository under **Settings**, then run the agent.

## Configuration

All settings live in `backend/.env`; see [`backend/.env.example`](backend/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | yes | Groq API key |
| `LLM_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `GITHUB_TOKEN` | yes | Reads PRs; also used by the GitHub MCP server |
| `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL` | no | Enables the Jira MCP server |
| `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` | no | Enables the Slack MCP server |
| `SLACK_WEBHOOK_URL` | no | Simple Slack fallback without a Slack app |

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/repos` | List / add monitored repositories |
| `PUT` / `DELETE` | `/api/repos/{owner}/{name}` | Update / remove a repository |
| `POST` | `/api/repos/{owner}/{name}/toggle?active=` | Pause or resume a repository |
| `POST` | `/api/agent/run?repo_id=` | Run the agent now |
| `GET` | `/api/prs`, `/api/prs/{id}` | PR decisions (`id` is `owner/repo#number`, URL-encoded) |
| `POST` | `/api/prs/{id}/override` | Override a decision |
| `GET` | `/api/logs`, `/api/stats` | Run history and dashboard numbers |

## Development

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Tests use a fake LLM and a temporary database, so they need no API keys or network access.

> Upgrading from an earlier version: PR ids changed to `owner/repo#number`. Delete `backend/sentinel.db`
> so the tables are recreated.
