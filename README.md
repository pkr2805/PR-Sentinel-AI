# PR Sentinel AI

An AI agent that works out **why** each open pull request is stuck and **who** has to act next, then tells
that person where they already work: one PR comment, a label, and a Slack digest grouped by person.

- **Backend:** FastAPI + a LangGraph engine (`backend/sentinel/`), SQLite, a scheduler and GitHub webhooks.
- **LLM:** [Groq](https://groq.com) running `openai/gpt-oss-120b`, used only for the PRs rules can't decide.
- **Tools:** the LLM can dig deeper through GitHub, Jira and Slack [MCP](https://modelcontextprotocol.io) servers.
- **Frontend:** React + Vite + Framer Motion dashboard: who acts next on every PR, approvals, run history, ⌘K search.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the roadmap.

## How a run works

```
trigger (every 6h · webhook · "Run" button)
  → fetch open PRs          one GitHub GraphQL query for the whole batch
  → filter                  skip bots, ignored labels/authors; unchanged PRs reuse last run's result
  → assess each PR          in parallel (limit: SENTINEL_MAX_CONCURRENCY)
       rules first          draft, CI failing, conflict, changes requested, ready to merge, …
       LLM judge if unsure  "was the feedback addressed?", "whose turn is it?"
  → plan actions            only on a new state or after the reminder interval; quiet hours;
                            escalations wait for approval
  → act                     edit one PR comment, set sentinel:* labels, send one Slack digest
  → save                    state, who was notified, metrics (time, LLM calls, cache hits)
```

The LLM only **decides**: its MCP tools are filtered to read-only ones that never return code. All side
effects happen in one tested step (`sentinel/actions.py`), and the
default is **dry run**: everything is assessed and logged, nothing is posted until `SENTINEL_DRY_RUN=false`.

### PR states

| State | Meaning | Waiting on |
|---|---|---|
| `DRAFT` | Still a draft | author (never notified) |
| `CI_FAILING` / `MERGE_CONFLICT` | Checks fail / branch conflicts | author |
| `CHANGES_REQUESTED` | Changes requested, nothing pushed since | author |
| `NEEDS_FIRST_REVIEW` | No review yet | reviewer |
| `FEEDBACK_ADDRESSED` | Author pushed after review (LLM confirms) | reviewer |
| `DISCUSSION_STALLED` | Open threads or comments without a verdict (LLM decides whose turn) | varies |
| `CI_PENDING` | Approved, CI still running | nobody |
| `READY_TO_MERGE` | Approved, green, no conflicts | maintainer |
| `ABANDONED` | No activity for `SENTINEL_ABANDONED_AFTER_DAYS` | author |

A PR that has waited on someone for `SENTINEL_ESCALATE_AFTER_DAYS` is escalated: its comment and a separate
Slack escalation wait in the dashboard's **Waiting for your approval** panel.

## Quick start

Requirements: Python 3.11+, Node.js 20.19+ or 22+ (Vite needs it; Node is also used by `npx` to run the MCP servers).
Check with `node -v`; older versions fail with `crypto.hash is not a function`.

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

Open http://localhost:5173, add a repository under **Repositories**, then press **Run scan** on the overview.
Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> anywhere to search pull requests, switch repositories or run actions.
The dashboard has a dark and a light theme (switch in the sidebar) and follows your system's reduced-motion setting.

## Try it with demo data

To explore the dashboard before connecting GitHub or Groq, load demo data (from `backend/`, before or while the
server runs), then refresh the browser:

```bash
python -m scripts.seed_demo          # add demo repositories, PRs, scan history and an approval
python -m scripts.seed_demo --reset  # wipe the local database and load it fresh
```

With demo data, `GITHUB_TOKEN` and `GROQ_API_KEY` can stay empty. Scans of the demo repositories fail because they
don't exist on GitHub; remove them on the Repositories page when you add your own.

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
| `GITHUB_WEBHOOK_SECRET` | no | Enables `POST /api/webhooks/github` |
| `SENTINEL_DRY_RUN` | no | `true` by default: assess and log only |
| `SENTINEL_*` | no | Thresholds, reminders, quiet hours, approvals, features; see `.env.example` |

Without `GROQ_API_KEY` everything still works; ambiguous PRs keep the rule engine's answer with lower confidence.

## Try it on a repository (CLI)

No server or database needed. From `backend/`:

```bash
python -m sentinel scan owner/repo            # dry run: prints each PR's state, reason and next step
python -m sentinel scan owner/repo --no-llm   # rules only
python -m sentinel scan owner/repo --apply    # really comment, label and send the Slack digest
```

## Scan on GitHub events

Set `GITHUB_WEBHOOK_SECRET`, then in the repository's **Settings → Webhooks** add
`https://<your-server>/api/webhooks/github` with content type `application/json`, the same secret, and the
events *Pull requests*, *Pull request reviews*, *Pull request review comments*, *Check suites* and
*Issue comments*. A scan of that repository starts within seconds of each event.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/repos` | List / add monitored repositories |
| `PUT` / `DELETE` | `/api/repos/{owner}/{name}` | Update / remove a repository |
| `POST` | `/api/repos/{owner}/{name}/toggle?active=` | Pause or resume a repository |
| `POST` | `/api/agent/run?repo_id=` | Run the agent now |
| `GET` | `/api/prs`, `/api/prs/{id}` | PR decisions (`id` is `owner/repo#number`, URL-encoded) |
| `POST` | `/api/prs/{id}/override` | Override a decision |
| `GET` | `/api/actions?status=pending` | Actions waiting for approval |
| `POST` | `/api/actions/{id}/approve`, `/api/actions/{id}/reject` | Approve (runs it) or reject an action |
| `POST` | `/api/webhooks/github` | GitHub webhook (signed with `GITHUB_WEBHOOK_SECRET`) |
| `GET` | `/api/logs`, `/api/stats` | Run history (with duration, LLM calls, cache hits) and dashboard numbers |

## Development

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Tests use a fake LLM, fake GitHub responses and a temporary database, so they need no API keys or network access.

> Upgrading from an earlier version: the database tables changed. Delete `backend/sentinel.db` so they
> are recreated.
