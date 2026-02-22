-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  mission text,
  vision text,
  color text DEFAULT '#6412A6',
  icon text DEFAULT '🚀',
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_agents join table
CREATE TABLE IF NOT EXISTS project_agents (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  agent_id text REFERENCES agents(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  PRIMARY KEY (project_id, agent_id)
);

-- Add project_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_agents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'allow_all_select') THEN
    CREATE POLICY allow_all_select ON projects FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'allow_all_modify') THEN
    CREATE POLICY allow_all_modify ON projects FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_agents' AND policyname = 'allow_all_select') THEN
    CREATE POLICY allow_all_select ON project_agents FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_agents' AND policyname = 'allow_all_modify') THEN
    CREATE POLICY allow_all_modify ON project_agents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed projects
INSERT INTO projects (slug, name, description, mission, vision, color, icon) VALUES
  ('clawpulse', 'ClawPulse', 'Agent operations dashboard — monitor, manage, and coordinate the AI agent network', 'Build the best operations platform for AI agent teams, enabling full visibility and control over autonomous workflows.', 'A world where human-AI teams operate with seamless coordination, transparency, and efficiency.', '#7c3aed', '⚡'),
  ('aona-platform', 'Aona Platform', 'The main product — AI-powered platform for next-generation workflows', 'Empower individuals and teams to accomplish more with AI, removing friction from complex tasks and decisions.', 'Become the operating layer for the AI-augmented workforce of tomorrow.', '#0891b2', '🌐'),
  ('ai-security-benchmark', 'AI Security Benchmark', 'Research initiative to benchmark AI system security and risk postures', 'Produce rigorous, independent benchmarks for AI security that the industry can rely on.', 'Define the standard for AI safety evaluation globally.', '#059669', '🔬'),
  ('sales-bdm', 'Sales & BDM', 'Business development and sales pipeline management', 'Build a repeatable, scalable sales motion that connects Aona with the right early customers.', 'Become the top AI-native sales team in our category.', '#d97706', '💼')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  mission = EXCLUDED.mission,
  vision = EXCLUDED.vision,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  updated_at = now();

-- Seed project_agents
INSERT INTO project_agents (project_id, agent_id)
SELECT p.id, a.agent_id
FROM projects p
CROSS JOIN (VALUES
  ('clawpulse', 'pulse'),
  ('clawpulse', 'dev'),
  ('aona-platform', 'main'),
  ('aona-platform', 'dev'),
  ('aona-platform', 'pm'),
  ('aona-platform', 'design'),
  ('aona-platform', 'seo'),
  ('aona-platform', 'growth'),
  ('ai-security-benchmark', 'research'),
  ('sales-bdm', 'sales')
) AS a(slug, agent_id)
WHERE p.slug = a.slug
ON CONFLICT (project_id, agent_id) DO NOTHING;
