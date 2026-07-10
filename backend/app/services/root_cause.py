"""AI root-cause analysis for quality drift.

Gathers the real signals a QA engineer would look at when the fail rate leaves
statistical control — which defect types rose vs the baseline, which board is
worst, the SPC drift signals — and asks the (stronger) copilot model to name
the most probable cause and recommend actions. One-shot, grounded in data;
never raises (degrades to None), reusing the OpenRouter pattern from
ai_summary.py but with markdown allowed since the frontend renders it.
"""

import uuid
from datetime import datetime, timedelta

import httpx
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import AIPrediction, Inspection, PCBTemplate
from app.routers.spc import build_daily_metric
from app.services.spc import analyze_control_chart

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_RECENT_DAYS = 7
_BASELINE_DAYS = 30

_SYSTEM_PROMPT = (
    "You are a senior PCB manufacturing process engineer doing root-cause "
    "analysis. You are given real inspection data showing a quality problem. "
    "Identify the 1-2 most probable root causes and give concrete, prioritized "
    "corrective actions a factory-floor team can take today. Be specific and "
    "reference the numbers you were given. Keep it under ~180 words. Use short "
    "markdown: a one-line summary, then a '**Likely cause**' line and a "
    "'**Recommended actions**' bulleted list."
)


async def _defect_counts(db: AsyncSession, org_id, start, end) -> dict[str, int]:
    rows = (
        await db.execute(
            select(AIPrediction.defect_type, func.count())
            .join(Inspection, Inspection.id == AIPrediction.inspection_id)
            .where(
                Inspection.organization_id == org_id,
                Inspection.created_at >= start,
                Inspection.created_at < end,
                AIPrediction.is_reference_match.is_(False),
            )
            .group_by(AIPrediction.defect_type)
        )
    ).all()
    return {dt: c for dt, c in rows}


async def _gather(db: AsyncSession, org_id: uuid.UUID) -> str:
    now = datetime.utcnow()
    recent_start = now - timedelta(days=_RECENT_DAYS)
    baseline_start = now - timedelta(days=_BASELINE_DAYS)

    recent = await _defect_counts(db, org_id, recent_start, now)
    baseline = await _defect_counts(db, org_id, baseline_start, recent_start)
    baseline_days = _BASELINE_DAYS - _RECENT_DAYS

    # Compare each defect type's recent rate/day to its baseline rate/day.
    rows = []
    for dt in sorted(set(recent) | set(baseline), key=lambda d: -recent.get(d, 0)):
        recent_per_day = recent.get(dt, 0) / _RECENT_DAYS
        base_per_day = baseline.get(dt, 0) / baseline_days if baseline_days else 0
        change = (recent_per_day / base_per_day - 1) * 100 if base_per_day else None
        chg = f"{change:+.0f}% vs baseline" if change is not None else "new"
        rows.append(f"  - {dt}: {recent.get(dt, 0)} in last {_RECENT_DAYS}d ({chg})")
    defect_block = "\n".join(rows[:8]) or "  (none)"

    # Worst board by fail rate in the recent window.
    tpl_rows = (
        await db.execute(
            select(
                PCBTemplate.name,
                func.count(),
                func.sum(case((Inspection.status == "failed", 1), else_=0)),
            )
            .join(Inspection, Inspection.template_id == PCBTemplate.id)
            .where(Inspection.organization_id == org_id, Inspection.created_at >= recent_start)
            .group_by(PCBTemplate.name)
            .having(func.count() >= 3)
        )
    ).all()
    worst = sorted(
        ((name, total, (failed or 0) / total * 100) for name, total, failed in tpl_rows),
        key=lambda r: -r[2],
    )
    tpl_block = "\n".join(f"  - {n}: {r:.0f}% fail rate ({t} boards)" for n, t, r in worst[:5]) or "  (n/a)"

    # SPC context.
    points = await build_daily_metric(db, org_id, "fail_rate", _BASELINE_DAYS)
    chart = analyze_control_chart(points)
    latest = points[-1]["value"] if points else 0
    signals = "; ".join(s["message"] for s in chart["signals"][-3:]) or "none"

    return (
        f"Process control status: {chart['status']}. Fail rate today: {latest:.0f}% "
        f"(control center {chart['center_line']}, upper control limit {chart['ucl']}).\n"
        f"Drift signals: {signals}.\n\n"
        f"Defect types in the last {_RECENT_DAYS} days vs the prior baseline:\n{defect_block}\n\n"
        f"Fail rate by board (last {_RECENT_DAYS} days):\n{tpl_block}\n"
    )


async def analyze_drift(db: AsyncSession, org_id: uuid.UUID) -> str | None:
    if not settings.OPENROUTER_API_KEY:
        return None
    try:
        data_summary = await _gather(db, org_id)
        async with httpx.AsyncClient(timeout=40) as client:
            resp = await client.post(
                _OPENROUTER_URL,
                headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
                json={
                    "model": settings.OPENROUTER_COPILOT_MODEL,
                    "max_tokens": 450,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": f"Analyze this quality data:\n\n{data_summary}"},
                    ],
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
