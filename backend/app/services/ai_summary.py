"""Lazy, on-demand LLM report summary generation.

Calls OpenRouter's OpenAI-compatible chat completions endpoint (this
project standardizes on OpenRouter for LLM features rather than calling a
provider directly) using `httpx`, already a dependency — no new SDK needed
for a single POST. Mirrors report.py/heatmap.py's get_or_generate pattern:
build once, cache the result, serve that on every later request. Never
raises — a bad key, rate limit, or network hiccup degrades to `None`
rather than breaking inspection/report retrieval.
"""

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.validation import validate
from app.db.models import AIPrediction, Inspection

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def _build_prompt(preds: list[AIPrediction], notes: list[str]) -> str:
    real_preds = [p for p in preds if not p.is_reference_match]
    if not real_preds:
        return (
            "The inspected PCB had zero detected fabrication defects and passed "
            "inspection. Write a 2-3 sentence QA summary confirming a clean board."
        )
    lines = [f"- {p.defect_type} (confidence {float(p.confidence):.0%})" for p in real_preds]
    return (
        f"PCB inspection found {len(real_preds)} defect(s):\n"
        + "\n".join(lines)
        + f"\n\nValidation notes: {'; '.join(notes)}\n\n"
        "Write a 2-4 sentence plain-English QA report summary for a factory floor "
        "supervisor: state the verdict, the most severe defect type(s), and whether "
        "immediate action is needed. No markdown, no bullet points, just prose."
    )


async def _call_llm(prompt: str) -> str | None:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _OPENROUTER_URL,
            headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
            json={
                "model": settings.OPENROUTER_MODEL,
                "max_tokens": 300,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a PCB quality-assurance report writer. Be concise, factual, and non-alarmist.",
                    },
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def get_or_generate_summary(db: AsyncSession, inspection: Inspection) -> str | None:
    if inspection.ai_summary:
        return inspection.ai_summary
    if not settings.OPENROUTER_API_KEY:
        return None

    preds = (
        await db.execute(select(AIPrediction).where(AIPrediction.inspection_id == inspection.id))
    ).scalars().all()
    verdict = validate([p.defect_type for p in preds if not p.is_reference_match])
    prompt = _build_prompt(preds, verdict.notes)

    try:
        summary = await _call_llm(prompt)
    except Exception:
        return None
    if not summary:
        return None

    inspection.ai_summary = summary
    await db.commit()
    return summary
