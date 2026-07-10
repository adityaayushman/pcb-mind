-- PCBMind AI — Core schema (Supabase / Postgres)
-- Run in Supabase SQL editor, or via `psql` / migration tool.

create extension if not exists "uuid-ossp";

-- ========== ORGANIZATIONS & USERS ==========

create table organizations (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    plan text not null default 'free',  -- free | pro | enterprise (see app/core/plans.py)
    created_at timestamptz not null default now()
);

-- Supabase Auth already provides auth.users; we extend with a profile table.
create type user_role as enum ('admin', 'qa_engineer', 'operator');

create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    organization_id uuid references organizations(id) on delete set null,
    full_name text,
    role user_role not null default 'operator',
    created_at timestamptz not null default now()
);

-- ========== GOLDEN PCB LIBRARY / TEMPLATES ==========

create table pcb_templates (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    name text not null,
    description text,
    created_by uuid references profiles(id),
    created_at timestamptz not null default now()
);

create table golden_pcbs (
    id uuid primary key default uuid_generate_v4(),
    template_id uuid not null references pcb_templates(id) on delete cascade,
    image_url text not null,           -- Supabase Storage path
    component_map jsonb,               -- baseline defect detections from golden image (YOLO run at upload time), for spatial suppression at inspection time
    version int not null default 1,
    created_at timestamptz not null default now()
);

-- ========== INSPECTIONS ==========

create type inspection_status as enum ('queued', 'processing', 'passed', 'failed', 'error');

create table inspections (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    template_id uuid references pcb_templates(id),
    golden_pcb_id uuid references golden_pcbs(id),
    uploaded_by uuid references profiles(id),
    image_url text not null,
    annotated_image_url text,
    heatmap_image_url text,
    status inspection_status not null default 'queued',
    overall_confidence numeric(5,4),
    defect_count int not null default 0,
    inference_time_ms int,
    report_url text,                   -- generated PDF
    ai_summary text,                   -- LLM-generated plain-English QA summary
    registration_status text,          -- 'no_golden' | 'registered' | 'insufficient_features'
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create type defect_type as enum (
    'missing_hole',
    'mouse_bite',
    'open_circuit',
    'short',
    'spur',
    'spurious_copper',
    'other'
);

create table ai_predictions (
    id uuid primary key default uuid_generate_v4(),
    inspection_id uuid not null references inspections(id) on delete cascade,
    defect_type defect_type not null,
    component_label text,
    bounding_box jsonb not null,       -- {x, y, width, height} normalized 0-1
    confidence numeric(5,4) not null,
    is_reference_match boolean not null default false,  -- present on the golden board too → likely artifact
    -- Human-in-the-loop verification (continuous-learning loop):
    feedback text,                     -- null | 'confirmed' | 'rejected'
    feedback_by uuid references profiles(id),
    feedback_at timestamptz,
    created_at timestamptz not null default now()
);

-- ========== AI MANUFACTURING COPILOT ==========
-- One continuous conversation per user (not full multi-thread management),
-- tool queries scoped by organization_id so teammates asking about the same
-- org get consistent answers regardless of whose conversation it's in.

create table copilot_messages (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

-- ========== NOTIFICATIONS ==========
-- In-app alerts targeted at a specific recipient (the inspection's uploader,
-- the golden-PCB uploader, etc.). Written by background jobs the moment an
-- event completes so the header bell surfaces it without the user polling
-- the dashboard.

create table notifications (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references profiles(id) on delete cascade,
    type text not null,
    title text not null,
    body text,
    link text,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

-- ========== ACTIVITY / AUDIT LOG ==========

create table activity_logs (
    id uuid primary key default uuid_generate_v4(),
    organization_id uuid references organizations(id),
    actor_id uuid references profiles(id),
    action text not null,              -- e.g. "inspection.created"
    target_type text,
    target_id uuid,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- ========== INDEXES ==========

create index idx_copilot_messages_user on copilot_messages(user_id, created_at);
create index idx_notifications_user on notifications(user_id, is_read, created_at desc);
create index idx_inspections_org on inspections(organization_id);
create index idx_inspections_status on inspections(status);
create index idx_predictions_inspection on ai_predictions(inspection_id);
create index idx_golden_pcbs_template on golden_pcbs(template_id);

-- ========== ROW LEVEL SECURITY ==========
-- Enable RLS and scope every table to the caller's organization.

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table pcb_templates enable row level security;
alter table golden_pcbs enable row level security;
alter table inspections enable row level security;
alter table ai_predictions enable row level security;
alter table activity_logs enable row level security;

create policy "profiles: self read" on profiles
    for select using (id = auth.uid());

create policy "org-scoped: templates" on pcb_templates
    for all using (
        organization_id in (select organization_id from profiles where id = auth.uid())
    );

create policy "org-scoped: inspections" on inspections
    for all using (
        organization_id in (select organization_id from profiles where id = auth.uid())
    );

-- NOTE: golden_pcbs / ai_predictions inherit org scoping via their parent
-- template_id / inspection_id in application-layer queries; add joined
-- policies here once template/inspection ownership rules are finalized.
