"""Populates the live production database with a real demo: several PCB
templates + golden PCBs + inspections, built from DeepPCB's
template/tested image pairs (5 visually distinct board layouts not used
in training/testing elsewhere this session).

Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_JWT_SECRET in the
environment (same values already in backend/.env -- never hardcoded here,
since unlike ad-hoc shell commands this file is committed to git history).
Creates one persistent demo user (see DEMO_EMAIL/DEMO_PASSWORD below) --
this is NOT cleaned up afterward, unlike every other test round this
session.

Usage:
  SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... python ml/populate_demo.py
"""

import os
import time

import httpx
from jose import jwt

API_BASE = "https://pcbmind-api.onrender.com"
SUPABASE_URL = "https://xymoiraqvfbzqashsrvv.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]

DEMO_EMAIL = "demo@pcbmind.ai"
DEMO_PASSWORD = "PcbMindDemo2026!"

DEEPPCB_DIR = "d:/pcbmind-ai/ml/datasets/raw/deeppcb/PCBData"

# (template_display_name, deeppcb_group, template_image_id, [tested_image_ids])
DEMO_BOARDS = [
    ("Control Board Rev A", "12300", "12300060", ["12300061", "12300062", "12300063"]),
    ("Power Supply Module", "13000", "13000000", ["13000001", "13000002", "13000003"]),
    ("Sensor Interface Board", "20085", "20085000", ["20085001", "20085002", "20085003"]),
    ("Motor Driver Board", "44000", "44000011", ["44000012", "44000013", "44000014"]),
    ("IO Expansion Board", "92000", "92000000", ["92000001", "92000002", "92000003"]),
]


def board_image_path(group: str, image_id: str, kind: str) -> str:
    return f"{DEEPPCB_DIR}/group{group}/{group}/{image_id}_{kind}.jpg"


def create_demo_user() -> str:
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}", "apikey": SUPABASE_SERVICE_ROLE_KEY},
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD, "email_confirm": True},
        )
        if resp.status_code >= 400:
            # Likely already exists from a prior run -- look it up instead.
            list_resp = client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}", "apikey": SUPABASE_SERVICE_ROLE_KEY},
                params={"email": DEMO_EMAIL},
            )
            list_resp.raise_for_status()
            users = list_resp.json().get("users", [])
            if not users:
                resp.raise_for_status()
            return users[0]["id"]
        return resp.json()["id"]


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "email": DEMO_EMAIL, "aud": "authenticated"}, SUPABASE_JWT_SECRET, algorithm="HS256")


def main():
    user_id = create_demo_user()
    print(f"Demo user: {DEMO_EMAIL} / {DEMO_PASSWORD} (id={user_id})")
    token = make_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(base_url=API_BASE, headers=headers, timeout=60) as client:
        resp = client.post("/api/auth/bootstrap", json={"full_name": "PCBMind Demo", "organization_name": "PCBMind Demo Manufacturing"})
        if resp.status_code >= 400 and "already" not in resp.text.lower():
            resp.raise_for_status()
        print("Bootstrap:", resp.status_code)

        for display_name, group, template_img_id, tested_ids in DEMO_BOARDS:
            resp = client.post("/api/pcb-templates", data={"name": display_name})
            resp.raise_for_status()
            template_id = resp.json()["id"]
            print(f"\n[{display_name}] template_id={template_id}")

            template_path = board_image_path(group, template_img_id, "temp")
            with open(template_path, "rb") as f:
                resp = client.post(f"/api/pcb-templates/{template_id}/golden", files={"file": (f"{template_img_id}_temp.jpg", f, "image/jpeg")})
            resp.raise_for_status()
            golden_id = resp.json()["id"]
            print(f"  golden_pcb_id={golden_id} (waiting for baseline detection to finish...)")
            time.sleep(90)  # cold-start model load + inference for the golden baseline pass

            for tested_id in tested_ids:
                tested_path = board_image_path(group, tested_id, "test")
                with open(tested_path, "rb") as f:
                    resp = client.post(
                        "/api/inspections",
                        data={"template_id": template_id, "golden_pcb_id": golden_id},
                        files={"file": (f"{tested_id}_test.jpg", f, "image/jpeg")},
                    )
                resp.raise_for_status()
                inspection_id = resp.json()["id"]
                print(f"  inspection {inspection_id} ({tested_id}) -> processing...", end="", flush=True)

                for _ in range(60):
                    time.sleep(3)
                    r = client.get(f"/api/inspections/{inspection_id}")
                    r.raise_for_status()
                    status = r.json()["status"]
                    if status not in ("queued", "processing"):
                        break
                data = r.json()
                print(f" {data['status']} (defects={data['defect_count']}, registration={data['registration_status']})")

    print("\nDemo populated. Log in at https://pcbmind-ai.vercel.app with:")
    print(f"  email: {DEMO_EMAIL}")
    print(f"  password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
