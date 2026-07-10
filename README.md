# PCBMind AI 

AI-powered PCB defect inspection SaaS. This is a working scaffold for the
core workflow: upload → AI inspect → annotated result → PDF report →
dashboard. It is **not** a finished product — the pieces that need real
work before this is usable are called out below.

## Architecture

```
frontend/   Next.js 15 + TS + Tailwind — landing, auth, dashboard, upload, results
backend/    FastAPI — auth bootstrap, templates, inspections, dashboard stats
database/   schema.sql — run this in Supabase's SQL editor first
```

The AI model sits behind one function, `run_inspection()` in
`backend/app/services/ai_inference.py`. Nothing else in the app talks to
YOLO/OpenCV directly — swap the model, move it to its own service, or
retrain it without touching routers or frontend.

Auth: Supabase Auth issues JWTs client-side (signup/login/password-reset all
happen via `supabase-js`, never touch our backend). The backend only verifies
the JWT and manages `profiles` (role + organization).

## What's real vs. what's a stub

| Piece | Status |
|---|---|
| DB schema, RLS policies | Complete, ready to run |
| Auth (signup/login/reset/roles) | Functional via Supabase |
| Upload → Storage → Inspection record | Functional |
| Dashboard stats | Functional |
| PDF report generation | Functional (basic layout — no branding yet) |
| **YOLO defect detection** | **Stub.** Loads a generic Ultralytics checkpoint, not a PCB-trained model. You need labeled PCB defect data (or a labeled component dataset + the golden-PCB diff) to train `MODEL_WEIGHTS_PATH`. Until then, `_diff_against_golden()` is your main real signal. |
| Golden PCB `component_map` authoring | No UI yet — has to be inserted manually or via a small annotation tool |
| shadcn/ui components | Not wired in — pages use plain Tailwind so they run with zero extra setup; add shadcn once you're ready to polish |
| Payments | Intentionally deferred per spec |
