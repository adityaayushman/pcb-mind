import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Profile

bearer_scheme = HTTPBearer()

# Supabase projects created since JWT Signing Keys rolled out sign access
# tokens with an asymmetric key (ES256) and publish the public half at this
# well-known JWKS endpoint — there's no shared secret to verify against for
# these. Older projects still on the legacy shared secret sign with HS256,
# which SUPABASE_JWT_SECRET covers instead. Which one applies is read off
# each token's own `alg` header, so both work without configuration.
_jwks_cache: dict | None = None


class CurrentUser:
    def __init__(self, id: str, email: str | None, role: str | None, organization_id: str | None):
        self.id = id
        self.email = email
        self.role = role
        self.organization_id = organization_id


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache
    if _jwks_cache is None or force_refresh:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json")
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def _decode_supabase_jwt(token: str) -> dict:
    try:
        alg = jwt.get_unverified_header(token).get("alg", "HS256")

        if alg == "HS256":
            return jwt.decode(
                token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated"
            )

        try:
            jwks = await _get_jwks()
            return jwt.decode(token, jwks, algorithms=[alg], audience="authenticated")
        except JWTError:
            # kid not found locally could just mean Supabase rotated keys
            jwks = await _get_jwks(force_refresh=True)
            return jwt.decode(token, jwks, algorithms=[alg], audience="authenticated")
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
    payload = await _decode_supabase_jwt(credentials.credentials)
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
