"""Helper for creating in-app notifications from background jobs. Kept
deliberately tiny and side-effect-only: a notification is a nice-to-have
signal layered on top of the real inspection/golden data, so failing to
write one must never break the job that triggered it (callers wrap in the
same try/except that already guards the surrounding work)."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification


async def create_notification(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    user_id: uuid.UUID | None,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    # No recipient (e.g. an inspection with no uploaded_by) -> nothing to
    # deliver; silently skip rather than orphan a row no one can see.
    if user_id is None:
        return
    db.add(
        Notification(
            organization_id=organization_id,
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            link=link,
        )
    )
    await db.commit()
