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
  console.error('Could not connect to database.')
  process.exit(1)
}

console.log('\n=== Creating projects table ===')

await client.query(`
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
  )
`)
console.log('✓ projects table')

await client.query(`
  CREATE TABLE IF NOT EXISTS project_agents (
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    agent_id text REFERENCES agents(id) ON DELETE CASCADE,
    role text DEFAULT 'member',
    PRIMARY KEY (project_id, agent_id)
  )
`)
console.log('✓ project_agents table')

await client.query(`
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)
`)
console.log('✓ tasks.project_id column')

// Enable RLS with permissive select
await client.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'allow_all_select') THEN
      CREATE POLICY allow_all_select ON projects FOR SELECT USING (true);
    END IF;
  END $$
`)
await client.query(`ALTER TABLE project_agents ENABLE ROW LEVEL SECURITY`)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_agents' AND policyname = 'allow_all_select') THEN
      CREATE POLICY allow_all_select ON project_agents FOR SELECT USING (true);
    END IF;
  END $$
`)
// Also allow insert/update/delete for authenticated users
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'allow_all_modify') THEN
      CREATE POLICY allow_all_modify ON projects FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$
`)
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_agents' AND policyname = 'allow_all_modify') THEN
      CREATE POLICY allow_all_modify ON project_agents FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$
`)
console.log('✓ RLS enabled with permissive policies')

console.log('\n=== Seeding projects ===')

const projects = [
  {
    slug: 'clawpulse',
    name: 'ClawPulse',
    description: 'Agent operations dashboard — monitor, manage, and coordinate the AI agent network',
    mission: 'Build the best operations platform for AI agent teams, enabling full visibility and control over autonomous workflows.',
    vision: 'A world where human-AI teams operate with seamless coordination, transparency, and efficiency.',
    color: '#7c3aed',
    icon: '⚡',
    agents: ['pulse', 'dev'],
  },
  {
    slug: 'aona-platform',
    name: 'Aona Platform',
    description: 'The main product — AI-powered platform for next-generation workflows',
    mission: 'Empower individuals and teams to accomplish more with AI, removing friction from complex tasks and decisions.',
    vision: 'Become the operating layer for the AI-augmented workforce of tomorrow.',
    color: '#0891b2',
    icon: '🌐',
    agents: ['main', 'dev', 'pm', 'design', 'seo', 'growth'],
  },
  {
    slug: 'ai-security-benchmark',
    name: 'AI Security Benchmark',
    description: 'Research initiative to benchmark AI system security and risk postures',
    mission: 'Produce rigorous, independent benchmarks for AI security that the industry can rely on.',
    vision: 'Define the standard for AI safety evaluation globally.',
    color: '#059669',
    icon: '🔬',
    agents: ['research'],
  },
  {
    slug: 'sales-bdm',
    name: 'Sales & BDM',
    description: 'Business development and sales pipeline management',
    mission: 'Build a repeatable, scalable sales motion that connects Aona with the right early customers.',
    vision: 'Become the top AI-native sales team in our category.',
    color: '#d97706',
    icon: '💼',
    agents: ['sales'],
  },
]

for (const project of projects) {
  const { agents, ...projectData } = project

  // Upsert project
  const result = await client.query(`
    INSERT INTO projects (slug, name, description, mission, vision, color, icon)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      mission = EXCLUDED.mission,
      vision = EXCLUDED.vision,
      color = EXCLUDED.color,
      icon = EXCLUDED.icon,
      updated_at = now()
    RETURNING id
  `, [projectData.slug, projectData.name, projectData.description, projectData.mission, projectData.vision, projectData.color, projectData.icon])

  const projectId = result.rows[0].id
  console.log(`  ✓ ${projectData.name} (${projectId})`)

  // Upsert project_agents
  for (const agentId of agents) {
    await client.query(`
      INSERT INTO project_agents (project_id, agent_id)
      VALUES ($1, $2)
      ON CONFLICT (project_id, agent_id) DO NOTHING
    `, [projectId, agentId])
    console.log(`    → ${agentId}`)
  }
}

await client.end()
console.log('\n✅ Projects migration complete!')
