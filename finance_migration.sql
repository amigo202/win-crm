-- ════════════════════════════════════════════════════════════════════
-- WIN CRM — Finance Tables Migration (payments + salaries)
-- Run this script ONCE in the Supabase SQL Editor → paste all → Run
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS / OR REPLACE
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Helper functions (no-op if already created by migration_complete.sql) ─

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Payments table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID        REFERENCES contacts(id)    ON DELETE SET NULL,
  instructor_id UUID        REFERENCES instructors(id) ON DELETE SET NULL,
  amount        NUMERIC     NOT NULL DEFAULT 0,
  month         SMALLINT    NOT NULL,
  year          SMALLINT    NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  program       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id      UUID        REFERENCES auth.users(id)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop before re-create so the script is idempotent
DROP POLICY IF EXISTS "payments_owner" ON payments;
CREATE POLICY "payments_owner" ON payments
  FOR ALL TO authenticated
  USING  (owner_id = auth.uid())
  -- WITH CHECK allows INSERT when owner_id is still NULL (trigger sets it next)
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

-- Backfill owner_id for any existing rows
DO $$
DECLARE first_uid uuid;
BEGIN
  SELECT id INTO first_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_uid IS NOT NULL THEN
    UPDATE payments SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_owner      ON payments;
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;

CREATE TRIGGER trg_payments_owner
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION set_owner_id();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Salaries table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS salaries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id      UUID        REFERENCES instructors(id) ON DELETE CASCADE,
  month              SMALLINT    NOT NULL,
  year               SMALLINT    NOT NULL,
  base_salary        NUMERIC     NOT NULL DEFAULT 0,
  additions          NUMERIC     NOT NULL DEFAULT 0,
  deductions         NUMERIC     NOT NULL DEFAULT 0,
  tax                NUMERIC     NOT NULL DEFAULT 0,
  national_insurance NUMERIC     NOT NULL DEFAULT 0,
  health_insurance   NUMERIC     NOT NULL DEFAULT 0,
  net_salary         NUMERIC GENERATED ALWAYS AS
    (base_salary + additions - deductions - tax - national_insurance - health_insurance) STORED,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id           UUID        REFERENCES auth.users(id),
  UNIQUE (instructor_id, month, year)
);

ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salaries_owner" ON salaries;
CREATE POLICY "salaries_owner" ON salaries
  FOR ALL TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

-- Backfill owner_id for any existing rows
DO $$
DECLARE first_uid uuid;
BEGIN
  SELECT id INTO first_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_uid IS NOT NULL THEN
    UPDATE salaries SET owner_id = first_uid WHERE owner_id IS NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_salaries_owner      ON salaries;
DROP TRIGGER IF EXISTS trg_salaries_updated_at ON salaries;

CREATE TRIGGER trg_salaries_owner
  BEFORE INSERT ON salaries
  FOR EACH ROW EXECUTE FUNCTION set_owner_id();

CREATE TRIGGER trg_salaries_updated_at
  BEFORE UPDATE ON salaries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
