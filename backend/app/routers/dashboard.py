from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.security import get_current_user, CurrentUser
from app.db.database import get_db
from app.db.models import Inspection, AIPrediction
from app.schemas.inspection import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    org_id = user.organization_id

    total = await db.scalar(
        select(func.count()).select_from(Inspection).where(Inspection.organization_id == org_id)
    )
    passed = await db.scalar(
        select(func.count()).select_from(Inspection)
        .where(Inspection.organization_id == org_id, Inspection.status == "passed")
    )
    failed = await db.scalar(
        select(func.count()).select_from(Inspection)
        .where(Inspection.organization_id == org_id, Inspection.status == "failed")
    )

    breakdown_rows = await db.execute(
        select(AIPrediction.defect_type, func.count())
        .join(Inspection, Inspection.id == AIPrediction.inspection_id)
        .where(Inspection.organization_id == org_id)
        .group_by(AIPrediction.defect_type)
    )
    defect_breakdown = {row[0]: row[1] for row in breakdown_rows.all()}

    recent_rows = await db.execute(
        select(Inspection)
        .where(Inspection.organization_id == org_id)
        .order_by(Inspection.created_at.desc())
        .limit(10)
    )
    recent = recent_rows.scalars().all()
    for r in recent:
        r.predictions = []  # keep dashboard payload light

    return DashboardStats(
        total_inspections=total or 0,
        passed=passed or 0,
        failed=failed or 0,
        defect_breakdown=defect_breakdown,
        recent=recent,
    )
