"""Command line: assess a repository's open PRs without the server or database.

    python -m sentinel scan owner/repo            # dry run, prints what it would do
    python -m sentinel scan owner/repo --no-llm   # rules only
    python -m sentinel scan owner/repo --apply    # really comment, label and send Slack
    python -m sentinel scan owner/repo --json

Reads GITHUB_TOKEN, GROQ_API_KEY and the other settings from backend/.env or the environment.
"""
import argparse
import asyncio
import json
import sys

from sentinel.messages import STATE_TITLES


async def _scan(args) -> int:
    from core.config import settings
    from sentinel.actions import ActionExecutor
    from sentinel.config import SentinelConfig
    from sentinel.engine import ScanDeps, run_scan
    from sentinel.github import GitHubClient
    from sentinel.judge import LLMJudge

    if not settings.github_token:
        print("GITHUB_TOKEN is not set. Add it to backend/.env or the environment.", file=sys.stderr)
        return 2
    use_llm = not args.no_llm and bool(settings.groq_api_key)
    config = SentinelConfig(dry_run=not args.apply, use_llm=use_llm, slack_channel=args.slack_channel,
                            stale_after_days=settings.sentinel_stale_after_days,
                            escalate_after_days=settings.sentinel_escalate_after_days,
                            abandoned_after_days=settings.sentinel_abandoned_after_days,
                            require_approval_for_escalation=False, enable_slack_digest=args.apply)
    github = GitHubClient(settings.github_token)
    judge = None
    if use_llm:
        from core.llm import get_chat_model
        judge = LLMJudge(get_chat_model(), structured_output_method=settings.llm_structured_output_method)
    try:
        executor = ActionExecutor(github=github, dry_run=not args.apply, slack_webhook_url=settings.slack_webhook_url,
                                  slack_bot_token=settings.slack_bot_token)
        result = await run_scan(args.repo, ScanDeps(github=github, executor=executor, config=config, judge=judge))
    finally:
        await github.aclose()

    if args.json:
        print(result.model_dump_json(indent=2))
        return 1 if result.errors else 0

    print(f"{args.repo}: {len(result.assessments)} PRs assessed, {len(result.skipped)} skipped, "
          f"{result.llm_calls} LLM calls, {result.duration_ms} ms\n")
    for a in result.assessments:
        people = ", ".join(a.people) or "-"
        flag = " ⚠ escalate" if a.escalate else ""
        print(f"#{a.number} {a.title}\n   {STATE_TITLES[a.state]} · waiting on {a.waiting_on.value} ({people}) "
              f"· {a.inactivity_days}d · {a.source}{flag}\n   why: {a.reason}\n   next: {a.next_step}\n")
    for s in result.skipped:
        print(f"skipped {s['pr_id']}: {s['reason']}")
    for r in result.results:
        print(f"[{r.status}] {r.detail}")
    for e in result.errors:
        print(f"error: {e}", file=sys.stderr)
    return 1 if result.errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m sentinel")
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan", help="assess a repository's open PRs")
    scan.add_argument("repo", help="owner/name")
    scan.add_argument("--no-llm", action="store_true", help="rules only, no LLM calls")
    scan.add_argument("--apply", action="store_true", help="really comment, label and notify (default: dry run)")
    scan.add_argument("--slack-channel", default=None)
    scan.add_argument("--json", action="store_true", help="print the full result as JSON")
    args = parser.parse_args()
    if "/" not in args.repo:
        parser.error("repo must be owner/name")
    return asyncio.run(_scan(args))


if __name__ == "__main__":
    raise SystemExit(main())
