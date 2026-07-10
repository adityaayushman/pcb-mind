"""
Signup/login/password-reset themselves are handled client-side via the
Supabase JS SDK (supabase.auth.signUp / signInWithPassword / resetPasswordForEmail) —
Supabase issues the JWT directly, so the backend doesn't need to touch
credentials at all. This router only manages the `profiles` row (role,
organization) that the JWT alone doesn't carry.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid

from app.core.security import get_current_user, require_role, CurrentUser
from app.db.database import get_db
from app.db.models import Profile, Organization

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ProfileBootstrap(BaseModel):
    full_name: str
    organization_name: str  # creates a new org if this is the first user


class ProfileUpdate(BaseModel):
    full_name: str


class OrganizationUpdate(BaseModel):
    name: str


class ProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str | None
    email: str | None
    role: str
    organization_id: uuid.UUID | None
    organization_name: str | None


async def _profile_out(db: AsyncSession, profile: Profile, email: str | None) -> ProfileOut:
    org = await db.get(Organization, profile.organization_id) if profile.organization_id else None
    return ProfileOut(
        id=profile.id,
        full_name=profile.full_name,
        email=email,
        role=profile.role,
        organization_id=profile.organization_id,
        organization_name=org.name if org else None,
    )


@router.post("/bootstrap", response_model=ProfileOut)
async def bootstrap_profile(
    payload: ProfileBootstrap,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Called once right after a user's first successful signup/login to
    create their organization + profile row (role defaults to 'admin' for
    the org creator; subsequent teammates should be invited with a role
    instead of hitting this endpoint)."""
    existing = await db.get(Profile, user.id)
    if existing:
        return await _profile_out(db, existing, user.email)

    org = Organization(name=payload.organization_name)
    db.add(org)
    await db.flush()

    profile = Profile(id=user.id, organization_id=org.id, full_name=payload.full_name, role="admin")
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return await _profile_out(db, profile, user.email)


@router.get("/me", response_model=ProfileOut)
async def get_me(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    profile = await db.get(Profile, user.id)
    if not profile:
        raise HTTPException(404, "Profile not found — call /api/auth/bootstrap first")
    return await _profile_out(db, profile, user.email)


@router.patch("/me", response_model=ProfileOut)
async def update_me(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    profile = await db.get(Profile, user.id)
    if not profile:
        raise HTTPException(404, "Profile not found — call /api/auth/bootstrap first")
    profile.full_name = payload.full_name
    await db.commit()
    await db.refresh(profile)
    return await _profile_out(db, profile, user.email)


@router.patch("/organization", response_model=ProfileOut)
async def update_organization(
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_role("admin")),
):
    if not user.organization_id:
        raise HTTPException(400, "No organization to update")
    org = await db.get(Organization, user.organization_id)
    org.name = payload.name
    await db.commit()
    profile = await db.get(Profile, user.id)
    return await _profile_out(db, profile, user.email)
