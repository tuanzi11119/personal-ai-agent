"""Upsert adapter output into the jobs table.

Existing rows are left in place. A later crawler can update a posting by
writing the same source and source_url; this sync only inserts missing keys
so a restart does not duplicate the seed data.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.job import Job, JobZone
from app.services.job_sources import JobDraft, iter_adapters

logger = get_logger(__name__)

_ZONES = {zone.value for zone in JobZone}


def _valid(draft: JobDraft) -> bool:
    if draft.zone not in _ZONES:
        logger.warning("skip job with unknown zone %s from %s", draft.zone, draft.source)
        return False
    if not draft.title.strip() or not draft.source.strip() or not draft.source_url.strip():
        logger.warning("skip job missing title, source or source_url")
        return False
    return True


def sync_job_sources(db: Session) -> int:
    """Insert drafts that are not already stored. Returns the number inserted."""
    inserted = 0
    for adapter in iter_adapters():
        try:
            drafts = adapter.fetch()
        except Exception:
            logger.exception("job source %s failed; leaving the board unchanged", adapter.source_id)
            continue
        for draft in drafts:
            if not _valid(draft):
                continue
            exists = (
                db.query(Job.id)
                .filter(Job.source == draft.source, Job.source_url == draft.source_url)
                .first()
            )
            if exists is not None:
                continue
            db.add(
                Job(
                    title=draft.title.strip(),
                    company=draft.company.strip(),
                    location=draft.location.strip(),
                    zone=draft.zone,
                    source=draft.source.strip(),
                    source_url=draft.source_url.strip(),
                    deadline=draft.deadline,
                    description=draft.description.strip(),
                    raw=dict(draft.raw),
                    is_nenu_related=bool(draft.is_nenu_related),
                )
            )
            inserted += 1
    db.commit()
    if inserted:
        logger.info("inserted %s job rows", inserted)
    return inserted
