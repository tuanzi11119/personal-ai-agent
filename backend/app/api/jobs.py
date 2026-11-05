"""Read-only job board. Listings are shared catalog data, not owned by a user."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.errors import NotFoundError, ValidationAppError
from app.models.job import Job, JobZone
from app.schemas.job import JobListOut, JobOut

router = APIRouter(prefix="/jobs", tags=["jobs"])

_ZONES = {zone.value for zone in JobZone}


def _normalize_zone(zone: str | None) -> str | None:
    if zone is None or zone == "":
        return None
    value = zone.strip().lower()
    if value not in _ZONES:
        raise ValidationAppError("zone must be cs or teaching")
    return value


def _apply_search(query, q: str | None):
    term = (q or "").strip()
    if not term:
        return query
    safe = term.replace("%", "").replace("_", "")
    if not safe:
        return query
    pattern = f"%{safe}%"
    return query.filter(
        or_(
            Job.title.like(pattern),
            Job.company.like(pattern),
            Job.location.like(pattern),
            Job.description.like(pattern),
        )
    )


def _ordered(query):
    # NENU-related rows stay pinned above the rest. Dated deadlines sort
    # earliest first; missing deadlines stay at the end of their group.
    return query.order_by(
        Job.is_nenu_related.desc(),
        Job.deadline.asc().nulls_last(),
        Job.created_at.desc(),
    )


def list_jobs_query(
    db: Session,
    *,
    zone: str | None,
    q: str | None,
    nenu: bool | None,
):
    query = db.query(Job)
    if zone:
        query = query.filter(Job.zone == zone)
    if nenu is True:
        query = query.filter(Job.is_nenu_related.is_(True))
    elif nenu is False:
        query = query.filter(Job.is_nenu_related.is_(False))
    return _apply_search(query, q)


@router.get("", response_model=JobListOut)
def list_jobs(
    db: DbSession,
    zone: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    nenu: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> JobListOut:
    zone_value = _normalize_zone(zone)
    query = list_jobs_query(db, zone=zone_value, q=q, nenu=nenu)
    total = query.count()
    rows = _ordered(query).offset(offset).limit(limit).all()
    return JobListOut(items=[JobOut.model_validate(row) for row in rows], total=total)


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: DbSession) -> JobOut:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError("Job not found")
    return JobOut.model_validate(job)
