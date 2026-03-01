from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.database import get_db
from db.models import Repository
from schemas.repo import RepoResponse, RepoCreate

router = APIRouter(prefix="/api/repos", tags=["Repositories"])

@router.get("", response_model=list[RepoResponse])
def list_repos(db: Session = Depends(get_db)):
    from db.models import PRRecord
    from sqlalchemy.sql import func
    
    stmt = select(Repository).order_by(Repository.created_at.desc())
    result = db.execute(stmt)
    repos = result.scalars().all()
    
    responses = []
    for r in repos:
        count_stmt = select(func.count(PRRecord.id)).where(PRRecord.repo_id == r.id)
        open_prs_count = db.execute(count_stmt).scalar() or 0
        
        rr = RepoResponse.model_validate(r)
        rr.open_prs = open_prs_count
        responses.append(rr)
        
    return responses

@router.post("", response_model=RepoResponse)
def create_repo(repo: RepoCreate, db: Session = Depends(get_db)):
    db_repo = Repository(
        id=f"{repo.owner}/{repo.name}",
        owner=repo.owner,
        name=repo.name,
        jira_project_key=repo.jira_project_key,
        slack_channel=repo.slack_channel
    )
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    return db_repo

@router.delete("/{repo_id:path}")
def delete_repo(repo_id: str, db: Session = Depends(get_db)):
    stmt = select(Repository).where(Repository.id == repo_id)
    res = db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    
    db.delete(repo)
    db.commit()
    return {"status": "success"}

@router.post("/{repo_id:path}/toggle")
def toggle_repo(repo_id: str, active: bool, db: Session = Depends(get_db)):
    stmt = select(Repository).where(Repository.id == repo_id)
    res = db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    
    repo.active = active
    db.commit()
    return {"status": "success"}
