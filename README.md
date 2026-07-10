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
