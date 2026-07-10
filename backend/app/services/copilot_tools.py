"""Tool implementations the copilot's LLM can call to ground its answers in
real organization data, plus their OpenRouter/OpenAI-style function-calling
schemas. Each tool is a plain async function `(db, org_id, **args) -> dict |
list` — JSON-serializable, no ORM objects — following the same manual
select/join/organization-scoping pattern used in routers/dashboard.py and
routers/inspection.py (this project declares no SQLAlchemy `relationship()`s
anywhere, so every cross-table lookup here does the same explicit join).
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.severity import get_severity
from app.db.models import AIPrediction, GoldenPCB, Inspection, PCBTemplate


async def get_org_stats(db: AsyncSession, org_id: uuid.UUID) -> dict:
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
        .where(Inspection.organization_id == org_id, AIPrediction.is_reference_match.is_(False))
        .group_by(AIPrediction.defect_type)
    )
    total = total or 0
    return {
        "total_inspections": total,
        "passed": passed or 0,
        "failed": failed or 0,
        "pass_rate_percent": round((passed or 0) / total * 100, 1) if total else None,
        "defect_breakdown": {row[0]: row[1] for row in breakdown_rows.all()},
    }


async def list_recent_inspections(
    db: AsyncSession,
    org_id: uuid.UUID,
    limit: int = 10,
    status: str | None = None,
    days: int | None = None,
) -> list[dict]:
    limit = max(1, min(limit, 50))  # keep tool-result size sane regardless of what the LLM asks for
    query = (
        select(Inspection, PCBTemplate.name)
        .join(PCBTemplate, PCBTemplate.id == Inspection.template_id, isouter=True)
        .where(Inspection.organization_id == org_id)
    )
    if status:
        query = query.where(Inspection.status == status)
    if days:
        query = query.where(Inspection.created_at >= datetime.utcnow() - timedelta(days=days))
    query = query.order_by(Inspection.created_at.desc()).limit(limit)

    rows = (await db.execute(query)).all()
    return [
        {
            "inspection_id": str(insp.id),
            "template_name": template_name,
            "status": insp.status,
            "defect_count": insp.defect_count,
            "overall_confidence": float(insp.overall_confidence) if insp.overall_confidence is not None else None,
            "created_at": insp.created_at.isoformat(),
        }
        for insp, template_name in rows
    ]


async def get_inspection_details(db: AsyncSession, org_id: uuid.UUID, inspection_id: str) -> dict:
    try:
        insp_id = uuid.UUID(inspection_id)
    except ValueError:
        return {"error": f"'{inspection_id}' is not a valid inspection ID"}

    inspection = await db.get(Inspection, insp_id)
    if not inspection or inspection.organization_id != org_id:
        return {"error": "Inspection not found"}

    preds = (
        await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == insp_id))
    ).scalars().all()

    return {
        "inspection_id": str(inspection.id),
        "status": inspection.status,
        "overall_confidence": float(inspection.overall_confidence) if inspection.overall_confidence is not None else None,
        "defect_count": inspection.defect_count,
        "registration_status": inspection.registration_status,
        "ai_summary": inspection.ai_summary,
        "created_at": inspection.created_at.isoformat(),
        "defects": [
            {
                "defect_type": p.defect_type,
                "severity": get_severity(p.defect_type),
                "confidence": float(p.confidence),
                "is_reference_match": p.is_reference_match,
            }
            for p in preds
        ],
    }


async def get_defect_frequency(db: AsyncSession, org_id: uuid.UUID, days: int | None = None) -> dict:
    query = (
        select(AIPrediction.defect_type, func.count())
        .join(Inspection, Inspection.id == AIPrediction.inspection_id)
        .where(Inspection.organization_id == org_id, AIPrediction.is_reference_match.is_(False))
    )
    if days:
        query = query.where(Inspection.created_at >= datetime.utcnow() - timedelta(days=days))
    query = query.group_by(AIPrediction.defect_type).order_by(func.count().desc())

    rows = (await db.execute(query)).all()
    return {
        "window_days": days,
        "frequency": [{"defect_type": row[0], "count": row[1]} for row in rows],
    }


async def list_templates(db: AsyncSession, org_id: uuid.UUID) -> dict:
    total = await db.scalar(
        select(func.count()).select_from(PCBTemplate).where(PCBTemplate.organization_id == org_id)
    )
    # Cap the rows returned to the LLM — an org can hold thousands of
    # templates and dumping them all would blow the context window.
    rows = (
        await db.execute(
            select(PCBTemplate, func.count(GoldenPCB.id))
            .outerjoin(GoldenPCB, GoldenPCB.template_id == PCBTemplate.id)
            .where(PCBTemplate.organization_id == org_id)
            .group_by(PCBTemplate.id)
            .order_by(PCBTemplate.name)
            .limit(50)
        )
    ).all()
    return {
        "total_templates": total or 0,
        "showing": len(rows),
        "templates": [
            {
                "template_id": str(t.id),
                "name": t.name,
                "description": t.description,
                "has_golden_pcb": golden_count > 0,
            }
            for t, golden_count in rows
        ],
    }


TOOL_FUNCTIONS = {
    "get_org_stats": get_org_stats,
    "list_recent_inspections": list_recent_inspections,
    "get_inspection_details": get_inspection_details,
    "get_defect_frequency": get_defect_frequency,
    "list_templates": list_templates,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_org_stats",
            "description": "Get total/passed/failed inspection counts, pass rate, and all-time defect-type breakdown for the organization.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_recent_inspections",
            "description": "List recent inspections, optionally filtered by status or a lookback window in days.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results, default 10, capped at 50."},
                    "status": {
                        "type": "string",
                        "enum": ["queued", "processing", "passed", "failed", "error"],
                        "description": "Filter to inspections with this status.",
                    },
                    "days": {"type": "integer", "description": "Only include inspections from the last N days."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_inspection_details",
            "description": "Get full detail for one inspection by ID: every detected defect, its severity and confidence, registration status, and any existing AI summary. Use this to answer 'why did board X fail' style questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "inspection_id": {"type": "string", "description": "The inspection's UUID."},
                },
                "required": ["inspection_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_defect_frequency",
            "description": "Get defect-type counts across all inspections, sorted most frequent first, optionally limited to the last N days. Use this to answer 'what's our most common defect' style questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Only include defects from the last N days; omit for all-time."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_templates",
            "description": "List the organization's PCB templates and whether each has a golden reference board uploaded.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]
