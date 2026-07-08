"""
AI inference service.

This is the single seam between the product and the model. The rest of the
app (routers, dashboard, reports) only ever talks to `run_inspection()` and
never touches YOLO/OpenCV directly — so the model can be swapped, retrained,
or moved to its own microservice later without touching the API layer.

MVP implementation notes:
- Uses Ultralytics YOLO for component/defect detection.
- Golden-PCB comparison (missing/misaligned components) is done by diffing
  detected component boxes against `golden_pcb.component_map`.
- Swap `MODEL_WEIGHTS_PATH` in config once a PCB-defect-trained model exists;
  until then this will run on a generic/placeholder checkpoint and should be
  treated as scaffolding, not a working detector.
"""

import gc
import time
from dataclasses import dataclass, field

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from app.core.config import settings

# This runs on small (often 512MB) hosts with no GPU — capping thread pools
# avoids each library spinning up one thread per core, which costs real
# memory (stacks/arenas) for no benefit at this instance size.
cv2.setNumThreads(1)
torch.set_num_threads(1)

# The size the model was actually trained at (see ml/train.py) — inference
# runs at this resolution too, rather than a larger one that YOLO would just
# have to letterbox back down internally.
_INFERENCE_IMGSZ = 512

_model: YOLO | None = None

# Maps a trained model's raw class names to the canonical `defect_type` enum
# (database/schema.sql / app/db/models.py). Datasets/exports spell these
# differently (e.g. "open" vs "open_circuit", "copper" vs "spurious_copper"),
# so this normalizes known variants and falls back to "other" otherwise.
_DEFECT_TYPE_ALIASES: dict[str, str] = {
    "missing_hole": "missing_hole", "missing-hole": "missing_hole",
    "pin-hole": "missing_hole", "pinhole": "missing_hole",
    "mouse_bite": "mouse_bite", "mouse-bite": "mouse_bite", "mousebite": "mouse_bite",
    "open_circuit": "open_circuit", "open-circuit": "open_circuit", "open": "open_circuit",
    "short": "short", "short_circuit": "short", "short-circuit": "short",
    "spur": "spur",
    "spurious_copper": "spurious_copper", "spurious-copper": "spurious_copper", "copper": "spurious_copper",
}
_CANONICAL_DEFECT_TYPES = {
    "missing_hole", "mouse_bite", "open_circuit", "short", "spur", "spurious_copper",
}


def _normalize_defect_type(raw_label: str) -> str:
    key = raw_label.strip().lower().replace(" ", "_")
    mapped = _DEFECT_TYPE_ALIASES.get(key, key)
    return mapped if mapped in _CANONICAL_DEFECT_TYPES else "other"


def _get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(settings.MODEL_WEIGHTS_PATH)
    return _model


@dataclass
class Detection:
    defect_type: str
    component_label: str | None
    bbox: dict  # {x, y, width, height} normalized 0-1
    confidence: float


@dataclass
class InspectionResult:
    detections: list[Detection] = field(default_factory=list)
    overall_confidence: float = 1.0
    inference_time_ms: int = 0
    annotated_image: np.ndarray | None = None
    heatmap_image: np.ndarray | None = None

    @property
    def passed(self) -> bool:
        return len(self.detections) == 0


