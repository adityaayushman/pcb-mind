from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, inspection, dashboard, pcb, copilot, analytics

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pcb.router)
app.include_router(inspection.router)
app.include_router(dashboard.router)
app.include_router(copilot.router)
app.include_router(analytics.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME}
