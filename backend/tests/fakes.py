from langchain_core.messages import AIMessage

from sentinel.judge import JudgeVerdict


class FakeLLM:
    """Stands in for ChatGroq. Optionally asks for tool calls first, then returns a fixed verdict."""

    def __init__(self, verdict: JudgeVerdict | None = None, tool_calls: list | None = None, fail: bool = False):
        self.verdict = verdict or JudgeVerdict(state="FEEDBACK_ADDRESSED", waiting_on="reviewer", people=["bob"],
                                               reason="Alice pushed the requested test.", next_step="Re-review.",
                                               confidence=0.9)
        self.pending_tool_calls = list(tool_calls or [])
        self.fail = fail
        self.calls = 0
        self.prompts = []
        self.structured_method = None

    def bind_tools(self, tools, tool_choice=None):
        return self

    async def ainvoke(self, messages):
        self.calls += 1
        self.prompts.append(messages)
        if self.pending_tool_calls:
            return AIMessage(content="", tool_calls=[self.pending_tool_calls.pop(0)])
        return AIMessage(content="Done exploring.")

    def with_structured_output(self, schema, method=None):
        self.structured_method = method
        outer = self

        class Parser:
            async def ainvoke(self, messages):
                outer.calls += 1
                outer.prompts.append(messages)
                if outer.fail:
                    raise RuntimeError("rate limited")
                return outer.verdict

        return Parser()


class FakeGitHub:
    def __init__(self, prs, fail: bool = False):
        self.prs = prs
        self.fail = fail
        self.fetches = 0

    async def fetch_open_prs(self, owner, name, first=30):
        self.fetches += 1
        if self.fail:
            raise RuntimeError("401 Bad credentials")
        return list(self.prs)
