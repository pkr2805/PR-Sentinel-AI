import asyncio
from datetime import timedelta

from sentinel.actions import ActionExecutor
from sentinel.config import SentinelConfig
from sentinel.engine import ScanDeps, run_scan
from sentinel.judge import LLMJudge
from sentinel.models import PRMemory, PRState
from tests.factories import NOW, days_ago, make_facts, review
from tests.fakes import FakeGitHub, FakeLLM


def prs():
    return [
        make_facts(number=1, requested_reviewers=["bob"]),                                    # rules
        make_facts(number=2, last_commit_at=days_ago(1), reviews=[review("bob", "CHANGES_REQUESTED", 3)]),  # LLM
        make_facts(number=3, author="renovate[bot]", author_is_bot=True),                    # skipped
        make_facts(number=4, reviews=[review("carol", "APPROVED", 1)]),                       # rules
    ]


def deps(github, llm=None, memory=None, **config):
    return ScanDeps(github=github, executor=ActionExecutor(dry_run=True), config=SentinelConfig(**config),
                    judge=LLMJudge(llm) if llm else None, memory=memory or {}, now=NOW)


async def test_full_scan_uses_llm_only_for_ambiguous_prs():
    llm = FakeLLM()
    result = await run_scan("octocat/hello", deps(FakeGitHub(prs()), llm))

    states = {a.number: (a.state, a.source) for a in result.assessments}
    assert states == {
        1: (PRState.NEEDS_FIRST_REVIEW, "rules"),
        2: (PRState.FEEDBACK_ADDRESSED, "llm"),
        4: (PRState.READY_TO_MERGE, "rules"),
    }
    assert result.llm_calls == 1
    assert result.skipped == [{"pr_id": "octocat/hello#3", "reason": "bot author"}]
    assert {r.status for r in result.results} == {"dry_run"}
    assert result.errors == []


async def test_unchanged_prs_come_from_cache_without_llm():
    first = await run_scan("octocat/hello", deps(FakeGitHub(prs()), FakeLLM()))
    memory = {a.pr_id: PRMemory(cache_key=a.cache_key, state=a.state, assessment=a) for a in first.assessments}

    llm = FakeLLM()
    second = await run_scan("octocat/hello", deps(FakeGitHub(prs()), llm, memory))

    assert second.cached == 3 and second.llm_calls == 0 and llm.calls == 0
    assert {a.source for a in second.assessments} == {"cache"}
    assert [a.state for a in second.assessments] == [a.state for a in first.assessments]


async def test_llm_failure_falls_back_to_rules():
    result = await run_scan("octocat/hello", deps(FakeGitHub(prs()), FakeLLM(fail=True)))

    pr2 = next(a for a in result.assessments if a.number == 2)
    assert pr2.state == PRState.FEEDBACK_ADDRESSED and pr2.source == "rules" and pr2.confidence == 0.5
    assert len(result.errors) == 1 and "LLM judge failed" in result.errors[0]
    assert len(result.assessments) == 3  # the other PRs are unaffected


async def test_without_llm_ambiguous_prs_keep_low_confidence():
    result = await run_scan("octocat/hello", deps(FakeGitHub(prs())))
    pr2 = next(a for a in result.assessments if a.number == 2)
    assert pr2.source == "rules" and pr2.confidence == 0.6 and result.llm_calls == 0


async def test_fetch_failure_is_reported():
    result = await run_scan("octocat/hello", deps(FakeGitHub([], fail=True)))
    assert result.assessments == [] and result.results == []
    assert result.errors and result.errors[0].startswith("Fetching PRs failed")


async def test_prs_are_assessed_in_parallel_with_a_limit():
    running, peak = 0, 0

    class SlowLLM(FakeLLM):
        def with_structured_output(self, schema, method=None):
            parser = super().with_structured_output(schema, method)
            inner = parser.ainvoke

            async def ainvoke(messages):
                nonlocal running, peak
                running += 1
                peak = max(peak, running)
                await asyncio.sleep(0.05)
                running -= 1
                return await inner(messages)

            parser.ainvoke = ainvoke
            return parser

    ambiguous = [make_facts(number=n, last_commit_at=days_ago(1), reviews=[review("bob", "CHANGES_REQUESTED", 3)])
                 for n in range(1, 9)]
    result = await run_scan("octocat/hello", deps(FakeGitHub(ambiguous), SlowLLM(), max_concurrency=3))

    assert len(result.assessments) == 8 and result.llm_calls == 8
    assert 1 < peak <= 3


async def test_cached_pr_still_becomes_abandoned():
    pr = make_facts(number=1, requested_reviewers=["bob"], updated_at=days_ago(4))
    first = await run_scan("octocat/hello", deps(FakeGitHub([pr])))
    a = first.assessments[0]
    memory = {a.pr_id: PRMemory(cache_key=a.cache_key, state=a.state, assessment=a)}

    later = deps(FakeGitHub([pr]), memory=memory)
    later.now = NOW + timedelta(days=30)
    result = await run_scan("octocat/hello", later)

    assert result.cached == 0 and result.assessments[0].state == PRState.ABANDONED
