import pg from './node_modules/pg/lib/index.js'
const { Client } = pg

const configs = [
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, database: 'postgres', user: 'postgres.naxbzqsecohogbkbhgti', password: 'FZN48IAYTaFh1fmk', ssl: { rejectUnauthorized: false } },
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, database: 'postgres', user: 'postgres.naxbzqsecohogbkbhgti', password: 'FZN48IAYTaFh1fmk', ssl: { rejectUnauthorized: false } },
  { host: 'db.naxbzqsecohogbkbhgti.supabase.co', port: 5432, database: 'postgres', user: 'postgres', password: 'FZN48IAYTaFh1fmk', ssl: { rejectUnauthorized: false } },
]

let client = null

for (const config of configs) {
  const c = new Client(config)
  try {
    console.log(`Trying ${config.host}:${config.port} as ${config.user}...`)
    await c.connect()
    console.log('Connected!')
    client = c
    break
  } catch (err) {
    console.log(`Failed: ${err.message}`)
    try { await c.end() } catch {}
  }
}

if (!client) {
  console.error('Could not connect to database. Tables were not created.')
  process.exit(1)
}

console.log('\n=== Creating tables ===')

await client.query(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    model TEXT NOT NULL,
    workspace TEXT,
    slack_channels TEXT[] DEFAULT '{}',
    spawn_permissions TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'waiting')),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    current_task TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
console.log('✓ agents table')

await client.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    project TEXT,
    assigned_agent TEXT REFERENCES agents(id),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
console.log('✓ tasks table')

await client.query(`
  CREATE TABLE IF NOT EXISTS knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT 'lesson' CHECK (category IN ('lesson', 'skill', 'document', 'protocol')),
    tags TEXT[] DEFAULT '{}',
    source_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
console.log('✓ knowledge table')

await client.query(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT REFERENCES agents(id),
    action TEXT NOT NULL,
    details TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)
console.log('✓ activity_log table')

await client.query(`
  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT,
    agent_id TEXT,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    payload JSONB DEFAULT '{}'
  )
`)
console.log('✓ cron_jobs table')

// Disable RLS for MVP (allow anon key reads)
for (const table of ['agents', 'tasks', 'knowledge', 'activity_log', 'cron_jobs']) {
  try {
    await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`)
  } catch {}
}
console.log('✓ RLS disabled for all tables')

console.log('\n=== Seeding agents ===')

const agents = [
  { id: 'main', name: 'Aloa', role: 'Orchestrator & Personal Assistant', model: 'Opus', workspace: '~/.openclaw/workspace', slack_channels: ['{#aloa-setup,#aloa-random,#aloa-ai-empowerment,#openclaw-work}'], spawn_permissions: ['{dev,pm,seo,design,research,growth,sales,pulse}'], status: 'working', current_task: 'Coordinating MVP dashboard build' },
  { id: 'dev', name: 'Dev', role: 'Developer', model: 'Sonnet', workspace: '~/.openclaw/workspace-dev', slack_channels: ['{#aloa-code,#aloa-aona-website}'], spawn_permissions: ['{}'], status: 'working', current_task: 'Building ClawPulse MVP dashboard' },
  { id: 'pm', name: 'PM', role: 'Project Manager', model: 'GPT', workspace: '~/.openclaw/workspace-pm', slack_channels: ['{#alona-projects-updates,#aloa-presos}'], spawn_permissions: ['{}'], status: 'idle', current_task: null },
  { id: 'seo', name: 'SEO', role: 'SEO & Content', model: 'Sonnet', workspace: '~/.openclaw/workspace-seo', slack_channels: ['{#aloa-seo}'], spawn_permissions: ['{}'], status: 'working', current_task: 'Building Q1 content calendar' },
  { id: 'design', name: 'Design', role: 'Design & Brand', model: 'GPT', workspace: '~/.openclaw/workspace-design', slack_channels: ['{#aloa-design}'], spawn_permissions: ['{}'], status: 'waiting', current_task: 'Awaiting brand assets review' },
  { id: 'research', name: 'Research', role: 'Competitive Intel', model: 'Sonnet', workspace: '~/.openclaw/workspace-research', slack_channels: ['{#aloa-aisecuritybenchmark,#aloa-interns-rd}'], spawn_permissions: ['{}'], status: 'working', current_task: 'Competitive analysis of AI agent market' },
  { id: 'growth', name: 'Growth', role: 'Marketing & Outreach', model: 'GPT', workspace: '~/.openclaw/workspace-growth', slack_channels: ['{#aloa-b2c,#aloa-wander,#aloa-wanderbuddies}'], spawn_permissions: ['{}'], status: 'idle', current_task: null },
  { id: 'sales', name: 'Aaron', role: 'Sales Development', model: 'Sonnet', workspace: '~/.openclaw/workspace-sales', slack_channels: ['{#aloa-sales-bdm}'], spawn_permissions: ['{}'], status: 'idle', current_task: null },
  { id: 'pulse', name: 'Pulse', role: 'ClawPulse PO', model: 'Sonnet', workspace: '~/.openclaw/workspace-pulse', slack_channels: ['{#clawpulse-dev}'], spawn_permissions: ['{dev}'], status: 'working', current_task: 'Defining ClawPulse product roadmap' },
]

