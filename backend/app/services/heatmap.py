"""Lazy, on-demand heatmap generation.

Deliberately decoupled from ai_inference.run_inspection()'s hot path: this
only needs the already-stored predictions (bbox + confidence) and the
original uploaded image, not the YOLO model itself, so it can't compete for
memory with torch/ultralytics loading on a cold instance. Mirrors
report.py's get_or_generate pattern — build once, cache the URL, serve that
on every later request.
"""

import cv2
import httpx
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AIPrediction, Inspection
from app.services import storage
from app.services.ai_inference import Detection, _build_heatmap


async def get_or_generate_heatmap(db: AsyncSession, inspection: Inspection) -> str | None:
    if inspection.heatmap_image_url:
        return inspection.heatmap_image_url

    preds = (
        await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == inspection.id))
    ).scalars().all()
    if not preds:
        return None

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(inspection.image_url)
        resp.raise_for_status()
        image_bytes = resp.content

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    detections = [
        Detection(
            defect_type=p.defect_type,
            component_label=p.component_label,
            bbox=p.bounding_box,
            confidence=float(p.confidence),
        )
        for p in preds
    ]
    heatmap_image = _build_heatmap(img, detections)
    if heatmap_image is None:
        return None

    ok, buf = cv2.imencode(".jpg", heatmap_image)
    if not ok:
        return None

    url = storage.upload_image(buf.tobytes(), "image/jpeg", prefix="heatmap")
    inspection.heatmap_image_url = url
    await db.commit()
    return url
