-- Company settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Aona AI',
  mission text,
  vision text,
  goals jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Insert default company
INSERT INTO company_settings (id, name, mission, vision) VALUES ('default', 'Aona AI', NULL, NULL) ON CONFLICT DO NOTHING;

-- Add inherit_company_mission and goals to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS inherit_company_mission boolean DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '[]'::jsonb;

-- Add KPIs to project_agents
ALTER TABLE project_agents ADD COLUMN IF NOT EXISTS kpis jsonb DEFAULT '[]'::jsonb;

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update" ON company_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow anon read" ON company_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update" ON company_settings FOR UPDATE TO anon USING (true);
