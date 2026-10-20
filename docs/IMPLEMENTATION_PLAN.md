# PR Sentinel AI — Implementation Plan

## Goal

For every open pull request, PR Sentinel works out **why it is stuck** and **who has to act next**, and tells
that person where they already work (a PR comment, a label, a Slack digest).

Success means:

- Summaries are correct at least 90% of the time on a hand-labelled set of real PRs.
- A team can set it up in under 5 minutes.
- PRs on a repo that uses it wait measurably less.

## Design decisions

1. **Code collects the facts, the LLM judges and writes.** Plain code determines everything that is certain
   (CI status, merge conflicts, approvals, requested changes, requested reviewers, draft state). The LLM only
   handles what code can't do well: deciding whether review feedback was actually addressed, whose turn it
   is in a stalled discussion, and writing the summary. This keeps it cheap, fast and accurate.
2. **One core engine, three entry points.** The engine (`sentinel/`) is used by a GitHub Action (the main way
   to use it), a CLI (local testing) and the FastAPI backend + React dashboard (optional, for teams).
3. **LLM provider is pluggable.** Default: **Groq** with **`openai/gpt-oss-120b`**. The provider is chosen in
   one place (`backend/core/llm.py`) so others can be added later.
4. **MCP stays.** GitHub, Jira and Slack MCP servers give the agent tools to dig deeper. They are started
   **once per run**, not once per PR. In the GitHub Action, MCP is optional so the simple setup still works.
5. **Never spam.** One comment per PR, edited in place. Notify again only when the state changes or after a
   reminder interval. Dry-run is the default.

## PR states

| State | Detected by | Who acts |
|---|---|---|
| `DRAFT` | Draft flag | Author (or ignore) |
| `CI_FAILING` | Checks on the head commit | Author |
| `MERGE_CONFLICT` | Mergeable state | Author |
| `NEEDS_FIRST_REVIEW` | Reviewers requested, no review yet | Reviewer |
| `CHANGES_REQUESTED` | Changes requested, nothing pushed since | Author |
| `FEEDBACK_ADDRESSED` | Pushed after review — **LLM checks the comments were really addressed** | Reviewer |
| `READY_TO_MERGE` | Approved, CI green, no conflicts, no open threads | Maintainer |
| `DISCUSSION_STALLED` | Open threads with no reply — **LLM decides whose turn it is** | Varies |
| `ABANDONED` | No activity from anyone for N days | Author / close |

Each result carries: state, who acts, a 1–2 sentence reason, a suggested next step, confidence, and
evidence links.

## Phases

### Phase 0 — Foundations ✅ (merged in #2)

- [x] Switch the LLM from Gemini to Groq (`openai/gpt-oss-120b`) behind a provider factory (`core/llm.py`).
- [x] Fix dependencies (`langchain-groq` instead of the missing Gemini package); pin versions.
- [x] Make PR ids unique per repository (`owner/repo#number`) so repos stop overwriting each other.
- [x] Separate Slack settings: `SLACK_BOT_TOKEN` for the Slack MCP server, `SLACK_WEBHOOK_URL` for the fallback.
- [x] Start the MCP servers once per run instead of once per PR.
- [x] Map MCP tool inputs to their real JSON-schema types (numbers, booleans, arrays, optional fields).
- [x] Let the agent use tools for several rounds (bounded) instead of exactly one.
- [x] Pass the repo's Slack channel to the agent.
- [x] Add the missing `PUT /api/repos/{id}` endpoint the frontend calls.
- [x] `.env.example`, a real README, tests that run without network access.
- [x] CI workflow: backend tests, frontend build (lint runs but is non-blocking).
- [x] Fix the 21 pre-existing frontend lint errors and make lint blocking in CI (done with the UI redesign).
- [ ] Verify a live run against Groq and a real repository.

**Done when:** a fresh clone starts with the README steps alone and CI is green.

### Phase 1 — Blocker detection engine ✅ (branch `feature/agent-flow-v2`)

- [x] `backend/sentinel/` core package, independent of FastAPI and the database.
- [x] Collector: one GitHub GraphQL query for all open PRs (reviews, review threads, last commit + CI,
      mergeability, requested reviewers, comments).
- [x] Rule classifier for the certain states.
- [x] LLM judge only for `FEEDBACK_ADDRESSED` and `DISCUSSION_STALLED`, structured output, optional MCP tools
      (started lazily, once per run, only if an ambiguous PR needs them). The diff is never sent.
- [x] Parallel fan-out per PR (LangGraph `Send`) with a concurrency limit.
- [x] Cache: unchanged PRs (same head commit, CI, reviews, comments) reuse the last assessment, no LLM call.
- [x] Fallbacks: LLM failure or no API key → rule result with lower confidence; one PR's error doesn't stop the run.
- [x] CLI: `python -m sentinel scan owner/repo [--no-llm] [--apply]`.
- [ ] Accuracy set: ~30 real public PRs labelled by hand + a scoring script (target ≥ 90%).
- [ ] Verify the GraphQL query and a full run against real repositories and Groq.

### Phase 2 — Taking action ✅ (branch `feature/agent-flow-v2`)

- [x] Decide/act separation: the planner produces actions, the executor is the only code with side effects.
- [x] Single sticky PR comment (hidden marker, edited in place, not rewritten when unchanged).
- [x] Labels: `sentinel:waiting-on-author`, `sentinel:waiting-on-review`, `sentinel:ready-to-merge`.
- [x] Slack digest grouped by person (bot token or webhook); escalations in a separate message.
- [x] Memory between runs: notify only on a new state or after the reminder interval; quiet hours; dry-run default.
- [x] Approval gate: escalations are stored as pending actions; approve/reject via API and dashboard panel.
- [x] GitHub webhook endpoint (HMAC-verified) triggers a scan on PR, review, CI and comment events.
- [x] Run metrics: duration, PRs seen, cache hits, LLM calls, actions taken.
- [ ] Per-repo config file `.github/pr-sentinel.yml` (settings are global for now).

### Phase 3 — GitHub Action (3–4 days)

- [ ] `action.yml` (inputs: `groq-api-key`, mode, dry-run), example scheduled workflow.
- [ ] Least-privilege permissions (`pull-requests: write`, `checks: read`).
- [ ] Marketplace listing with version tags.

### Phase 4 — Dashboard (1 week, optional)

- [ ] Move to FastAPI lifespan handlers and Alembic migrations instead of `create_all`.

- [x] UI redesign: design tokens (dark + light), real data only (mock chart removed), "who acts next" breakdown,
      command palette (⌘K), global repo filter, approvals panel, animations with reduced-motion support.
- [ ] Trend charts over time (needs a history of states per run).
- [ ] "Who's the bottleneck" view.
- [ ] PR detail shows the evidence behind each decision.
- [ ] Manual overrides feed the accuracy set.

### Phase 5 — Real-world trial and launch (ongoing)

- [ ] Dry-run on your own repos first; other repos only with the maintainer's permission.
- [ ] Record baseline review wait time, enable, compare after 2–4 weeks.
- [ ] Write-up: demo GIF, accuracy numbers, before/after metrics.

## Risks

| Risk | Mitigation |
|---|---|
| Blames the wrong person | Evidence links, confidence, neutral wording ("next step looks like…") |
| Feels like spam | One edited comment, reminder interval, dry-run default |
| LLM cost | Rules handle most states; cache by head commit; LLM only for ambiguous PRs |
| Token permissions | Least privilege; never log secrets |
| Private code sent to the LLM | Send review text and metadata only, never the diff, unless opted in |
