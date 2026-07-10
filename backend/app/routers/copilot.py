import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.db.database import get_db
from app.db.models import CopilotMessage
from app.schemas.copilot import CopilotChatRequest, CopilotMessageOut

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.post("/chat", response_model=CopilotMessageOut)
async def chat(
    body: CopilotChatRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Runs the tool-calling conversation loop. See services/copilot.py.
    Synchronous request/response — unlike inspection creation this doesn't
    need the async-background-task-with-polling pattern, since LLM
    round-trips (even a few tool-calling rounds) take single-digit seconds,
    nothing like the 60-80s cold YOLO load that forced that pattern
    elsewhere."""
    from app.services.copilot import run_conversation

    if not body.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    try:
        await run_conversation(db, user, body.message.strip())
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc

    # run_conversation already persisted both turns; fetch the assistant row
    # back out so the response carries a real created_at timestamp.
    row = (
        await db.execute(
            select(CopilotMessage)
            .where(CopilotMessage.user_id == uuid.UUID(user.id), CopilotMessage.role == "assistant")
            .order_by(CopilotMessage.created_at.desc())
            .limit(1)
        )
    ).scalar_one()
    return row


@router.get("/messages", response_model=list[CopilotMessageOut])
async def list_messages(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(CopilotMessage)
            .where(CopilotMessage.user_id == uuid.UUID(user.id))
            .order_by(CopilotMessage.created_at.asc())
        )
    ).scalars().all()
    return rows


@router.delete("/messages", status_code=204)
async def clear_messages(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await db.execute(delete(CopilotMessage).where(CopilotMessage.user_id == uuid.UUID(user.id)))
    await db.commit()
