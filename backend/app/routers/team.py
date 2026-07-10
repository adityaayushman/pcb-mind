"""Team management: list the members of the caller's organization and
(for admins) change a member's role. Emails live in Supabase's auth.users,
not our `profiles` table, so they're fetched from the Supabase admin API
with the service-role key -- same key storage.py already uses -- rather
than duplicated into our schema."""

import asyncio
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user, require_role, CurrentUser
from app.db.database import get_db
from app.db.models import Profile

router = APIRouter(prefix="/api/team", tags=["team"])

VALID_ROLES = {"admin", "qa_engineer", "operator"}


class TeamMember(BaseModel):
    id: uuid.UUID
    full_name: str | None
    email: str | None
    role: str
    is_self: bool


class RoleUpdate(BaseModel):
    role: str


async def _fetch_email(client: httpx.AsyncClient, user_id: uuid.UUID) -> str | None:
    try:
        resp = await client.get(f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}")
        if resp.status_code == 200:
            return resp.json().get("email")
    except httpx.HTTPError:
        pass
    return None


@router.get("", response_model=list[TeamMember])
async def list_team(
    db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)
):
    profiles = (
        await db.execute(
            select(Profile)
            .where(Profile.organization_id == user.organization_id)
            .order_by(Profile.created_at)
        )
    ).scalars().all()

    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        emails = await asyncio.gather(*[_fetch_email(client, p.id) for p in profiles])

    return [
        TeamMember(
            id=p.id,
            full_name=p.full_name,
            email=email,
            role=p.role,
            is_self=str(p.id) == str(user.id),
        )
        for p, email in zip(profiles, emails)
    ]


@router.patch("/{member_id}", response_model=TeamMember)
async def update_member_role(
    member_id: uuid.UUID,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(400, f"Role must be one of {sorted(VALID_ROLES)}")

    # Changing your own role risks locking the org out of its last admin --
    # disallow entirely; an admin manages other members, not themselves.
    if str(member_id) == str(user.id):
        raise HTTPException(400, "You can't change your own role")

    member = await db.get(Profile, member_id)
    if not member or member.organization_id != user.organization_id:
        raise HTTPException(404, "Team member not found")

    member.role = payload.role
    await db.commit()
    await db.refresh(member)

    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        email = await _fetch_email(client, member.id)

    return TeamMember(
        id=member.id, full_name=member.full_name, email=email, role=member.role, is_self=False
    )
