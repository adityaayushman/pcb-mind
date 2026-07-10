from datetime import date

from pydantic import BaseModel


class PeriodStats(BaseModel):
    total: int
    passed: int
    failed: int
    pass_rate: float | None = None
    avg_inference_time_ms: float | None = None


class DailyTrendPoint(BaseModel):
    date: date
    total: int
    passed: int
    failed: int
    pass_rate: float | None = None
    avg_inference_time_ms: float | None = None


class TopDefect(BaseModel):
    defect_type: str
    count: int


class AnalyticsOut(BaseModel):
    current_period: PeriodStats
    previous_period: PeriodStats
    daily_trend: list[DailyTrendPoint]
    defect_trend: list[dict]
    top_defects: list[TopDefect]
