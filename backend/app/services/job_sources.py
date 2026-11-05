"""Job source adapters.

Phase 1 ships a seed adapter plus two stubs. Nothing here performs a network
fetch: the NENU career site and public boards are intentionally not scraped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

from app.models.job import JobZone

_DEMO = "【示例数据】这条不是真实在招职位，只用于岗位板第一期演示。"


@dataclass(frozen=True)
class JobDraft:
    title: str
    company: str
    location: str
    zone: str
    source: str
    source_url: str
    deadline: date | None
    description: str
    is_nenu_related: bool
    raw: dict = field(default_factory=dict)


class JobSourceAdapter(Protocol):
    """Normalize one upstream into JobDraft rows.

    Implementations must return an empty list when the source is unavailable.
    They must not raise just because a remote site changed or is unreachable.
    """

    source_id: str

    def fetch(self) -> list[JobDraft]:
        """Return the current snapshot. Empty means nothing new to upsert."""


def _demo(
    *,
    slug: str,
    title: str,
    company: str,
    location: str,
    zone: JobZone,
    deadline: date | None,
    body: str,
    is_nenu_related: bool,
    illustrated_source: str,
) -> JobDraft:
    return JobDraft(
        title=title,
        company=company,
        location=location,
        zone=zone.value,
        source="seed",
        source_url=f"seed://jobs/{slug}",
        deadline=deadline,
        description=f"{_DEMO}\n\n{body}",
        is_nenu_related=is_nenu_related,
        raw={
            "demo": True,
            "illustrated_source": illustrated_source,
            "note": "Phase 1 seed. Replace this row when a real adapter upserts the same posting.",
        },
    )


SEED_JOBS: tuple[JobDraft, ...] = (
    _demo(
        slug="cs-campus-ops",
        title="校园网与教务系统运维实习",
        company="东北师范大学信息化办公室（示例）",
        location="长春市",
        zone=JobZone.cs,
        deadline=date(2026, 11, 28),
        body="面向在校生的运维实习。工作内容是机房巡检、账号开通和简单的脚本排障。优先考虑会 Python 或 Linux 的同学。",
        is_nenu_related=True,
        illustrated_source="nenu_career",
    ),
    _demo(
        slug="cs-lab-backend",
        title="实验教学平台后端实习",
        company="计算机学院实验教学中心（示例）",
        location="长春市",
        zone=JobZone.cs,
        deadline=date(2026, 12, 20),
        body="维护一套内部实验预约小系统，技术栈接近 FastAPI 与 PostgreSQL。可远程一周两天，其余时间在净月校区。",
        is_nenu_related=True,
        illustrated_source="nenu_career",
    ),
    _demo(
        slug="cs-frontend",
        title="前端开发实习",
        company="星河软件（示例）",
        location="北京市",
        zone=JobZone.cs,
        deadline=date(2026, 11, 5),
        body="参与招聘产品的列表与详情页。要求熟悉 React 或 Next.js。此条用来演示「公开招聘站」来源，不是东师岗位。",
        is_nenu_related=False,
        illustrated_source="public_board",
    ),
    _demo(
        slug="cs-data",
        title="数据分析实习",
        company="松花江数据（示例）",
        location="长春市",
        zone=JobZone.cs,
        deadline=date(2027, 1, 16),
        body="整理业务表格并做周报图表。会 SQL 即可投递，不要求东师学籍。",
        is_nenu_related=False,
        illustrated_source="public_board",
    ),
    _demo(
        slug="teaching-it",
        title="高中信息技术教师",
        company="东师附属中学（示例）",
        location="长春市",
        zone=JobZone.teaching,
        deadline=date(2026, 11, 18),
        body="信息科技课程与社团辅导。岗位说明写明优先考虑东北师范大学师范生，因此记为东师相关。",
        is_nenu_related=True,
        illustrated_source="nenu_career",
    ),
    _demo(
        slug="teaching-math",
        title="初中数学教师",
        company="长春市某中学（示例）",
        location="长春市",
        zone=JobZone.teaching,
        deadline=None,
        body="长期专任教师岗位，截止日期在来源页尚未公布。示例里把空截止日期排在有日期的东师岗位之后。",
        is_nenu_related=True,
        illustrated_source="nenu_career",
    ),
    _demo(
        slug="teaching-chinese",
        title="小学语文教师",
        company="深圳某公办小学（示例）",
        location="深圳市",
        zone=JobZone.teaching,
        deadline=date(2026, 10, 31),
        body="已过示例截止日期，用来核对列表仍会展示过期岗位。与东北师范大学没有直接关系。",
        is_nenu_related=False,
        illustrated_source="public_board",
    ),
    _demo(
        slug="teaching-counselor",
        title="学生工作助理",
        company="外省某师范院校（示例）",
        location="南京市",
        zone=JobZone.teaching,
        deadline=date(2027, 3, 1),
        body="协助辅导员处理日常事务。公开招聘站示例，不按东师相关置顶。",
        is_nenu_related=False,
        illustrated_source="public_board",
    ),
)


class SeedJobAdapter:
    """Built-in demo postings so the board works before any crawler exists."""

    source_id = "seed"

    def fetch(self) -> list[JobDraft]:
        return list(SEED_JOBS)


class NenuCareerAdapter:
    """Stub for the NENU career site (东北师范大学就业信息网).

    Phase 1 does not scrape it. The public list is easy to break: pages depend
    on session cookies and the markup changes without notice. A later adapter
    should implement ``fetch`` and return ``[]`` on any parse or network failure.
    """

    source_id = "nenu_career"
    unavailable_reason = (
        "NENU career pages are not scraped in Phase 1. "
        "The list depends on session state and markup that changes without notice."
    )

    def fetch(self) -> list[JobDraft]:
        return []


class PublicJobBoardAdapter:
    """Stub for a second, public job board.

    No vendor is called. Picking a live site in Phase 1 would tie the app to
    HTML that we do not control and might conflict with that site's terms.
    """

    source_id = "public_board"
    unavailable_reason = (
        "No public job board is fetched in Phase 1. "
        "Add a low-risk adapter later and keep fetch() empty when the site is down."
    )

    def fetch(self) -> list[JobDraft]:
        return []


def iter_adapters() -> list[JobSourceAdapter]:
    return [SeedJobAdapter(), NenuCareerAdapter(), PublicJobBoardAdapter()]
