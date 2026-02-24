-- Migration 014: Add metadata column to agent_sessions
-- This stores conversation logs and other session-specific data

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_sessions_metadata ON agent_sessions USING GIN (metadata);
