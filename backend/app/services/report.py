import asyncio
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import Inspection, AIPrediction
from app.services import storage


async def get_or_generate_report(db: AsyncSession, inspection: Inspection) -> str:
    if inspection.report_url:
        return inspection.report_url

    preds = (
        await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == inspection.id))
    ).scalars().all()

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 50, "PCBMind AI — Inspection Report")

    c.setFont("Helvetica", 10)
    c.drawString(40, height - 75, f"Inspection ID: {inspection.id}")
    c.drawString(40, height - 90, f"Status: {inspection.status.upper()}")
    c.drawString(40, height - 105, f"Defects found: {inspection.defect_count}")
    c.drawString(40, height - 120, f"Overall confidence: {inspection.overall_confidence}")
    c.drawString(40, height - 135, f"Inference time: {inspection.inference_time_ms} ms")

    y = height - 165
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Detected Defects")
    y -= 20
    c.setFont("Helvetica", 9)
    for p in preds:
        c.drawString(
            40, y,
            f"- {p.defect_type} | {p.component_label or 'n/a'} | confidence {p.confidence}",
        )
        y -= 14
        if y < 60:
            c.showPage()
            y = height - 60

    c.save()
    buffer.seek(0)

    url = await asyncio.to_thread(storage.upload_report, buffer.read(), str(inspection.id))
    inspection.report_url = url
    await db.commit()
    return url
