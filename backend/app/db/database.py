from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings

# DATABASE_URL should point at Supabase's *session-mode* pooler (port 5432),
# not transaction-mode (6543): asyncpg's named prepared statements can collide
# across pooled backends in transaction mode (no per-client dedicated backend
# to hold them safely), which surfaces as intermittent
# DuplicatePreparedStatementError. Session mode behaves like a normal
# dedicated connection. statement_cache_size=0 is kept as a light extra
# safety net per Supabase's own asyncpg guidance.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
