"""AI Manufacturing Copilot — a multi-turn conversation with tool-calling
against real organization data, via OpenRouter's OpenAI-compatible chat
completions endpoint. This is a new, parallel implementation to
services/ai_summary.py rather than an extension of it: `ai_summary._call_llm`
takes a single prompt string, fires one non-streaming request, and returns
only `.content` — it never inspects `tool_calls`, and there's no loop. A
copilot needs a real message array (system + history + new turn) and a
call → maybe-tool-calls → execute → call-again loop, which doesn't fit
inside that function's shape.
"""

import json
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import CurrentUser
from app.db.models import CopilotMessage
from app.services.copilot_tools import TOOL_FUNCTIONS, TOOL_SCHEMAS

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_MAX_TOOL_ROUNDS = 5
_HISTORY_LIMIT = 20  # most recent messages fed back as context, not the full unbounded log

_SYSTEM_PROMPT = (
    "You are the AI Manufacturing Copilot for PCBMind AI, a PCB fabrication "
    "quality-assurance platform. Answer questions about the user's real "
    "inspection data using the tools available — never guess or make up "
    "numbers, always call a tool to check first. Be concise and factual. "
    "Light markdown (short lists, bold for key numbers) is fine when it "
    "aids scanability, but don't overuse it."
)


async def _call_llm(messages: list[dict]) -> dict:
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(
            _OPENROUTER_URL,
            headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
            json={
                "model": settings.OPENROUTER_COPILOT_MODEL,
                "max_tokens": 800,
                "messages": messages,
                "tools": TOOL_SCHEMAS,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]


async def _load_history(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    rows = (
        await db.execute(
            select(CopilotMessage)
            .where(CopilotMessage.user_id == user_id)
            .order_by(CopilotMessage.created_at.desc())
            .limit(_HISTORY_LIMIT)
        )
    ).scalars().all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


async def run_conversation(db: AsyncSession, user: CurrentUser, user_message: str) -> str:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("Copilot is not configured (missing OPENROUTER_API_KEY)")
    if not user.organization_id:
        raise RuntimeError("Finish setting up your organization before using the copilot")

    user_id = uuid.UUID(user.id)
    history = await _load_history(db, user_id)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": user_message},
    ]

    final_content = ""
    for _ in range(_MAX_TOOL_ROUNDS):
        message = await _call_llm(messages)
        tool_calls = message.get("tool_calls")
        if not tool_calls:
            final_content = (message.get("content") or "").strip()
            break

        messages.append(message)
        for call in tool_calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            fn = TOOL_FUNCTIONS.get(name)
            result = {"error": f"Unknown tool '{name}'"} if fn is None else await fn(db, user.organization_id, **args)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result, default=str),
                }
            )
    if not final_content:
        final_content = "I wasn't able to finish looking that up — try rephrasing or asking something more specific."

    db.add(CopilotMessage(organization_id=user.organization_id, user_id=user_id, role="user", content=user_message))
    db.add(
        CopilotMessage(
            organization_id=user.organization_id, user_id=user_id, role="assistant", content=final_content
        )
    )
    await db.commit()

    return final_content
