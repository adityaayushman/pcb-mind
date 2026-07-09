import uuid

import httpx
from supabase import create_client, Client

from app.core.config import settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def upload_image(file_bytes: bytes, content_type: str, prefix: str = "inspections") -> str:
    """Uploads to Supabase Storage and returns the public/signed URL path."""
    client = get_client()
    path = f"{prefix}/{uuid.uuid4()}.jpg"
    client.storage.from_(settings.STORAGE_BUCKET).upload(
        path, file_bytes, {"content-type": content_type}
    )
    return client.storage.from_(settings.STORAGE_BUCKET).get_public_url(path)


def upload_report(pdf_bytes: bytes, inspection_id: str) -> str:
    client = get_client()
    path = f"reports/{inspection_id}.pdf"
    client.storage.from_(settings.STORAGE_BUCKET).upload(
        path, pdf_bytes, {"content-type": "application/pdf"}
    )
    return client.storage.from_(settings.STORAGE_BUCKET).get_public_url(path)


async def download_image(url: str) -> bytes:
    """Re-fetches bytes for an already-uploaded image from its stored URL —
    needed when the caller doesn't already have the bytes in memory (e.g.
    pulling in a golden PCB's reference image at inspection time)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content
