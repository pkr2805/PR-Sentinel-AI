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

### Phase 0 — Foundations ✅ in progress (branch `feature/groq-phase-0`)

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
- [ ] Fix the 21 pre-existing frontend lint errors (`react-hooks/static-components`, `set-state-in-effect`),
      then make lint blocking in CI.
- [ ] Verify a live run against Groq and a real repository.

**Done when:** a fresh clone starts with the README steps alone and CI is green.

### Phase 1 — Blocker detection engine (1–2 weeks)

- [ ] `sentinel/` core package, independent of FastAPI.
- [ ] Collector: one GitHub GraphQL query per PR (reviews, review threads, commits since review, checks,
      mergeability, requested reviewers). Replaces the REST call per PR.
- [ ] Rule classifier for the certain states.
- [ ] LLM judge only for `FEEDBACK_ADDRESSED` and `DISCUSSION_STALLED`, with strict structured output.
- [ ] Message writer: short, neutral summary with evidence links.
- [ ] Cache: skip the LLM when the head commit and comments haven't changed.
- [ ] Accuracy set: ~30 real public PRs labelled by hand + a scoring script (target ≥ 90%).
- [ ] CLI: `sentinel scan owner/repo --dry-run`.

### Phase 2 — Taking action (1 week)

- [ ] Single sticky PR comment (hidden marker, edited in place).
- [ ] Labels: `sentinel:waiting-on-author`, `sentinel:waiting-on-review`, `sentinel:ready-to-merge`.
- [ ] Daily Slack digest grouped by person.
- [ ] Anti-spam: reminder interval, quiet hours, ignore list, skip bot PRs.
- [ ] Config file: `.github/pr-sentinel.yml`.

### Phase 3 — GitHub Action (3–4 days)

- [ ] `action.yml` (inputs: `groq-api-key`, mode, dry-run), example scheduled workflow.
- [ ] Least-privilege permissions (`pull-requests: write`, `checks: read`).
- [ ] Marketplace listing with version tags.

### Phase 4 — Dashboard (1 week, optional)

- [ ] Move to FastAPI lifespan handlers and Alembic migrations instead of `create_all`.

- [ ] Replace the mock activity chart with real data (time waiting per state).
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
