"""Statistical process control endpoint: builds a daily quality-metric series
(same day-bucketing as analytics) and runs it through the control-chart
analysis in services/spc.py so the frontend can render a control chart and
surface drift before it breaches an acceptance threshold."""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, CurrentUser
from app.db.database import get_db
from app.db.models import Inspection, Notification, Profile
from app.services.spc import analyze_control_chart

router = APIRouter(prefix="/api/spc", tags=["spc"])

METRIC_LABELS = {
    "fail_rate": "Fail rate (%)",
    "defect_rate": "Avg defects per board",
}


class SpcPoint(BaseModel):
    date: str
    value: float


class SpcSignal(BaseModel):
    date: str
    rule: str
    severity: str
    message: str


class SpcOut(BaseModel):
    metric: str
    metric_label: str
    points: list[SpcPoint]
    center_line: float | None
    ucl: float | None
    lcl: float | None
    sigma: float | None
    signals: list[SpcSignal]
    status: str


async def build_daily_metric(
    db: AsyncSession,
    org_id: uuid.UUID,
    metric: str,
    days: int,
    template_id: uuid.UUID | None = None,
) -> list[dict]:
    day = func.date_trunc("day", Inspection.created_at).label("day")
    filters = [Inspection.organization_id == org_id, Inspection.created_at >= datetime.utcnow() - timedelta(days=days)]
    if template_id:
        filters.append(Inspection.template_id == template_id)

    rows = (
        await db.execute(
            select(
                day,
                func.count(),
                func.sum(case((Inspection.status == "failed", 1), else_=0)),
                func.avg(Inspection.defect_count),
            )
            .where(*filters)
            .group_by(day)
            .order_by(day)
        )
    ).all()

    points = []
    for day_val, total, failed, avg_def in rows:
        total, failed = total or 0, failed or 0
        if metric == "defect_rate":
            value = round(float(avg_def), 2) if avg_def is not None else 0.0
        else:  # fail_rate
            value = round(failed / total * 100, 1) if total else 0.0
        points.append({"date": day_val.date().isoformat(), "value": value})
    return points


@router.get("", response_model=SpcOut)
async def get_spc(
    metric: str = "fail_rate",
    days: int = 30,
    template_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if metric not in METRIC_LABELS:
        metric = "fail_rate"
    days = max(7, min(days, 365))
    points = await build_daily_metric(db, user.organization_id, metric, days, template_id)
    chart = analyze_control_chart(points)
    return SpcOut(metric=metric, metric_label=METRIC_LABELS[metric], **chart)


@router.get("/root-cause")
async def root_cause(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)
):
    """AI root-cause analysis of the org's current quality signal — what's
    driving the fail rate and what to do about it. Local import keeps the
    spc <-> root_cause dependency from cycling at module load."""
    from app.services.root_cause import analyze_drift

    analysis = await analyze_drift(db, user.organization_id)
    return {"analysis": analysis}


async def maybe_notify_drift(db: AsyncSession, org_id: uuid.UUID) -> None:
    """Called when an inspection settles: if the fail-rate process has just
    drifted out of control (a signal lands on the most recent day), alert the
    org's admins/QA — once per day, so a batch of boards doesn't spam."""
    from app.services.notifications import create_notification

    points = await build_daily_metric(db, org_id, "fail_rate", 30)
    chart = analyze_control_chart(points)
    if chart["status"] != "drift_detected" or not points:
        return
    latest_date = points[-1]["date"]
    if not any(s["date"] == latest_date for s in chart["signals"]):
        return  # drift is historical, not current — don't re-alert

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    already = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.organization_id == org_id,
            Notification.type == "process_drift",
            Notification.created_at >= today_start,
        )
    )
    if already:
        return

    recipients = (
        await db.execute(
            select(Profile.id).where(
                Profile.organization_id == org_id, Profile.role.in_(["admin", "qa_engineer"])
            )
        )
    ).scalars().all()
    latest_val = points[-1]["value"]
    for uid in recipients:
        await create_notification(
            db,
            organization_id=org_id,
            user_id=uid,
            type="process_drift",
            title="Process drift detected",
            body=f"Today's fail rate ({latest_val:.0f}%) is outside the control limit — review process control.",
            link="/dashboard/process-control",
        )
