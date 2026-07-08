"""Bulk org-level inspection export (CSV/XLSX). Mirrors services/report.py's
pattern of keeping the router thin and the file-format logic here."""

import csv
import io
import uuid
from dataclasses import dataclass, asdict

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.severity import worst_severity
from app.db.models import AIPrediction, Inspection, PCBTemplate, Profile

_COLUMNS = [
    "inspection_id", "created_at", "template_name", "status", "defect_count",
    "overall_confidence", "inference_time_ms", "defect_types", "highest_severity",
    "uploaded_by", "image_url", "report_url",
]


@dataclass
class ExportRow:
    inspection_id: str
    created_at: str
    template_name: str
    status: str
    defect_count: int
    overall_confidence: float | None
    inference_time_ms: int | None
    defect_types: str
    highest_severity: str
    uploaded_by: str
    image_url: str
    report_url: str


async def _fetch_export_rows(db: AsyncSession, organization_id: uuid.UUID | str) -> list[ExportRow]:
    result = await db.execute(
        select(Inspection, PCBTemplate.name, Profile.full_name)
        .outerjoin(PCBTemplate, PCBTemplate.id == Inspection.template_id)
        .outerjoin(Profile, Profile.id == Inspection.uploaded_by)
        .where(Inspection.organization_id == organization_id)
        .order_by(Inspection.created_at.desc())
    )
    rows = result.all()
    inspection_ids = [insp.id for insp, _, _ in rows]

    defect_types_by_inspection: dict[uuid.UUID, list[str]] = {}
    if inspection_ids:
        pred_result = await db.execute(
            select(AIPrediction.inspection_id, AIPrediction.defect_type).where(
                AIPrediction.inspection_id.in_(inspection_ids)
            )
        )
        for insp_id, defect_type in pred_result.all():
            defect_types_by_inspection.setdefault(insp_id, []).append(defect_type)

    export_rows = []
    for insp, template_name, uploader_name in rows:
        defect_types = sorted(set(defect_types_by_inspection.get(insp.id, [])))
        export_rows.append(
            ExportRow(
                inspection_id=str(insp.id),
                created_at=insp.created_at.isoformat() if insp.created_at else "",
                template_name=template_name or "",
                status=insp.status,
                defect_count=insp.defect_count,
                overall_confidence=(
                    float(insp.overall_confidence) if insp.overall_confidence is not None else None
                ),
                inference_time_ms=insp.inference_time_ms,
                defect_types=", ".join(defect_types),
                highest_severity=worst_severity(defect_types) or "",
                uploaded_by=uploader_name or "",
                image_url=insp.image_url,
                report_url=insp.report_url or "",
            )
        )
    return export_rows


async def export_csv(db: AsyncSession, organization_id: uuid.UUID | str) -> str:
    rows = await _fetch_export_rows(db, organization_id)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=_COLUMNS)
    writer.writeheader()
    for row in rows:
        writer.writerow(asdict(row))
    return buffer.getvalue()


async def export_xlsx(db: AsyncSession, organization_id: uuid.UUID | str) -> bytes:
    rows = await _fetch_export_rows(db, organization_id)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inspections"
    ws.append(_COLUMNS)
    for row in rows:
        data = asdict(row)
        ws.append([data[col] for col in _COLUMNS])
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
