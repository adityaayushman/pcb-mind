import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, CurrentUser
from app.db.database import get_db
from app.db.models import AIPrediction, Inspection
from app.schemas.analytics import AnalyticsOut, DailyTrendPoint, PeriodStats, TopDefect

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _base_filters(org_id: uuid.UUID, template_id: uuid.UUID | None):
    filters = [Inspection.organization_id == org_id]
    if template_id:
        filters.append(Inspection.template_id == template_id)
    return filters


async def _period_stats(
    db: AsyncSession,
    org_id: uuid.UUID,
    start: datetime,
    end: datetime,
    template_id: uuid.UUID | None,
) -> PeriodStats:
    query = select(
        func.count(),
        func.sum(case((Inspection.status == "passed", 1), else_=0)),
        func.sum(case((Inspection.status == "failed", 1), else_=0)),
        func.avg(Inspection.inference_time_ms),
    ).where(*_base_filters(org_id, template_id), Inspection.created_at >= start, Inspection.created_at < end)

    total, passed, failed, avg_ms = (await db.execute(query)).one()
    total, passed, failed = total or 0, passed or 0, failed or 0
    return PeriodStats(
        total=total,
        passed=passed,
        failed=failed,
        pass_rate=round(passed / total * 100, 1) if total else None,
        avg_inference_time_ms=round(float(avg_ms), 1) if avg_ms is not None else None,
    )


async def _daily_trend(
    db: AsyncSession,
    org_id: uuid.UUID,
    start: datetime,
    template_id: uuid.UUID | None,
) -> list[DailyTrendPoint]:
    day = func.date_trunc("day", Inspection.created_at).label("day")
    query = (
        select(
            day,
            func.count(),
            func.sum(case((Inspection.status == "passed", 1), else_=0)),
            func.sum(case((Inspection.status == "failed", 1), else_=0)),
            func.avg(Inspection.inference_time_ms),
        )
        .where(*_base_filters(org_id, template_id), Inspection.created_at >= start)
        .group_by(day)
        .order_by(day)
    )
    rows = (await db.execute(query)).all()
    points = []
    for day_val, total, passed, failed, avg_ms in rows:
        total, passed, failed = total or 0, passed or 0, failed or 0
        points.append(
            DailyTrendPoint(
                date=day_val.date(),
                total=total,
                passed=passed,
                failed=failed,
                pass_rate=round(passed / total * 100, 1) if total else None,
                avg_inference_time_ms=round(float(avg_ms), 1) if avg_ms is not None else None,
            )
        )
    return points


async def _defect_trend(
    db: AsyncSession,
    org_id: uuid.UUID,
    start: datetime,
    template_id: uuid.UUID | None,
) -> tuple[list[dict], list[TopDefect]]:
    day = func.date_trunc("day", Inspection.created_at).label("day")
    query = (
        select(day, AIPrediction.defect_type, func.count())
        .join(Inspection, Inspection.id == AIPrediction.inspection_id)
        .where(
            *_base_filters(org_id, template_id),
            Inspection.created_at >= start,
            AIPrediction.is_reference_match.is_(False),
        )
        .group_by(day, AIPrediction.defect_type)
        .order_by(day)
    )
    rows = (await db.execute(query)).all()

    by_day: dict[date, dict[str, int]] = {}
    totals: dict[str, int] = {}
    for day_val, defect_type, count in rows:
        d = day_val.date()
        by_day.setdefault(d, {})[defect_type] = count
        totals[defect_type] = totals.get(defect_type, 0) + count

    defect_trend = [{"date": d.isoformat(), **counts} for d, counts in sorted(by_day.items())]
    top_defects = [
        TopDefect(defect_type=t, count=c)
        for t, c in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    ]
    return defect_trend, top_defects


@router.get("", response_model=AnalyticsOut)
async def get_analytics(
    days: int = 30,
    template_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    days = max(1, min(days, 3650))
    org_id = user.organization_id
    now = datetime.utcnow()
    current_start = now - timedelta(days=days)
    previous_start = now - timedelta(days=days * 2)

    current_period = await _period_stats(db, org_id, current_start, now, template_id)
    previous_period = await _period_stats(db, org_id, previous_start, current_start, template_id)
    daily_trend = await _daily_trend(db, org_id, current_start, template_id)
    defect_trend, top_defects = await _defect_trend(db, org_id, current_start, template_id)

    return AnalyticsOut(
        current_period=current_period,
        previous_period=previous_period,
        daily_trend=daily_trend,
        defect_trend=defect_trend,
        top_defects=top_defects,
    )
