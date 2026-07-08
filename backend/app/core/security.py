from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Profile

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, id: str, email: str | None, role: str | None, organization_id: str | None):
        self.id = id
        self.email = email
        self.role = role
        self.organization_id = organization_id


def _decode_supabase_jwt(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """
    Verifies the Supabase-issued JWT sent from the frontend and returns the
    caller's identity, with role/organization filled in from `profiles`
    (kept out of the token itself to avoid staleness). A user who hasn't
    called /api/auth/bootstrap yet simply has role=None/organization_id=None.
    """
    payload = _decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    profile = await db.get(Profile, user_id)

    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        role=profile.role if profile else None,
        organization_id=profile.organization_id if profile else None,
    )


def require_role(*allowed_roles: str):
    """Dependency factory for role-gated routes, e.g. Depends(require_role('admin'))."""

    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return _check
