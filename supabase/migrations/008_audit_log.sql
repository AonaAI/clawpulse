-- Audit log table for tracking all mutations
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,           -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL,      -- 'task', 'agent', 'knowledge', 'setting', etc.
  entity_id TEXT NOT NULL,
  changes JSONB DEFAULT '{}',     -- before/after diff or summary
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
