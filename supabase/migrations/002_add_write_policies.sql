-- Migration 002: Add write policies for demo (no-auth) use
-- Run this in the Supabase SQL editor or via: supabase db push

DO $$
BEGIN
  -- tasks: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON tasks FOR INSERT WITH CHECK (true);
  END IF;

  -- tasks: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON tasks FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  -- tasks: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON tasks FOR DELETE USING (true);
  END IF;
END $$;
