# PCBMind AI — MVP Scaffold

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

## Getting it running locally

1. **Supabase**: create a project, run `database/schema.sql` in the SQL
   editor, create a Storage bucket named `pcb-images` (public read).
2. **Backend**:
   ```bash
   cd backend
   cp .env.example .env   # fill in Supabase URL/keys + DATABASE_URL
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
3. **Frontend**:
   ```bash
   cd frontend
   cp .env.example .env.local   # fill in Supabase URL/anon key + API URL
   npm install
   npm run dev
   ```
4. Register an account at `/register` (creates your organization as admin),
   create a PCB template + upload a Golden PCB via the API (no UI for this
   yet), then run an inspection from `/dashboard/upload`.

## Deploying

- **Frontend → Vercel**: point it at `frontend/`, set the three env vars.
- **Backend → Railway**: point it at `backend/`, it'll pick up the
  `Dockerfile`. Set env vars from `.env.example`.
- **Model weights**: don't bake large weight files into the Docker image if
  you can avoid it — pull from object storage on container start once you
  have a real trained model.

## Suggested next steps, in order

1. Get a labeled PCB dataset (or start with a public component-detection
   dataset) and train a first real YOLO checkpoint.
2. Build the missing "create template + upload golden PCB" screen — right
   now that only exists as an API endpoint.
3. Wire in shadcn/ui once the core loop works, for visual polish.
4. Add Stripe when you're ready to charge.

This is a genuinely multi-week build (model training + full-stack + three
deployment targets). For the ongoing iterate-test-deploy loop, Claude Code
will be a better fit than this chat — it can run the dev servers, actually
hit your Supabase project, and iterate against real errors.
