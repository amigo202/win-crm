-- Workflow automation rules
CREATE TABLE IF NOT EXISTS workflow_rules (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name         TEXT NOT NULL,
  description  TEXT,
  trigger_type TEXT NOT NULL,
  conditions   JSONB DEFAULT '[]',
  actions      JSONB DEFAULT '[]',
  enabled      BOOLEAN DEFAULT true,
  run_count    INTEGER DEFAULT 0,
  last_run_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_rules' AND policyname = 'workflow_rules_owner') THEN
    CREATE POLICY "workflow_rules_owner" ON workflow_rules
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_rules_owner ON workflow_rules(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger ON workflow_rules(trigger_type);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id      UUID REFERENCES workflow_rules(id) ON DELETE CASCADE,
  trigger_type TEXT,
  trigger_data JSONB,
  actions_run  JSONB,
  status       TEXT DEFAULT 'success',
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_logs' AND policyname = 'workflow_logs_owner') THEN
    CREATE POLICY "workflow_logs_owner" ON workflow_logs
      USING (EXISTS (
        SELECT 1 FROM workflow_rules wr WHERE wr.id = workflow_logs.rule_id AND wr.owner_id = auth.uid()
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_logs_rule ON workflow_logs(rule_id);
