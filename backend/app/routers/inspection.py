import uuid
from datetime import datetime

import cv2
from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import get_current_user, require_role, CurrentUser
from app.core.config import settings
from app.db.database import get_db
from app.db.models import Inspection, AIPrediction, GoldenPCB, PCBTemplate
from app.schemas.inspection import InspectionOut
from app.services import ai_inference, storage
from app.services import export as export_service

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.post("", response_model=InspectionOut, status_code=201)
async def create_inspection(
    template_id: uuid.UUID = Form(...),
    golden_pcb_id: uuid.UUID | None = Form(None),
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

    image_url = storage.upload_image(contents, file.content_type or "image/jpeg")

    golden_component_map = None
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

    result = ai_inference.run_inspection(contents, golden_component_map)

    annotated_image_url = None
    if result.annotated_image is not None:
        ok, buf = cv2.imencode(".jpg", result.annotated_image)
        if ok:
            annotated_image_url = storage.upload_image(
                buf.tobytes(), "image/jpeg", prefix="annotated"
            )

    # Heatmap is generated lazily via GET /{id}/heatmap (see services/heatmap.py)
    # rather than here — computing it on this same request competes for memory
    # with YOLO/torch's own first-load spike, enough to OOM a 512MB instance.
    inspection = Inspection(
        organization_id=user.organization_id,
        template_id=template_id,
        golden_pcb_id=golden_pcb_id,
        uploaded_by=user.id,
        image_url=image_url,
        annotated_image_url=annotated_image_url,
        status="passed" if result.passed else "failed",
        overall_confidence=result.overall_confidence,
        defect_count=len(result.detections),
        inference_time_ms=result.inference_time_ms,
        completed_at=datetime.utcnow(),
    )
    db.add(inspection)
    await db.flush()

    for d in result.detections:
        db.add(
            AIPrediction(
                inspection_id=inspection.id,
                defect_type=d.defect_type,
                component_label=d.component_label,
                bounding_box=d.bbox,
                confidence=d.confidence,
            )
        )

    await db.commit()
    await db.refresh(inspection)
    return inspection


@router.get("/export")
async def export_inspections(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "qa_engineer")),
):
    """Bulk org-wide inspection export — gated to admin/qa_engineer since it's
    a supervisory view across everyone's inspections, not "your own work"."""
    if format == "xlsx":
        content = await export_service.export_xlsx(db, user.organization_id)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="inspections.xlsx"'},
        )
    content = await export_service.export_csv(db, user.organization_id)
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
    return inspection


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
