-- Migration 005: agent_sessions table
-- Stores session-level data pushed from OpenClaw sessions.json files

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'session',
  status TEXT NOT NULL DEFAULT 'completed',
  started_at TIMESTAMPTZ,
  last_active TIMESTAMPTZ,
  model TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_active ON agent_sessions(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON agent_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON agent_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON agent_sessions FOR UPDATE USING (true);
