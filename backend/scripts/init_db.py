"""Create the schema (SQLite) or apply Alembic migrations (PostgreSQL)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import engine, session_scope  # noqa: E402
from app.models import Base  # noqa: E402
from app.services.job_sync import sync_job_sources  # noqa: E402


def main() -> int:
    if settings.is_sqlite:
        Base.metadata.create_all(engine)
        print(f"SQLite schema ready at {settings.resolved_database_url}")
    else:
        print("PostgreSQL detected - running alembic upgrade head")
        code = subprocess.call([sys.executable, "-m", "alembic", "upgrade", "head"])
        if code != 0:
            return code
    with session_scope() as db:
        inserted = sync_job_sources(db)
    print(f"Job board sync inserted {inserted} row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
