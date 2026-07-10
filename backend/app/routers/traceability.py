"""Unit traceability: every serial-numbered board and its full inspection
history. A physical board may be inspected many times (incoming, after
rework, final); grouping those by serial gives the genealogy a QA/compliance
team needs to answer "what happened to unit SN-1234?"."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, CurrentUser
from app.db.database import get_db
from app.db.models import Inspection, PCBTemplate, Unit

router = APIRouter(prefix="/api/units", tags=["traceability"])


class UnitOut(BaseModel):
    id: uuid.UUID
    serial_number: str
    template_name: str | None
    inspection_count: int
    latest_status: str | None
    last_inspected_at: datetime | None
    created_at: datetime


class TimelineItem(BaseModel):
    inspection_id: uuid.UUID
    status: str
    defect_count: int
    overall_confidence: float | None
    created_at: datetime


class UnitDetail(UnitOut):
    genealogy: list[dict]
    timeline: list[TimelineItem]


async def _template_names(db: AsyncSession, template_ids: list[uuid.UUID]) -> dict:
    ids = [tid for tid in template_ids if tid]
    if not ids:
        return {}
    rows = (await db.execute(select(PCBTemplate.id, PCBTemplate.name).where(PCBTemplate.id.in_(ids)))).all()
    return {tid: name for tid, name in rows}


@router.get("", response_model=list[UnitOut])
async def list_units(
    search: str | None = None,
    limit: int = 60,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    query = select(Unit).where(Unit.organization_id == user.organization_id)
    if search and search.strip():
        query = query.where(Unit.serial_number.ilike(f"%{search.strip()}%"))
    query = query.order_by(Unit.created_at.desc()).limit(limit)
    units = (await db.execute(query)).scalars().all()

    unit_ids = [u.id for u in units]
    # one query for all inspections of these units, newest first
    insp_by_unit: dict[uuid.UUID, list[Inspection]] = {}
    if unit_ids:
        rows = (
            await db.execute(
                select(Inspection)
                .where(Inspection.unit_id.in_(unit_ids))
                .order_by(Inspection.created_at.desc())
            )
        ).scalars().all()
        for insp in rows:
            insp_by_unit.setdefault(insp.unit_id, []).append(insp)

    names = await _template_names(db, [u.template_id for u in units])

    out = []
    for u in units:
        insps = insp_by_unit.get(u.id, [])
        latest = insps[0] if insps else None
        out.append(
            UnitOut(
                id=u.id,
                serial_number=u.serial_number,
                template_name=names.get(u.template_id),
                inspection_count=len(insps),
                latest_status=latest.status if latest else None,
                last_inspected_at=latest.created_at if latest else None,
                created_at=u.created_at,
            )
        )
    return out


@router.get("/{serial}", response_model=UnitDetail)
async def get_unit(
    serial: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    unit = (
        await db.execute(
            select(Unit).where(
                Unit.organization_id == user.organization_id, Unit.serial_number == serial
            )
        )
    ).scalar_one_or_none()
    if not unit:
        raise HTTPException(404, "Unit not found")

    insps = (
        await db.execute(
            select(Inspection)
            .where(Inspection.unit_id == unit.id)
            .order_by(Inspection.created_at.desc())
        )
    ).scalars().all()

    names = await _template_names(db, [unit.template_id])
    latest = insps[0] if insps else None
    genealogy = (unit.genealogy or {}).get("components", []) if unit.genealogy else []

    return UnitDetail(
        id=unit.id,
        serial_number=unit.serial_number,
        template_name=names.get(unit.template_id),
        inspection_count=len(insps),
        latest_status=latest.status if latest else None,
        last_inspected_at=latest.created_at if latest else None,
        created_at=unit.created_at,
        genealogy=genealogy,
        timeline=[
            TimelineItem(
                inspection_id=i.id,
                status=i.status,
                defect_count=i.defect_count,
                overall_confidence=float(i.overall_confidence) if i.overall_confidence is not None else None,
                created_at=i.created_at,
            )
            for i in insps
        ],
    )
