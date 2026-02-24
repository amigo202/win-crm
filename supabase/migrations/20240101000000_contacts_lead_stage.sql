-- Add leads-pipeline columns to contacts
-- Safe to run multiple times (IF NOT EXISTS / IF NULL)

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_stage       TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS at_risk          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE contacts
  SET last_activity_at = created_at
  WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage
  ON contacts(lead_stage) WHERE lead_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_at_risk
  ON contacts(at_risk) WHERE at_risk = true;
