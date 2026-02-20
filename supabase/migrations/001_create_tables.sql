-- ClawPulse Database Schema

-- agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  workspace TEXT NOT NULL,
  slack_channels TEXT[] DEFAULT '{}',
  spawn_permissions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'offline',
  last_activity TIMESTAMPTZ,
  current_task TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  project TEXT NOT NULL,
  assigned_agent TEXT REFERENCES agents(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge table
CREATE TABLE IF NOT EXISTS knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lesson', 'skill', 'document', 'protocol')),
  tags TEXT[] DEFAULT '{}',
  source_agent TEXT REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cron_jobs table
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  payload JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_id ON activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_source_agent ON knowledge(source_agent);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_agent_id ON cron_jobs(agent_id);

-- Enable Row Level Security (RLS)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - adjust based on auth requirements)
CREATE POLICY "Enable read access for all users" ON agents FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON tasks FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON knowledge FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON activity_log FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON cron_jobs FOR SELECT USING (true);
