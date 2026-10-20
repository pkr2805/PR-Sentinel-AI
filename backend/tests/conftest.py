import os
import tempfile

# Settings are read at import time, so test values must be set before the app is imported.
_db_dir = tempfile.mkdtemp()
os.environ.update({
    "GROQ_API_KEY": "test-groq-key",
    "GITHUB_TOKEN": "test-github-token",
    "DATABASE_URL": f"sqlite:///{_db_dir}/test.db",
    "SLACK_WEBHOOK_URL": "",
    "SLACK_BOT_TOKEN": "",
    "JIRA_API_TOKEN": "",
})

import pytest
from httpx import AsyncClient, ASGITransport

from db.database import Base, engine
import db.models  # noqa: F401  (registers the tables)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
async def client():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
