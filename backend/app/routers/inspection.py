import asyncio
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_current_user, require_role, CurrentUser
from app.core.config import settings
from app.db.database import get_db, AsyncSessionLocal
from app.db.models import Inspection, AIPrediction, GoldenPCB, PCBTemplate, Unit
from app.schemas.inspection import InspectionOut
from app.services import ai_inference, storage
from app.services import export as export_service

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


async def _process_inspection(
    inspection_id: uuid.UUID,
    contents: bytes,
    golden_component_map: dict | None,
    golden_image_url: str | None,
) -> None:
    """Runs the actual (slow) inference after the HTTP response has already
    gone back to the client — a cold instance on a fractional-vCPU host can
    take 60-80s+ for model load + inference, comfortably past most
    client/proxy request timeouts. Decoupling this from the request/response
    cycle means no timeout, anywhere in the chain, can ever cut it off
    mid-inference; the frontend polls GET /{id} instead (see StagedProgress
    in the frontend) using the queued/processing states that already existed
    in the schema but were never actually used until now."""
    golden_image_bytes = None
    if golden_image_url:
        try:
            golden_image_bytes = await storage.download_image(golden_image_url)
        except Exception:
            golden_image_bytes = None  # degrades to registration_status="no_golden" for this run, same as not selecting one

    try:
        result = await asyncio.to_thread(
            ai_inference.run_inspection, contents, golden_component_map, golden_image_bytes
        )
    except Exception:
        async with AsyncSessionLocal() as db:
            inspection = await db.get(Inspection, inspection_id)
            if inspection:
                inspection.status = "error"
                inspection.completed_at = datetime.utcnow()
                await db.commit()
                await _notify_inspection_done(db, inspection)
        return

    async with AsyncSessionLocal() as db:
        inspection = await db.get(Inspection, inspection_id)
        if not inspection:
            return
        inspection.status = "passed" if result.passed else "failed"
        inspection.overall_confidence = result.overall_confidence
        inspection.defect_count = sum(1 for d in result.detections if not d.is_reference_match)
        inspection.inference_time_ms = result.inference_time_ms
        inspection.registration_status = result.registration_status
        inspection.completed_at = datetime.utcnow()

        for d in result.detections:
            db.add(
                AIPrediction(
                    inspection_id=inspection_id,
                    defect_type=d.defect_type,
                    component_label=d.component_label,
                    bounding_box=d.bbox,
                    confidence=d.confidence,
                    is_reference_match=d.is_reference_match,
                )
            )
        await db.commit()
        await _notify_inspection_done(db, inspection)
        try:
            from app.routers.spc import maybe_notify_drift

            await maybe_notify_drift(db, inspection.organization_id)
        except Exception:
            pass  # drift alerting is best-effort, never blocks the inspection


async def _notify_inspection_done(db: AsyncSession, inspection: Inspection) -> None:
    """Best-effort alert to the uploader once their inspection settles."""
    from app.services.notifications import create_notification

    if inspection.status == "passed":
        title, body = "Inspection passed", "No blocking defects found."
    elif inspection.status == "failed":
        n = inspection.defect_count
        title, body = "Inspection failed", f"{n} defect{'' if n == 1 else 's'} detected."
    else:
        title, body = "Inspection couldn't be processed", "The image failed during analysis."

    try:
        await create_notification(
            db,
            organization_id=inspection.organization_id,
            user_id=inspection.uploaded_by,
            type=f"inspection_{inspection.status}",
            title=title,
            body=body,
            link=f"/dashboard/inspections/{inspection.id}",
        )
    except Exception:
        pass


async def _resolve_unit(
    db: AsyncSession, org_id: uuid.UUID, serial: str | None, template_id: uuid.UUID
) -> uuid.UUID | None:
    """Find or create the serial-numbered unit this inspection is of, so a
    board inspected repeatedly accrues one traceable history. No serial → a
    one-off inspection with no unit (backwards compatible)."""
    serial = (serial or "").strip()
    if not serial:
        return None
    unit = (
        await db.execute(
            select(Unit).where(Unit.organization_id == org_id, Unit.serial_number == serial)
        )
    ).scalar_one_or_none()
    if unit:
        return unit.id
    unit = Unit(organization_id=org_id, serial_number=serial, template_id=template_id)
    db.add(unit)
    await db.flush()
    return unit.id


