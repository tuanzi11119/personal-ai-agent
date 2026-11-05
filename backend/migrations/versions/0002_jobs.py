"""jobs table for the phase 1 job board

Revision ID: 0002_jobs
Revises: 0001_initial
Create Date: 2026-11-05

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_jobs"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("zone", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("source_url", sa.String(length=1024), nullable=False, server_default=""),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("raw", sa.JSON(), nullable=False),
        sa.Column("is_nenu_related", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source", "source_url", name="uq_jobs_source_url"),
    )
    op.create_index("ix_jobs_zone", "jobs", ["zone"])
    op.create_index("ix_jobs_source", "jobs", ["source"])
    op.create_index("ix_jobs_deadline", "jobs", ["deadline"])
    op.create_index("ix_jobs_is_nenu_related", "jobs", ["is_nenu_related"])


def downgrade() -> None:
    op.drop_index("ix_jobs_is_nenu_related", table_name="jobs")
    op.drop_index("ix_jobs_deadline", table_name="jobs")
    op.drop_index("ix_jobs_source", table_name="jobs")
    op.drop_index("ix_jobs_zone", table_name="jobs")
    op.drop_table("jobs")
