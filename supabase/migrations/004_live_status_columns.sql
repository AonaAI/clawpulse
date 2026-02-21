-- Migration 004: Add live status columns to agents table
-- These are populated by the push-agent-status.ts script running on the host machine

ALTER TABLE agents ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Allow upsert of agents (for the pusher script via service role — RLS is bypassed,
-- but add anon update policy too so the dashboard can read fresh values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agents' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON agents FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agents' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON agents FOR INSERT WITH CHECK (true);
  END IF;
END $$;
