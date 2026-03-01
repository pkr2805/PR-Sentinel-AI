from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from core.config import settings

# Since Python 3.14 alpha breaks greenlet async C-extensions on Mac,
# we use the standard synchronous engine for SQLite which is perfectly fast.
# We strip the "+aiosqlite" prefix if present.
db_url = settings.database_url.replace("sqlite+aiosqlite", "sqlite")

engine = create_engine(
    db_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
)

SessionLocal = sessionmaker(
    bind=engine, expire_on_commit=False, autoflush=False
)

Base = declarative_base()

# FastAPI dependency
def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
