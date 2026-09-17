-- ============================================================
-- Ticket Management System - Supabase (PostgreSQL) schema
-- Run this in Supabase Dashboard -> SQL Editor.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- Keeps updated_at current on every UPDATE
-- (replaces MySQL's ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    url         VARCHAR(500) NOT NULL,
    api_url     VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id     INTEGER NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    ticket_no      VARCHAR(100) NOT NULL UNIQUE,
    type           VARCHAR(20) NOT NULL DEFAULT 'bug'
                   CHECK (type IN ('bug', 'feature', 'enhancement', 'documentation')),
    platform       VARCHAR(255) NOT NULL,
    module         VARCHAR(255) NOT NULL,
    submodule      VARCHAR(255) NOT NULL,
    date_detected  DATE NOT NULL,
    current_state  TEXT NOT NULL,
    desired_state  TEXT NOT NULL,
    purpose        TEXT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    remarks        TEXT,
    page_url       VARCHAR(500) NOT NULL,
    reporter_name  VARCHAR(255) NOT NULL,
    reporter_role  VARCHAR(100) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- UNIQUE columns (projects.name, tickets.ticket_no) are indexed automatically.
-- Postgres does not index foreign keys automatically, so project_id is indexed here.
CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON public.tickets (project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON public.tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_type       ON public.tickets (type);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at);

-- Create Evidence Table
CREATE TABLE IF NOT EXISTS public.evidence (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id    INTEGER NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    size         INTEGER NOT NULL CHECK (size >= 0),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    url          VARCHAR(500) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.evidence.size IS 'File size in bytes';

CREATE INDEX IF NOT EXISTS idx_evidence_ticket_id ON public.evidence (ticket_id);

-- Row Level Security
-- Supabase exposes the public schema through its REST API using the anon key.
-- Enabling RLS with no policies blocks that public access. The Express server
-- connects through the pooler as the postgres role (the table owner), which
-- RLS does not apply to, so the API keeps working.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

-- Optional: Create view for easy querying (returns data similar to your GET response)
-- security_invoker makes the view respect the RLS rules above.
CREATE OR REPLACE VIEW public.tickets_view
WITH (security_invoker = true) AS
SELECT
    p.id   AS project_id,
    p.name AS project_name,
    p.url  AS project_url,
    p.api_url,
    t.id,
    t.ticket_no,
    t.type,
    t.platform,
    t.module,
    t.submodule,
    t.date_detected,
    t.current_state,
    t.desired_state,
    t.purpose,
    t.status,
    t.remarks,
    t.page_url,
    t.reporter_name,
    t.reporter_role,
    t.created_at,
    t.updated_at
FROM public.tickets t
LEFT JOIN public.projects p ON t.project_id = p.id
ORDER BY t.created_at DESC;

-- Optional: Insert sample data (commented out)
-- INSERT INTO public.projects (name, url, api_url)
-- VALUES ('MoBilis', 'https://mobilis.brigada.net', 'https://api.mobilis.brigada.net')
-- ON CONFLICT (name) DO NOTHING;
