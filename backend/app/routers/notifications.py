"""In-app notification feed for the current user: list recent items, expose
an unread count for the header bell, and mark items read. Notifications are
written by background jobs (see services/notifications.py); this router is
read + mark-read only."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, CurrentUser
from app.db.database import get_db
from app.db.models import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int


@router.get("", response_model=NotificationList)
async def list_notifications(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    rows = (
        await db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    unread = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    return NotificationList(items=rows, unread_count=unread or 0)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    notification = await db.get(Notification, notification_id)
    if not notification or str(notification.user_id) != str(user.id):
        raise HTTPException(404, "Notification not found")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/read-all", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
