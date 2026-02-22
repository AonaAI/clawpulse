-- Notifications table for ClawPulse v3.4
-- This table stores persistent notifications for users.
-- The UI currently uses React state + localStorage as primary storage,
-- with this table available for future server-side notification persistence.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('agent_status', 'deploy', 'task', 'session', 'error', 'system')),
  title text NOT NULL,
  description text,
  link text,
  read boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users update own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, read) WHERE read = false;
