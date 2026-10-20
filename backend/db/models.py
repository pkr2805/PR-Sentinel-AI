from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
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
    
    # AI / Jira state
    decision = Column(String, default="PENDING") # ASK_TO_MERGE, PING_REVIEWER, ESCALATE, IGNORE
    escalation_level = Column(Integer, default=0)
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
