-- ══════════════════════════════════════════════════════════════════
-- WIN CRM — Phase 0 Migration
-- Run in Supabase SQL editor AFTER the existing schema.sql
-- Uses CREATE TABLE IF NOT EXISTS — safe to re-run
-- ══════════════════════════════════════════════════════════════════

-- ── accounts ──────────────────────────────────────────────────────
-- B2B organizations (future normalized replacement for contacts-as-orgs)
CREATE TABLE IF NOT EXISTS accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL DEFAULT '',
  type            TEXT        NOT NULL DEFAULT 'school',
  -- school | municipality | community | event_producer | aluma
  phone           TEXT,
  email           TEXT,
  city            TEXT,
  status          TEXT        NOT NULL DEFAULT 'lead',
  -- lead | prospect | customer | inactive
  contact_person  TEXT,
  principal       TEXT,           -- school
  student_count   INTEGER,        -- school / aluma
  department      TEXT,           -- municipality
  manager         TEXT,           -- community
  target_audience TEXT,           -- community
  event_types     TEXT,           -- event_producer
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS accounts_status_idx ON accounts(status);
CREATE INDEX IF NOT EXISTS accounts_type_idx   ON accounts(type);

-- ── employees ─────────────────────────────────────────────────────
-- Normalized replacement for instructors table.
-- instructors table stays alive as a bridge during Phase 0.
-- Data migration from instructors → employees happens in Phase 1.
CREATE TABLE IF NOT EXISTS employees (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL DEFAULT '',
  phone           TEXT,
  email           TEXT,
  role            TEXT        NOT NULL DEFAULT 'instructor',
  -- instructor | admin | coordinator
  programs        TEXT[]      NOT NULL DEFAULT '{}',
  hourly_rate     NUMERIC     NOT NULL DEFAULT 0,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employees_role_idx ON employees(role);

-- ── activities ────────────────────────────────────────────────────
-- Normalized replacement for contacts.activities JSONB array.
-- The JSONB column stays alive in Phase 0; this table is populated in Phase 1.
CREATE TABLE IF NOT EXISTS activities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL DEFAULT 'note',
  -- note | call | meeting | task | deal_change
  description TEXT        NOT NULL DEFAULT '',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_contact_id_idx ON activities(contact_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at DESC);

-- ── activity_schedules ────────────────────────────────────────────
-- Recurring program schedules (e.g. WIN ENGLISH every Monday 14:00 at school X)
CREATE TABLE IF NOT EXISTS activity_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id  UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  program     TEXT        NOT NULL DEFAULT '',
  day_of_week SMALLINT,           -- 0=Sun, 6=Sat (NULL = one-off)
  start_time  TIME,
  end_time    TIME,
  location    TEXT,
  notes       TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_schedules_program_idx ON activity_schedules(program);
CREATE INDEX IF NOT EXISTS activity_schedules_active_idx  ON activity_schedules(active);

-- ── activity_participants ─────────────────────────────────────────
-- Junction: which students are enrolled in which schedule
CREATE TABLE IF NOT EXISTS activity_participants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID        NOT NULL REFERENCES activity_schedules(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unenrolled_at TIMESTAMPTZ,
  UNIQUE (schedule_id, student_id)
);
CREATE INDEX IF NOT EXISTS activity_participants_schedule_id_idx ON activity_participants(schedule_id);
CREATE INDEX IF NOT EXISTS activity_participants_student_id_idx  ON activity_participants(student_id);

-- ── sessions ──────────────────────────────────────────────────────
-- Replaces instructors.sessions JSONB array.
-- instructor_id bridges to existing instructors table during Phase 0.
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID        REFERENCES employees(id) ON DELETE SET NULL,
  instructor_id   UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  schedule_id     UUID        REFERENCES activity_schedules(id) ON DELETE SET NULL,
  contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  program         TEXT        NOT NULL DEFAULT '',
  session_date    DATE        NOT NULL,
  hours           NUMERIC     NOT NULL DEFAULT 0 CHECK (hours > 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_employee_id_idx   ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS sessions_instructor_id_idx ON sessions(instructor_id);
CREATE INDEX IF NOT EXISTS sessions_session_date_idx  ON sessions(session_date DESC);

-- ── attendance ────────────────────────────────────────────────────
-- Replaces students.attendance JSONB array.
-- The JSONB column stays alive in Phase 0; this table is populated in Phase 1.
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        REFERENCES sessions(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  present     BOOLEAN     NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx ON attendance(student_id);
CREATE INDEX IF NOT EXISTS attendance_session_id_idx ON attendance(session_id);

-- ── payments ──────────────────────────────────────────────────────
-- All payment records across all business arms
CREATE TABLE IF NOT EXISTS payments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id     UUID        REFERENCES deals(id) ON DELETE SET NULL,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  currency    TEXT        NOT NULL DEFAULT 'ILS',
  status      TEXT        NOT NULL DEFAULT 'pending',
  -- pending | paid | overdue | refunded
  due_date    DATE,
  paid_at     TIMESTAMPTZ,
  method      TEXT,
  -- bank_transfer | check | cash | credit
  reference   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_contact_id_idx ON payments(contact_id);
CREATE INDEX IF NOT EXISTS payments_deal_id_idx    ON payments(deal_id);
CREATE INDEX IF NOT EXISTS payments_status_idx     ON payments(status);
CREATE INDEX IF NOT EXISTS payments_due_date_idx   ON payments(due_date);

-- ── payroll_runs ──────────────────────────────────────────────────
-- Monthly payroll batches
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft',
  -- draft | approved | paid
  total_amount    NUMERIC     NOT NULL DEFAULT 0,
  approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payroll_runs_status_idx ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS payroll_runs_period_idx ON payroll_runs(period_start DESC);

-- ── payroll_lines ─────────────────────────────────────────────────
-- One line per employee per payroll_run
-- gross_amount is a generated column (hours × hourly_rate)
CREATE TABLE IF NOT EXISTS payroll_lines (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id  UUID        NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     UUID        REFERENCES employees(id) ON DELETE SET NULL,
  instructor_id   UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  hours           NUMERIC     NOT NULL DEFAULT 0,
  hourly_rate     NUMERIC     NOT NULL DEFAULT 0,
  gross_amount    NUMERIC     GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payroll_lines_run_id_idx      ON payroll_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS payroll_lines_employee_id_idx ON payroll_lines(employee_id);

-- ── alerts ────────────────────────────────────────────────────────
-- Persistent alert log (currently computed in-memory in the UI)
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL,
  -- overdue_task | no_session | at_risk_student | stuck_deal
  entity_id   UUID        NOT NULL,
  entity_type TEXT        NOT NULL,
  -- task | instructor | student | deal
  resolved    BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS alerts_resolved_idx    ON alerts(resolved);
CREATE INDEX IF NOT EXISTS alerts_entity_type_idx ON alerts(entity_type);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx  ON alerts(created_at DESC);

-- ── calendar_links ────────────────────────────────────────────────
-- Google Calendar / iCal links per contact or schedule
CREATE TABLE IF NOT EXISTS calendar_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  schedule_id UUID        REFERENCES activity_schedules(id) ON DELETE CASCADE,
  provider    TEXT        NOT NULL DEFAULT 'google',
  -- google | ical | outlook
  url         TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS calendar_links_contact_id_idx ON calendar_links(contact_id);

-- ── calendar_event_map ────────────────────────────────────────────
-- Maps an internal session to an external calendar event ID
CREATE TABLE IF NOT EXISTS calendar_event_map (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  calendar_link_id  UUID        NOT NULL REFERENCES calendar_links(id) ON DELETE CASCADE,
  external_event_id TEXT        NOT NULL,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, calendar_link_id)
);

-- ── threads (scaffold) ────────────────────────────────────────────
-- Future: conversation threads per contact (WhatsApp/email)
CREATE TABLE IF NOT EXISTS threads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID        REFERENCES contacts(id) ON DELETE CASCADE,
  channel     TEXT        NOT NULL DEFAULT 'whatsapp',
  -- whatsapp | email | sms
  external_id TEXT,
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS threads_contact_id_idx ON threads(contact_id);

-- ── messages (scaffold) ───────────────────────────────────────────
-- Future: individual messages within a thread
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID        NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  direction   TEXT        NOT NULL DEFAULT 'outbound',
  -- inbound | outbound
  body        TEXT        NOT NULL DEFAULT '',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered   BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata    JSONB       NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id);
CREATE INDEX IF NOT EXISTS messages_sent_at_idx   ON messages(sent_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- RLS — same open policy as existing tables (single-team CRM)
-- user_id columns exist as scaffold for future per-user filtering
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_schedules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_map   ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_accounts"              ON accounts              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_employees"             ON employees             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_activities"            ON activities            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_activity_schedules"    ON activity_schedules    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_activity_participants" ON activity_participants  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_sessions"              ON sessions              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_attendance"            ON attendance            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_payments"              ON payments              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_payroll_runs"          ON payroll_runs          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_payroll_lines"         ON payroll_lines         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_alerts"               ON alerts                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_calendar_links"        ON calendar_links        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_calendar_event_map"    ON calendar_event_map    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_threads"              ON threads               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_messages"             ON messages              FOR ALL TO authenticated USING (true) WITH CHECK (true);
