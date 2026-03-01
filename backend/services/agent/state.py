from typing import TypedDict, List, Optional, Annotated
import operator

class PRData(TypedDict):
    number: int
    title: str
    author: str
    body: str
    commits: int
    additions: int
    deletions: int
    changed_files: int
    labels: List[str]
    created_at: str
    updated_at: str
    inactivity_days: int
    draft: bool

class AgentState(TypedDict):
    # Inputs
    repo_id: str
    github_owner: str
    github_repo: str
    jira_project_key: Optional[str]
    slack_channel: Optional[str]

    # Graph State
    active_prs: List[PRData]
    current_pr_index: int
    
    # Aggregations
    prs_evaluated: Annotated[int, operator.add]
    errors: Annotated[List[str], operator.add]
    evaluated_prs: Annotated[List[dict], operator.add]
