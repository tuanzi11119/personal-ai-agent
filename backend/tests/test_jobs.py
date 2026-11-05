"""Phase 1 job board: seed data, filters, and source adapter stubs."""

from __future__ import annotations

from app.core.database import session_scope
from app.models import Job
from app.services.job_sources import NenuCareerAdapter, PublicJobBoardAdapter, SeedJobAdapter
from app.services.job_sync import sync_job_sources


def test_list_returns_seed_jobs_for_both_zones(client):
    response = client.get("/api/jobs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 8
    zones = {item["zone"] for item in body["items"]}
    assert zones == {"cs", "teaching"}
    assert all(item["source"] == "seed" for item in body["items"])
    assert all("【示例数据】" in item["description"] for item in body["items"])


def test_nenu_jobs_are_pinned_ahead_of_others(client):
    items = client.get("/api/jobs").json()["items"]
    flags = [item["is_nenu_related"] for item in items]
    assert any(flags) and not all(flags)
    assert flags == sorted(flags, reverse=True)
    nenu_deadlines = [item["deadline"] for item in items if item["is_nenu_related"]]
    dated = [value for value in nenu_deadlines if value is not None]
    assert dated == sorted(dated)
    assert nenu_deadlines[-1] is None


def test_filter_by_zone(client):
    cs = client.get("/api/jobs", params={"zone": "cs"}).json()
    teaching = client.get("/api/jobs", params={"zone": "teaching"}).json()
    assert cs["total"] == 4
    assert teaching["total"] == 4
    assert {item["zone"] for item in cs["items"]} == {"cs"}
    assert {item["zone"] for item in teaching["items"]} == {"teaching"}


def test_filter_nenu_and_search(client):
    nenu = client.get("/api/jobs", params={"nenu": "true"}).json()
    assert nenu["total"] >= 1
    assert all(item["is_nenu_related"] for item in nenu["items"])

    found = client.get("/api/jobs", params={"q": "运维", "zone": "cs"}).json()
    assert found["total"] == 1
    assert "运维" in found["items"][0]["title"]

    other = client.get("/api/jobs", params={"nenu": "false", "zone": "teaching"}).json()
    assert other["total"] == 2
    assert all(not item["is_nenu_related"] for item in other["items"])


def test_invalid_zone_uses_error_envelope(client):
    response = client.get("/api/jobs", params={"zone": "design"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_get_job_and_missing_job(client):
    listing = client.get("/api/jobs", params={"q": "前端开发实习"}).json()
    job_id = listing["items"][0]["id"]
    detail = client.get(f"/api/jobs/{job_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["id"] == job_id
    assert body["company"]
    assert body["raw"]["demo"] is True
    assert body["raw"]["illustrated_source"] == "public_board"

    missing = client.get("/api/jobs/does-not-exist")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_stub_adapters_do_not_fetch_and_sync_is_idempotent(client):
    nenu = NenuCareerAdapter()
    public = PublicJobBoardAdapter()
    assert nenu.fetch() == []
    assert public.fetch() == []
    assert "not scraped" in nenu.unavailable_reason
    assert "No public job board" in public.unavailable_reason
    assert {draft.zone for draft in SeedJobAdapter().fetch()} == {"cs", "teaching"}

    with session_scope() as db:
        before = db.query(Job).count()
        inserted = sync_job_sources(db)
        after = db.query(Job).count()
    assert before == 8
    assert inserted == 0
    assert after == 8
