"""Create the schema (SQLite) or apply Alembic migrations (PostgreSQL)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.models import Base  # noqa: E402


def main() -> int:
    if settings.is_sqlite:
        Base.metadata.create_all(engine)
        print(f"SQLite schema ready at {settings.resolved_database_url}")
        return 0
    print("PostgreSQL detected - running alembic upgrade head")
    return subprocess.call([sys.executable, "-m", "alembic", "upgrade", "head"])


if __name__ == "__main__":
    raise SystemExit(main())
