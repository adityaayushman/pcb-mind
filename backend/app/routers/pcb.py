import asyncio
import uuid
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user, require_role, CurrentUser
from app.db.database import get_db, AsyncSessionLocal
from app.db.models import PCBTemplate, GoldenPCB
from app.services import ai_inference, storage

router = APIRouter(prefix="/api/pcb-templates", tags=["pcb-templates"])


class GoldenPcbOut(BaseModel):
    id: uuid.UUID
    image_url: str
    version: int
    baseline_ready: bool
    created_at: datetime


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    golden_pcb: GoldenPcbOut | None = None

    class Config:
        from_attributes = True


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(
    name: str = Form(...),
    description: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "qa_engineer")),
):
    template = PCBTemplate(
        organization_id=user.organization_id, name=name, description=description, created_by=user.id
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def _latest_golden(db: AsyncSession, template_id: uuid.UUID) -> GoldenPcbOut | None:
    golden = (
        await db.execute(
            select(GoldenPCB)
            .where(GoldenPCB.template_id == template_id)
            .order_by(GoldenPCB.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not golden:
        return None
    return GoldenPcbOut(
        id=golden.id,
        image_url=golden.image_url,
        version=golden.version,
        baseline_ready=golden.component_map is not None,
        created_at=golden.created_at,
    )


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)
):
    templates = (
        await db.execute(select(PCBTemplate).where(PCBTemplate.organization_id == user.organization_id))
    ).scalars().all()

    return [
        TemplateOut(
            id=t.id,
            name=t.name,
            description=t.description,
            golden_pcb=await _latest_golden(db, t.id),
        )
        for t in templates
    ]


async def _build_golden_baseline(golden_id: uuid.UUID, contents: bytes) -> None:
    """Runs the same defect detector on the golden reference itself so its
    own detections become a baseline: anything the model also flags on a
    known-good board is very likely a false-positive/artifact, not a real
    defect (see ai_inference._suppress_golden_artifacts). Deliberately run
    as a background task, not inline in the request — a cold instance can
    take 60-80s+ for model load + inference, comfortably past most
    client/proxy request timeouts (the exact bug this project already hit
    and fixed once for inspection creation; see git history). Until this
    finishes, component_map simply stays null and inspections against this
    golden PCB just skip suppression — never a hard failure."""
    try:
        result = await asyncio.to_thread(ai_inference.run_inspection, contents)
    except Exception:
        return

    component_map = {
        "defects": [
            {"defect_type": d.defect_type, "bbox": d.bbox, "confidence": d.confidence}
            for d in result.detections
        ],
        "model_version": settings.MODEL_WEIGHTS_PATH,
    }

    async with AsyncSessionLocal() as db:
        golden = await db.get(GoldenPCB, golden_id)
        if golden:
            golden.component_map = component_map
            await db.commit()


@router.post("/{template_id}/golden", status_code=202)
async def upload_golden_pcb(
    template_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin", "qa_engineer")),
):
    template = await db.get(PCBTemplate, template_id)
    if not template or template.organization_id != user.organization_id:
        raise HTTPException(404, "PCB template not found")

    contents = await file.read()
    image_url = await asyncio.to_thread(
        storage.upload_image, contents, file.content_type or "image/jpeg", prefix="golden"
    )

    # Return as soon as the upload is done — the baseline-defect detection
    # pass happens afterward, in the background (see _build_golden_baseline).
    golden = GoldenPCB(template_id=template_id, image_url=image_url, component_map=None)
    db.add(golden)
    await db.commit()
    await db.refresh(golden)

    background_tasks.add_task(_build_golden_baseline, golden.id, contents)

    return {"id": golden.id, "image_url": golden.image_url}