for (const agent of agents) {
  const slackArr = agent.slack_channels[0].replace(/[{}]/g, '').split(',').filter(Boolean)
  const spawnArr = agent.spawn_permissions[0].replace(/[{}]/g, '').split(',').filter(Boolean)
  await client.query(`
    INSERT INTO agents (id, name, role, model, workspace, slack_channels, spawn_permissions, status, last_activity, current_task)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - (random() * interval '2 hours'), $9)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, role = EXCLUDED.role, model = EXCLUDED.model,
      workspace = EXCLUDED.workspace, slack_channels = EXCLUDED.slack_channels,
      spawn_permissions = EXCLUDED.spawn_permissions, status = EXCLUDED.status,
      last_activity = NOW() - (random() * interval '2 hours'), current_task = EXCLUDED.current_task
  `, [agent.id, agent.name, agent.role, agent.model, agent.workspace, slackArr, spawnArr, agent.status, agent.current_task])
  console.log(`  ✓ ${agent.name} (${agent.id})`)
}

console.log('\n=== Seeding sample tasks ===')

const tasks = [
  { title: 'Build mobile app MVP', description: 'Design and build the initial mobile app prototype with core user flows', status: 'todo', priority: 'high', project: 'Mobile App', assigned_agent: 'dev', created_by: 'main' },
  { title: 'Q1 SEO Audit', description: 'Comprehensive SEO audit of main website and identify content gaps', status: 'todo', priority: 'medium', project: 'SEO', assigned_agent: 'seo', created_by: 'pm' },
  { title: 'Investor pitch deck', description: 'Create compelling pitch deck for Series A discussions', status: 'todo', priority: 'critical', project: 'Growth', assigned_agent: 'growth', created_by: 'main' },
  { title: 'Sales pipeline setup', description: 'Define ICP, outreach sequences, and CRM configuration', status: 'todo', priority: 'high', project: 'Sales', assigned_agent: 'sales', created_by: 'main' },
  { title: 'ClawPulse MVP Dashboard', description: 'Build the full ClawPulse operations dashboard with overview, agents, and tasks pages', status: 'in_progress', priority: 'critical', project: 'ClawPulse', assigned_agent: 'dev', created_by: 'pulse' },
  { title: 'Q1 Content Calendar', description: 'Plan and schedule content across all channels for Q1 2025', status: 'in_progress', priority: 'medium', project: 'SEO', assigned_agent: 'seo', created_by: 'pm' },
  { title: 'Competitive analysis report', description: 'Research top 10 AI agent competitors and produce insights report', status: 'in_progress', priority: 'high', project: 'Research', assigned_agent: 'research', created_by: 'main' },
  { title: 'Brand identity kit v2', description: 'Updated brand guidelines, colors, typography, and component library', status: 'done', priority: 'high', project: 'Design', assigned_agent: 'design', created_by: 'main' },
  { title: 'Initial research report', description: 'First competitive intelligence report on AI agent market landscape', status: 'done', priority: 'medium', project: 'Research', assigned_agent: 'research', created_by: 'research' },
  { title: 'Onboarding flow design', description: 'User onboarding flow mockups and prototypes for new platform', status: 'done', priority: 'medium', project: 'Design', assigned_agent: 'design', created_by: 'pm' },
  { title: 'OpenClaw integration guide', description: 'Internal documentation for OpenClaw agent setup and configuration', status: 'done', priority: 'low', project: 'ClawPulse', assigned_agent: 'pulse', created_by: 'main' },
  { title: 'Sales pipeline CRM integration', description: 'Connect sales pipeline to CRM system for automated tracking and reporting', status: 'blocked', priority: 'high', project: 'Sales', assigned_agent: 'sales', created_by: 'main' },
  { title: 'API access for growth tools', description: 'Awaiting API credentials from marketing automation platform', status: 'blocked', priority: 'medium', project: 'Growth', assigned_agent: 'growth', created_by: 'growth' },
]

for (const task of tasks) {
  await client.query(`
    INSERT INTO tasks (title, description, status, priority, project, assigned_agent, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [task.title, task.description, task.status, task.priority, task.project, task.assigned_agent, task.created_by])
  console.log(`  ✓ "${task.title}"`)
}

console.log('\n=== Seeding activity logs ===')

const activities = [
  { agent_id: 'dev', action: 'task_started', details: 'Started building ClawPulse MVP dashboard' },
  { agent_id: 'main', action: 'agent_spawned', details: 'Spawned Dev agent for dashboard build task' },
  { agent_id: 'pulse', action: 'task_created', details: 'Created MVP dashboard task and assigned to Dev' },
  { agent_id: 'research', action: 'report_completed', details: 'Completed initial competitive intelligence report on AI agent market' },
  { agent_id: 'design', action: 'deliverable_submitted', details: 'Brand identity kit v2 submitted for review — includes new color palette and typography' },
  { agent_id: 'seo', action: 'task_started', details: 'Started Q1 content calendar planning with 12-week schedule' },
  { agent_id: 'pm', action: 'task_assigned', details: 'Assigned investor pitch deck to Growth agent with critical priority' },
  { agent_id: 'sales', action: 'status_blocked', details: 'Sales pipeline integration blocked — awaiting CRM API access from IT' },
  { agent_id: 'main', action: 'system_event', details: 'Morning standup complete — 4 agents active, 2 blocked tasks flagged' },
  { agent_id: 'research', action: 'task_started', details: 'Began competitive analysis of top 10 AI agent frameworks' },
  { agent_id: 'growth', action: 'status_blocked', details: 'Marketing automation API credentials pending from vendor' },
  { agent_id: 'pulse', action: 'roadmap_updated', details: 'ClawPulse roadmap updated — Knowledge Base feature added to Q2 backlog' },
]

for (const activity of activities) {
  await client.query(`
    INSERT INTO activity_log (agent_id, action, details, metadata, created_at)
    VALUES ($1, $2, $3, '{}', NOW() - (random() * interval '4 hours'))
  `, [activity.agent_id, activity.action, activity.details])
  console.log(`  ✓ [${activity.agent_id}] ${activity.action}`)
}

await client.end()
console.log('\n✅ Database setup complete!')
