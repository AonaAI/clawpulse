/**
 * Migration 013: Mission/Vision/Goals Hierarchy
 * Run: node migrate_013_mission_hierarchy.mjs
 */

import pg from './node_modules/pg/lib/index.js'
const { Client } = pg

const dbPassword = process.env.SUPABASE_DB_PASSWORD
const dbRef = process.env.SUPABASE_PROJECT_REF
if (!dbPassword || !dbRef) {
  console.error('Set SUPABASE_DB_PASSWORD and SUPABASE_PROJECT_REF env vars')
  process.exit(1)
}
const configs = [
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, database: 'postgres', user: `postgres.${dbRef}`, password: dbPassword, ssl: { rejectUnauthorized: false } },
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, database: 'postgres', user: `postgres.${dbRef}`, password: dbPassword, ssl: { rejectUnauthorized: false } },
  { host: `db.${dbRef}.supabase.co`, port: 5432, database: 'postgres', user: 'postgres', password: dbPassword, ssl: { rejectUnauthorized: false } },
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
  console.error('\nCould not connect to database.')
  console.error('Please apply supabase/migrations/013_mission_hierarchy.sql manually via:')
  console.error(`https://supabase.com/dashboard/project/${dbRef}/sql/new`)
  process.exit(1)
}

console.log('\n=== Applying migration 013: Mission Hierarchy ===')

// Create company_settings table
await client.query(`
  CREATE TABLE IF NOT EXISTS company_settings (
    id text PRIMARY KEY DEFAULT 'default',
    name text NOT NULL DEFAULT 'Aona AI',
    mission text,
    vision text,
    goals jsonb DEFAULT '[]'::jsonb,
    updated_at timestamptz DEFAULT now()
  )
`)
console.log('✓ company_settings table')

// Insert default row
await client.query(`
  INSERT INTO company_settings (id, name, mission, vision)
  VALUES ('default', 'Aona AI', NULL, NULL)
  ON CONFLICT DO NOTHING
`)
console.log('✓ company_settings default row')

// Add columns to projects
await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS inherit_company_mission boolean DEFAULT true`)
await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '[]'::jsonb`)
console.log('✓ projects.inherit_company_mission and goals columns')

// Add kpis to project_agents
await client.query(`ALTER TABLE project_agents ADD COLUMN IF NOT EXISTS kpis jsonb DEFAULT '[]'::jsonb`)
console.log('✓ project_agents.kpis column')

// Enable RLS on company_settings
await client.query(`ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY`)

// Create policies (safe to re-run)
const policies = [
  { name: 'Allow authenticated read', table: 'company_settings', op: 'FOR SELECT TO authenticated', check: 'USING (true)' },
  { name: 'Allow authenticated update', table: 'company_settings', op: 'FOR UPDATE TO authenticated', check: 'USING (true)' },
  { name: 'Allow anon read', table: 'company_settings', op: 'FOR SELECT TO anon', check: 'USING (true)' },
  { name: 'Allow anon update', table: 'company_settings', op: 'FOR UPDATE TO anon', check: 'USING (true)' },
]

for (const policy of policies) {
  try {
    await client.query(`CREATE POLICY "${policy.name}" ON ${policy.table} ${policy.op} ${policy.check}`)
    console.log(`✓ Policy: ${policy.name}`)
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log(`  (already exists) Policy: ${policy.name}`)
    } else {
      console.warn(`  Warning creating policy "${policy.name}":`, e.message)
    }
  }
}

console.log('\n=== Seeding company settings ===')

await client.query(`
  UPDATE company_settings SET
    mission = $1,
    vision = $2,
    goals = $3::jsonb,
    updated_at = now()
  WHERE id = 'default'
`, [
  'Making AI agents work together seamlessly to amplify human potential',
  'A world where AI teams handle operational complexity so humans can focus on what matters',
  JSON.stringify([
    'Launch ClawPulse v5 by end of Feb',
    '10 enterprise pilots by Q2 2026',
    'Open-source agent coordination protocol by Q3 2026',
  ]),
])
console.log('✓ Company mission, vision, goals')

console.log('\n=== Seeding project inherit flags ===')

// Set inherit_company_mission=true for Aona Platform, ClawPulse, Sales & BDM
for (const slug of ['aona-platform', 'clawpulse', 'sales-bdm']) {
  await client.query(`UPDATE projects SET inherit_company_mission = true WHERE slug = $1`, [slug])
  console.log(`✓ ${slug} → inherit_company_mission = true`)
}

// Set inherit_company_mission=false for AI Security Benchmark
await client.query(`UPDATE projects SET inherit_company_mission = false WHERE slug = 'ai-security-benchmark'`)
console.log('✓ ai-security-benchmark → inherit_company_mission = false')

console.log('\n=== Seeding sample agent KPIs ===')

// Get project IDs
const { rows: projectRows } = await client.query(`SELECT id, slug FROM projects WHERE slug IN ('aona-platform', 'clawpulse')`)
const projectMap = Object.fromEntries(projectRows.map(r => [r.slug, r.id]))

const kpiSeeds = [
  {
    projectSlug: 'aona-platform',
    agentId: 'main',
    kpis: ['Tasks coordinated per week', 'Agent utilization rate > 80%', 'Response time < 5 min'],
  },
  {
    projectSlug: 'aona-platform',
    agentId: 'dev',
    kpis: ['PRs merged per sprint', 'Bug fix turnaround < 24h', 'Test coverage > 85%'],
  },
  {
    projectSlug: 'clawpulse',
    agentId: 'pulse',
    kpis: ['Features shipped per sprint', 'Dashboard uptime > 99.5%', 'User retention after 7 days'],
  },
]

for (const seed of kpiSeeds) {
  const projectId = projectMap[seed.projectSlug]
  if (!projectId) { console.log(`  Skipping ${seed.projectSlug} — not found`); continue }
  await client.query(`
    UPDATE project_agents SET kpis = $1::jsonb
    WHERE project_id = $2 AND agent_id = $3
  `, [JSON.stringify(seed.kpis), projectId, seed.agentId])
  console.log(`✓ KPIs for ${seed.agentId} in ${seed.projectSlug}`)
}

await client.end()
console.log('\n✅ Migration 013 complete!')
