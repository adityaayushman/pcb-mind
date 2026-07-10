"""Continuous-learning surface: aggregates the human-in-the-loop verdicts
operators leave on individual detections into a training-readiness picture,
and exports the verified detections as a labeled dataset an ML engineer can
retrain on. The verdicts themselves are written on ai_predictions via
routers/inspection.py's feedback endpoint."""

import csv
import io

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role, CurrentUser
from app.core.severity import get_severity
from app.db.database import get_db
from app.db.models import AIPrediction, Inspection

router = APIRouter(prefix="/api/training", tags=["training"])


class DefectTypeStat(BaseModel):
    defect_type: str
    total: int
    confirmed: int
    rejected: int
    false_call_rate: float | None  # rejected / reviewed, %


class TrainingSummary(BaseModel):
    total_predictions: int
    reviewed: int
    confirmed: int
    rejected: int
    coverage_percent: float | None       # reviewed / total
    false_call_rate_percent: float | None  # rejected / reviewed
    by_defect_type: list[DefectTypeStat]


@router.get("/summary", response_model=TrainingSummary)
async def training_summary(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)
):
    org = user.organization_id
    confirmed_case = func.sum(case((AIPrediction.feedback == "confirmed", 1), else_=0))
    rejected_case = func.sum(case((AIPrediction.feedback == "rejected", 1), else_=0))
    reviewed_case = func.sum(case((AIPrediction.feedback.isnot(None), 1), else_=0))

    total, reviewed, confirmed, rejected = (
        await db.execute(
            select(func.count(), reviewed_case, confirmed_case, rejected_case)
            .select_from(AIPrediction)
            .join(Inspection, Inspection.id == AIPrediction.inspection_id)
            .where(Inspection.organization_id == org)
        )
    ).one()
    total, reviewed, confirmed, rejected = total or 0, reviewed or 0, confirmed or 0, rejected or 0

    rows = (
        await db.execute(
            select(AIPrediction.defect_type, func.count(), confirmed_case, rejected_case)
            .join(Inspection, Inspection.id == AIPrediction.inspection_id)
            .where(Inspection.organization_id == org)
            .group_by(AIPrediction.defect_type)
            .order_by(func.count().desc())
        )
    ).all()

    by_type = []
    for defect_type, t, c, r in rows:
        c, r = c or 0, r or 0
        rev = c + r
        by_type.append(
            DefectTypeStat(
                defect_type=defect_type,
                total=t,
                confirmed=c,
                rejected=r,
                false_call_rate=round(r / rev * 100, 1) if rev else None,
            )
        )

    return TrainingSummary(
        total_predictions=total,
        reviewed=reviewed,
        confirmed=confirmed,
        rejected=rejected,
        coverage_percent=round(reviewed / total * 100, 1) if total else None,
        false_call_rate_percent=round(rejected / reviewed * 100, 1) if reviewed else None,
        by_defect_type=by_type,
    )


@router.get("/export")
async def export_dataset(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "qa_engineer")),
):
    """Download every operator-verified detection as a labeled CSV — the
    retraining set: image URL + normalized box + defect type + the human
    verdict. Gated to admin/QA like the inspection export."""
    rows = (
        await db.execute(
            select(AIPrediction, Inspection.image_url)
            .join(Inspection, Inspection.id == AIPrediction.inspection_id)
            .where(
                Inspection.organization_id == user.organization_id,
                AIPrediction.feedback.isnot(None),
            )
            .order_by(AIPrediction.feedback_at.desc())
        )
    ).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["inspection_id", "image_url", "defect_type", "severity", "x", "y", "width",
         "height", "confidence", "verdict", "reviewed_at"]
    )
    for pred, image_url in rows:
        bb = pred.bounding_box or {}
        writer.writerow([
            str(pred.inspection_id), image_url, pred.defect_type, get_severity(pred.defect_type),
            bb.get("x"), bb.get("y"), bb.get("width"), bb.get("height"),
            float(pred.confidence), pred.feedback,
            pred.feedback_at.isoformat() if pred.feedback_at else "",
        ])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="training_dataset.csv"'},
    )