_CLAHE_CLIP_LIMIT = 2.0
_CLAHE_TILE_GRID_SIZE = (8, 8)


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """Adaptive local contrast correction so uneven real-world lighting
    (phone-camera glare/shadow across the board) doesn't wash out fine
    defect edges the way a flat global contrast boost does. Runs only on
    the L (lightness) channel in LAB space — doing this per-BGR-channel
    would shift hue/saturation and risk the model reacting to color
    changes rather than the copper/silkscreen edges it was trained on."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=_CLAHE_CLIP_LIMIT, tileGridSize=_CLAHE_TILE_GRID_SIZE)
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def _preprocess(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    # Resize first so the CLAHE tile grid is a fixed fraction of the image
    # regardless of the source photo's native resolution.
    img = cv2.resize(img, (_INFERENCE_IMGSZ, _INFERENCE_IMGSZ))
    img = _apply_clahe(img)
    return img


def _diff_against_golden(detections: list[Detection], component_map: dict | None) -> list[Detection]:
    """Flags components present in the golden reference but absent in the
    detected set. Vestigial for the bare-board-fabrication taxonomy (it
    modeled assembly-defect diffing) and currently dead in practice —
    `component_map` is never populated — but kept enum-safe rather than
    ripped out, since GoldenPCB is still a live DB table/route."""
    if not component_map:
        return detections
    detected_labels = {d.component_label for d in detections}
    for expected in component_map.get("components", []):
        if expected["label"] not in detected_labels:
            detections.append(
                Detection(
                    defect_type="other",
                    component_label=expected["label"],
                    bbox=expected["bbox"],
                    confidence=1.0,
                )
            )
    return detections


def _build_heatmap(img: np.ndarray, detections: list[Detection]) -> np.ndarray | None:
    """Defect-density/confidence heatmap: one Gaussian blob per detection,
    centered on its bbox and scaled by confidence, summed, normalized,
    colorized, and alpha-blended over the image. This is NOT model
    attention/Grad-CAM — it doesn't hook into YOLO's internals (fragile
    across ultralytics versions, and easy to misrepresent as "what the
    model saw" if done wrong). It's an honest visualization of where
    detections landed and how confident they were. Returns None when
    there's nothing to show (a clean "passed" inspection)."""
    if not detections:
        return None

    h, w = img.shape[:2]
    accum = np.zeros((h, w), dtype=np.float32)
    # np.ogrid yields int64 arrays; combined with the Python floats below
    # that'd upcast every intermediate to float64 (double the memory of
    # what this needs) — cast to float32 up front to keep it there.
    y_idx, x_idx = (a.astype(np.float32) for a in np.ogrid[:h, :w])
    for d in detections:
        bx, by = d.bbox["x"] * w, d.bbox["y"] * h
        bw, bh = d.bbox["width"] * w, d.bbox["height"] * h
        cx, cy = bx + bw / 2, by + bh / 2
        sigma_x, sigma_y = max(bw / 2, 4), max(bh / 2, 4)
        gaussian = np.exp(
            -(((x_idx - cx) ** 2) / (2 * sigma_x**2) + ((y_idx - cy) ** 2) / (2 * sigma_y**2))
        )
        accum += gaussian * d.confidence

    if accum.max() <= 0:
        return None
    normalized = (accum / accum.max() * 255).astype(np.uint8)
    colorized = cv2.applyColorMap(normalized, cv2.COLORMAP_JET)
    return cv2.addWeighted(img, 0.6, colorized, 0.4, 0)


def run_inspection(image_bytes: bytes, golden_component_map: dict | None = None) -> InspectionResult:
    start = time.perf_counter()

    img = _preprocess(image_bytes)
    model = _get_model()
    with torch.inference_mode():
        results = model.predict(
            img, conf=settings.INFERENCE_CONFIDENCE_THRESHOLD, imgsz=_INFERENCE_IMGSZ, verbose=False
        )

    detections: list[Detection] = []
    h, w = img.shape[:2]
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label = model.names[int(box.cls[0])]
            detections.append(
                Detection(
                    defect_type=_normalize_defect_type(label),
                    component_label=label,
                    bbox={
                        "x": x1 / w, "y": y1 / h,
                        "width": (x2 - x1) / w, "height": (y2 - y1) / h,
                    },
                    confidence=float(box.conf[0]),
                )
            )

    detections = _diff_against_golden(detections, golden_component_map)
    overall_confidence = (
        sum(d.confidence for d in detections) / len(detections) if detections else 1.0
    )
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    annotated_image = results[0].plot() if results else img

    # Release the model's raw tensors/results promptly rather than waiting
    # for Python's regular GC cycle — matters on memory-constrained hosts.
    del results
    gc.collect()

    # Heatmap generation is deliberately NOT done here (see services/heatmap.py
    # for the lazy, on-demand path) — computing it eagerly on this same
    # request competes for memory with YOLO/torch's own first-load spike,
    # which is enough to OOM a 512MB instance on a cold start.
    return InspectionResult(
        detections=detections,
        overall_confidence=round(overall_confidence, 4),
        inference_time_ms=elapsed_ms,
        annotated_image=annotated_image,
        heatmap_image=None,
    )
