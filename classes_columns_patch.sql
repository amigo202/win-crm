-- ══════════════════════════════════════════════════════════════
-- WIN CRM — Classes Table: Add spreadsheet columns
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

ALTER TABLE classes ADD COLUMN IF NOT EXISTS coordinator      TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS overhead_pct     NUMERIC DEFAULT 70;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS monthly_hours    SMALLINT DEFAULT 4;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS instructor_total_override NUMERIC DEFAULT NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS linked_payment_id UUID;
