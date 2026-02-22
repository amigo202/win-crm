-- ═══════════════════════════════════════════════════
-- WIN CRM – Supabase Schema
-- Run this entire script in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── Contacts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT    NOT NULL DEFAULT 'school',
  name            TEXT    NOT NULL DEFAULT '',
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  city            TEXT,
  status          TEXT    NOT NULL DEFAULT 'lead',
  active_programs JSONB   NOT NULL DEFAULT '[]',
  notes           JSONB   NOT NULL DEFAULT '[]',
  activities      JSONB   NOT NULL DEFAULT '[]',
  tags            JSONB   NOT NULL DEFAULT '[]',
  -- school
  principal       TEXT,
  student_count   TEXT,
  -- municipality
  department      TEXT,
  -- community
  manager         TEXT,
  target_audience TEXT,
  -- event_producer
  event_types     TEXT,
  -- private_student
  age             TEXT,
  parent_name     TEXT,
  program         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Deals ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT    NOT NULL DEFAULT '',
  contact_id  UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  value       NUMERIC NOT NULL DEFAULT 0,
  stage       TEXT    NOT NULL DEFAULT 'lead',
  program     TEXT,
  close_date  DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tasks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT    NOT NULL DEFAULT '',
  contact_id  UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  priority    TEXT    NOT NULL DEFAULT 'medium',
  due_date    DATE,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Instructors ───────────────────────────────────
CREATE TABLE IF NOT EXISTS instructors (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL DEFAULT '',
  phone       TEXT,
  email       TEXT,
  programs    JSONB   NOT NULL DEFAULT '[]',
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  sessions    JSONB   NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Students ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT    NOT NULL DEFAULT '',
  contact_id     UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  program        TEXT,
  payment_status TEXT    NOT NULL DEFAULT 'pending',
  attendance     JSONB   NOT NULL DEFAULT '[]',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────
-- Allow any authenticated user full access (single-user CRM)
ALTER TABLE contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts"    ON contacts    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals"       ON deals       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_tasks"       ON tasks       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_instructors" ON instructors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_students"    ON students    FOR ALL TO authenticated USING (true) WITH CHECK (true);
