from db.database import SessionLocal
from db.models import PRRecord


async def test_health_check(client):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


async def test_create_duplicate_and_update_repo(client):
    payload = {"owner": "octocat", "name": "hello"}
    created = await client.post("/api/repos", json=payload)
    assert created.status_code == 200
    assert created.json()["id"] == "octocat/hello"

    duplicate = await client.post("/api/repos", json=payload)
    assert duplicate.status_code == 409

    updated = await client.put("/api/repos/octocat/hello", json={"slack_channel": "#reviews", "active": False})
    assert updated.status_code == 200
    body = updated.json()
    assert body["slack_channel"] == "#reviews"
    assert body["active"] is False
    assert body["jira_project_key"] is None  # untouched fields keep their value

    missing = await client.put("/api/repos/octocat/nope", json={"active": True})
    assert missing.status_code == 404


async def test_pr_ids_are_unique_per_repo_and_routable(client):
    await client.post("/api/repos", json={"owner": "octocat", "name": "a"})
    await client.post("/api/repos", json={"owner": "octocat", "name": "b"})
    with SessionLocal() as db:
        for repo in ("octocat/a", "octocat/b"):
            db.add(PRRecord(id=f"{repo}#5", number=5, repo_id=repo, title=f"PR in {repo}", author="me"))
        db.commit()

    prs = (await client.get("/api/prs")).json()
    assert sorted(p["id"] for p in prs) == ["octocat/a#5", "octocat/b#5"]

    # The frontend URL-encodes the id: "/" -> %2F, "#" -> %23
    one = await client.get("/api/prs/octocat%2Fb%235")
    assert one.status_code == 200
    assert one.json()["title"] == "PR in octocat/b"

    overridden = await client.post("/api/prs/octocat%2Fa%235/override", json={"decision": "IGNORE"})
    assert overridden.status_code == 200
    assert overridden.json()["decision"] == "IGNORE"
