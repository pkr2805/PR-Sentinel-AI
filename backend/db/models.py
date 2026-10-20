from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from db.database import Base

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, index=True) # owner/name format
    owner = Column(String, nullable=False)
    name = Column(String, nullable=False)
    jira_project_key = Column(String, nullable=True)
    slack_channel = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PRRecord(Base):
    __tablename__ = "pr_records"

    id = Column(String, primary_key=True, index=True) # "owner/repo#number", unique across repositories
    number = Column(Integer, nullable=True)
    repo_id = Column(String, ForeignKey("repositories.id"), index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    inactivity_days = Column(Integer, default=0)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    
    url = Column(String, nullable=True)

    # Assessment
    decision = Column(String, default="PENDING") # ASK_TO_MERGE, PING_REVIEWER, PING_AUTHOR, ESCALATE, IGNORE
    escalation_level = Column(Integer, default=0)
    state = Column(String, nullable=True)        # sentinel PRState, e.g. FEEDBACK_ADDRESSED
    waiting_on = Column(String, nullable=True)   # author | reviewer | maintainer | nobody
    people = Column(JSON, default=list)          # GitHub logins who should act
    reason = Column(Text, nullable=True)
    next_step = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    source = Column(String, nullable=True)       # rules | llm | cache

    # Memory between runs
    cache_key = Column(Text, nullable=True)
    assessment_json = Column(JSON, nullable=True)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    last_notified_state = Column(String, nullable=True)
    jira_id = Column(String, nullable=True)
    jira_status = Column(String, nullable=True)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(String, primary_key=True, index=True) # uuid
    pr_id = Column(String, ForeignKey("pr_records.id"))
    repo_id = Column(String, ForeignKey("repositories.id"))
    decision = Column(String, nullable=False)
    slack_sent = Column(Boolean, default=False)
    status = Column(String, default="success") # success, failed
    error_msg = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Run metrics (batch runs only)
    duration_ms = Column(Integer, nullable=True)
    prs_seen = Column(Integer, nullable=True)
    prs_cached = Column(Integer, nullable=True)
    llm_calls = Column(Integer, nullable=True)
    actions_taken = Column(Integer, nullable=True)

class PendingAction(Base):
    """An action that needs a human's approval before it runs (e.g. an escalation)."""
    __tablename__ = "pending_actions"

    id = Column(String, primary_key=True, index=True) # uuid
    repo_id = Column(String, ForeignKey("repositories.id"), index=True)
    pr_id = Column(String, nullable=True)
    kind = Column(String, nullable=False)
    action_json = Column(JSON, nullable=False)
    summary = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending | executed | failed | rejected
    result = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    decided_at = Column(DateTime(timezone=True), nullable=True)
