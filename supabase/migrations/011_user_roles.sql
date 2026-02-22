-- Create user_roles table for role-based access control
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer', 'editor')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin write" ON user_roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert admin role for the existing admin user (pulse@clawpulse.ai)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'pulse@clawpulse.ai'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