@router.post("", response_model=InspectionOut, status_code=202)
async def create_inspection(
    background_tasks: BackgroundTasks,
    template_id: uuid.UUID = Form(...),
    golden_pcb_id: uuid.UUID | None = Form(None),
    serial_number: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    template = await db.get(PCBTemplate, template_id)
    if not template or template.organization_id != user.organization_id:
        raise HTTPException(404, "PCB template not found")

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Image exceeds {settings.MAX_UPLOAD_MB}MB limit")

    unit_id = await _resolve_unit(db, user.organization_id, serial_number, template_id)

    image_url = await asyncio.to_thread(
        storage.upload_image, contents, file.content_type or "image/jpeg"
    )

    golden_component_map = None
    golden_image_url = None
    if golden_pcb_id:
        row = (
            await db.execute(
                select(GoldenPCB, PCBTemplate.organization_id)
                .join(PCBTemplate, PCBTemplate.id == GoldenPCB.template_id)
                .where(GoldenPCB.id == golden_pcb_id)
            )
        ).first()
        if not row or row[1] != user.organization_id:
            raise HTTPException(404, "Golden PCB not found")
        golden_component_map = row[0].component_map
        golden_image_url = row[0].image_url

    # Return as soon as the upload is done — inference happens afterward, in
    # the background (see _process_inspection above).
    inspection = Inspection(
        organization_id=user.organization_id,
        template_id=template_id,
        unit_id=unit_id,
        golden_pcb_id=golden_pcb_id,
        uploaded_by=user.id,
        image_url=image_url,
        status="processing",
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)

    background_tasks.add_task(
        _process_inspection, inspection.id, contents, golden_component_map, golden_image_url
    )

    return inspection


@router.get("/export")
async def export_inspections(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    days: int | None = Query(None, ge=1, le=3650, description="Only include the last N days; omit for all time"),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "qa_engineer")),
):
    """Bulk org-wide inspection export — gated to admin/qa_engineer since it's
    a supervisory view across everyone's inspections, not "your own work".
    Optionally bounded to the last `days` so a report can cover just a period
    instead of the entire history."""
    start = datetime.utcnow() - timedelta(days=days) if days else None
    if format == "xlsx":
        content = await export_service.export_xlsx(db, user.organization_id, start)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="inspections.xlsx"'},
        )
    content = await export_service.export_csv(db, user.organization_id, start)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="inspections.csv"'},
    )


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    inspection = await db.get(Inspection, inspection_id)
    if not inspection or inspection.organization_id != user.organization_id:
        raise HTTPException(404, "Inspection not found")
    preds = await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == inspection_id))
    inspection.predictions = preds.scalars().all()
    if inspection.unit_id:
        unit = await db.get(Unit, inspection.unit_id)
        inspection.serial_number = unit.serial_number if unit else None
    return inspection


class PredictionFeedback(BaseModel):
    feedback: str | None  # "confirmed" | "rejected" | null to clear


@router.patch("/{inspection_id}/predictions/{prediction_id}/feedback")
async def set_prediction_feedback(
    inspection_id: uuid.UUID,
    prediction_id: uuid.UUID,
    payload: PredictionFeedback,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Human-in-the-loop verdict on a single detection — the operator confirms
    a real defect or flags a false call. Any role in the org may review; the
    accumulated verdicts feed the retraining dataset (see routers/training.py)."""
    if payload.feedback not in (None, "confirmed", "rejected"):
        raise HTTPException(400, "feedback must be 'confirmed', 'rejected', or null")

    inspection = await db.get(Inspection, inspection_id)
    if not inspection or inspection.organization_id != user.organization_id:
        raise HTTPException(404, "Inspection not found")

    prediction = await db.get(AIPrediction, prediction_id)
    if not prediction or prediction.inspection_id != inspection_id:
        raise HTTPException(404, "Prediction not found")

    prediction.feedback = payload.feedback
    prediction.feedback_by = uuid.UUID(user.id) if payload.feedback else None
    prediction.feedback_at = datetime.utcnow() if payload.feedback else None
    await db.commit()
    return {"id": str(prediction.id), "feedback": prediction.feedback}


@router.get("", response_model=list[InspectionOut])
async def list_inspections(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(
        select(Inspection)
        .where(Inspection.organization_id == user.organization_id)
        .order_by(Inspection.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{inspection_id}/report")
async def download_report(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Generates (or returns cached) PDF inspection report. See services/report.py."""
    from app.services.report import get_or_generate_report

    inspection = await db.get(Inspection, inspection_id)
    if not inspection or inspection.organization_id != user.organization_id:
        raise HTTPException(404, "Inspection not found")

    url = await get_or_generate_report(db, inspection)
    return {"report_url": url}


@router.get("/{inspection_id}/heatmap")
async def get_heatmap(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Generates (or returns cached) confidence heatmap. See services/heatmap.py.
    Returns heatmap_image_url=None for a clean "passed" inspection (nothing
    to visualize) rather than an error."""
    from app.services.heatmap import get_or_generate_heatmap

    inspection = await db.get(Inspection, inspection_id)
    if not inspection or inspection.organization_id != user.organization_id:
        raise HTTPException(404, "Inspection not found")

    url = await get_or_generate_heatmap(db, inspection)
    return {"heatmap_image_url": url}


@router.get("/{inspection_id}/ai-summary")
async def get_ai_summary(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Generates (or returns cached) LLM-written QA summary. See services/ai_summary.py.
    Returns ai_summary=None (not an error) if no OpenRouter key is configured
    or the LLM call fails — this is a nice-to-have on top of the real
    detection/report data, never a hard dependency for viewing an inspection."""
    from app.services.ai_summary import get_or_generate_summary

    inspection = await db.get(Inspection, inspection_id)
    if not inspection or inspection.organization_id != user.organization_id:
        raise HTTPException(404, "Inspection not found")

    summary = await get_or_generate_summary(db, inspection)
    return {"ai_summary": summary}
