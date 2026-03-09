-- ══════════════════════════════════════════════════════════════════════
-- Students table — add missing columns for enhanced student management
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name  TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade        TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_name  TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name   TEXT;
