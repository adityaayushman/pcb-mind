import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user, require_role, CurrentUser
from app.db.database import get_db
from app.db.models import PCBTemplate, GoldenPCB
from app.services import ai_inference, storage

router = APIRouter(prefix="/api/pcb-templates", tags=["pcb-templates"])


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None

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


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)
):
    result = await db.execute(
        select(PCBTemplate).where(PCBTemplate.organization_id == user.organization_id)
    )
    return result.scalars().all()


@router.post("/{template_id}/golden", status_code=201)
async def upload_golden_pcb(
    template_id: uuid.UUID,
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

    # Run the same defect detector on the golden reference itself so its own
    # detections become a baseline: anything the model also flags on a
    # known-good board is very likely a false-positive/artifact, not a real
    # defect (see ai_inference._suppress_golden_artifacts). Must go through
    # asyncio.to_thread — a raw synchronous YOLO call here would block the
    # event loop, the exact class of bug that caused a recurring 502 earlier
    # in this project (see git history).
    result = await asyncio.to_thread(ai_inference.run_inspection, contents)
    component_map = {
        "defects": [
            {"defect_type": d.defect_type, "bbox": d.bbox, "confidence": d.confidence}
            for d in result.detections
        ],
        "model_version": settings.MODEL_WEIGHTS_PATH,
    }

    golden = GoldenPCB(template_id=template_id, image_url=image_url, component_map=component_map)
    db.add(golden)
    await db.commit()
    await db.refresh(golden)
    return {"id": golden.id, "image_url": golden.image_url}
