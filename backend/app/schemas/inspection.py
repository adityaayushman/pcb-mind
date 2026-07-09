import uuid
from datetime import datetime
from pydantic import BaseModel, computed_field

from app.core.severity import get_severity
from app.core.validation import validate


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class DefectPrediction(BaseModel):
    id: uuid.UUID
    defect_type: str
    component_label: str | None = None
    bounding_box: BoundingBox
    confidence: float
    is_reference_match: bool = False

    @computed_field
    @property
    def severity(self) -> str:
        return get_severity(self.defect_type)

    class Config:
        from_attributes = True


class InspectionCreate(BaseModel):
    template_id: uuid.UUID
    golden_pcb_id: uuid.UUID | None = None


class InspectionOut(BaseModel):
    id: uuid.UUID
    status: str
    image_url: str
    annotated_image_url: str | None = None
    heatmap_image_url: str | None = None
    overall_confidence: float | None = None
    defect_count: int
    inference_time_ms: int | None = None
    report_url: str | None = None
    ai_summary: str | None = None
    registration_status: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    predictions: list[DefectPrediction] = []

    @computed_field
    @property
    def validation_notes(self) -> list[str]:
        real_defect_types = [p.defect_type for p in self.predictions if not p.is_reference_match]
        return validate(real_defect_types).notes

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_inspections: int
    passed: int
    failed: int
    defect_breakdown: dict[str, int]
    recent: list[InspectionOut]
