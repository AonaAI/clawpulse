#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load env vars
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('   Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function seedAgents() {
  console.log('👥 Seeding agents...')
  
  const agents = [
    {
      id: 'main',
      name: 'Aloa',
      role: 'Orchestrator',
      model: 'Claude Opus',
      workspace: '~/.openclaw/workspace',
      slack_channels: ['#aloa-setup', '#aloa-random', '#aloa-ai-empowerment', '#openclaw-work'],
      spawn_permissions: ['dev', 'pm', 'seo', 'design', 'research', 'growth', 'sales', 'pulse'],
      status: 'idle',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'dev',
      name: 'Dev',
      role: 'Developer',
      model: 'Claude Sonnet',
      workspace: '~/.openclaw/workspace-dev',
      slack_channels: ['#aloa-code', '#aloa-aona-website'],
      spawn_permissions: [],
      status: 'working',
      current_task: 'Building ClawPulse dashboard',
      last_activity: new Date(Date.now() - 120000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'pm',
      name: 'PM',
      role: 'Project Manager',
      model: 'GPT-4o',
      workspace: '~/.openclaw/workspace-pm',
      slack_channels: ['#alona-projects-updates', '#aloa-presos'],
      spawn_permissions: [],
      status: 'idle',
      last_activity: new Date(Date.now() - 3600000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'seo',
      name: 'SEO',
      role: 'SEO & Content',
      model: 'Claude Sonnet',
      workspace: '~/.openclaw/workspace-seo',
      slack_channels: ['#aloa-seo'],
      spawn_permissions: [],
      status: 'working',
      current_task: 'Q1 content calendar planning',
      last_activity: new Date(Date.now() - 1800000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'design',
      name: 'Design',
      role: 'Design & Brand',
      model: 'GPT-4o',
      workspace: '~/.openclaw/workspace-design',
      slack_channels: ['#aloa-design'],
      spawn_permissions: [],
      status: 'offline',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'research',
      name: 'Research',
      role: 'Competitive Intel',
      model: 'Claude Sonnet',
      workspace: '~/.openclaw/workspace-research',
      slack_channels: ['#aloa-aisecuritybenchmark', '#aloa-interns-rd'],
      spawn_permissions: [],
      status: 'working',
      current_task: 'AI security benchmark analysis',
      last_activity: new Date(Date.now() - 720000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'growth',
      name: 'Growth',
      role: 'Marketing',
      model: 'GPT-4o',
      workspace: '~/.openclaw/workspace-growth',
      slack_channels: ['#aloa-b2c', '#aloa-wander', '#aloa-wanderbuddies'],
      spawn_permissions: [],
      status: 'offline',
      last_activity: new Date(Date.now() - 10800000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'sales',
      name: 'Aaron',
      role: 'Sales Development',
      model: 'Claude Sonnet',
      workspace: '~/.openclaw/workspace-sales',
      slack_channels: ['#aloa-sales-bdm'],
      spawn_permissions: [],
      status: 'idle',
      last_activity: new Date(Date.now() - 2700000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'pulse',
      name: 'Pulse',
      role: 'ClawPulse PO',
      model: 'Claude Opus',
      workspace: '~/.openclaw/workspace-clawpulse',
      slack_channels: ['#aloa-clawpulse'],
      spawn_permissions: ['dev'],
      status: 'idle',
      last_activity: new Date(Date.now() - 300000).toISOString(),
      created_at: '2025-01-01T00:00:00Z',
    },
  ]
  
  const { error } = await supabase.from('agents').upsert(agents, { onConflict: 'id' })
  
  if (error) {
    console.error('❌ Failed to seed agents:', error)
    return false
  }
  
  console.log(`✅ Seeded ${agents.length} agents`)
  return true
}

async function seedTasks() {
  console.log('📋 Seeding tasks...')
  
  const tasks = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Write API documentation',
      description: 'Document all internal agent API endpoints and communication protocols',
      status: 'todo',
      priority: 'medium',
      project: 'Infrastructure',
      assigned_agent: 'pm',
      created_by: 'main',
      created_at: '2025-02-18T10:00:00Z',
      updated_at: '2025-02-18T10:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Design agent avatar system',
      description: 'Create consistent visual identity for each agent across the dashboard',
      status: 'todo',
      priority: 'low',
      project: 'ClawPulse',
      assigned_agent: 'design',
      created_by: 'pulse',
      created_at: '2025-02-19T09:00:00Z',
      updated_at: '2025-02-19T09:00:00Z',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      title: 'Research competitor pricing models',
      description: 'Analyze AI agent platform pricing for Aona positioning strategy',
      status: 'todo',
      priority: 'high',
      project: 'Strategy',
      assigned_agent: 'research',
      created_by: 'main',
      created_at: '2025-02-20T08:00:00Z',
      updated_at: '2025-02-20T08:00:00Z',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      title: 'Build ClawPulse dashboard',
      description: 'MVP dashboard for monitoring all 9 agents, tasks, and activity',
      status: 'in_progress',
      priority: 'high',
      project: 'ClawPulse',
      assigned_agent: 'dev',
      created_by: 'pulse',
      created_at: '2025-02-19T14:00:00Z',
      updated_at: '2025-02-20T10:00:00Z',
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      title: 'Q1 content calendar',
      description: 'Plan and schedule SEO content for Q1 2025 across all channels',
      status: 'in_progress',
      priority: 'medium',
      project: 'Content',
      assigned_agent: 'seo',
      created_by: 'pm',
      created_at: '2025-02-17T11:00:00Z',
      updated_at: '2025-02-19T16:00:00Z',
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      title: 'AI security benchmark report',
      description: 'Comprehensive analysis of AI security standards and Aona compliance',
      status: 'in_progress',
      priority: 'critical',
      project: 'Research',
      assigned_agent: 'research',
      created_by: 'main',
      created_at: '2025-02-15T09:00:00Z',
      updated_at: '2025-02-20T09:30:00Z',
    },
    {
      id: '77777777-7777-7777-7777-777777777777',
      title: 'Setup Supabase schema',
      description: 'Create all database tables and RLS policies for ClawPulse',
      status: 'done',
      priority: 'high',
      project: 'ClawPulse',
      assigned_agent: 'dev',
      created_by: 'pulse',
      created_at: '2025-02-16T10:00:00Z',
      updated_at: '2025-02-18T15:00:00Z',
    },
    {
      id: '88888888-8888-8888-8888-888888888888',
      title: 'Onboard Aaron (Sales) agent',
      description: 'Configure Aaron agent with SDR playbook and CRM integrations',
      status: 'done',
      priority: 'medium',
      project: 'Infrastructure',
      assigned_agent: 'pm',
      created_by: 'main',
      created_at: '2025-02-14T10:00:00Z',
      updated_at: '2025-02-16T12:00:00Z',
    },
    {
      id: '99999999-9999-9999-9999-999999999999',
      title: 'Launch Q1 marketing campaign',
      description: 'Multi-channel campaign for Aona platform launch — blocked on brand assets',
      status: 'blocked',
      priority: 'high',
      project: 'Growth',
      assigned_agent: 'growth',
      created_by: 'main',
      created_at: '2025-02-10T10:00:00Z',
      updated_at: '2025-02-18T14:00:00Z',
    },
  ]
  
  const { error } = await supabase.from('tasks').upsert(tasks, { onConflict: 'id' })
  
  if (error) {
    console.error('❌ Failed to seed tasks:', error)
    return false
  }
  
  console.log(`✅ Seeded ${tasks.length} tasks`)
  return true
}

async function seedActivityLog() {
  console.log('📊 Seeding activity log...')
  
  const activities = [
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      agent_id: 'dev',
      action: 'Completed file write',
      details: 'lib/supabase.ts created',
      metadata: { file_path: 'lib/supabase.ts' },
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222',
      agent_id: 'main',
      action: 'Dispatched task',
      details: 'Assigned dashboard build to Dev',
      metadata: { task_id: '44444444-4444-4444-4444-444444444444', target_agent: 'dev' },
      created_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 'a3333333-3333-3333-3333-333333333333',
      agent_id: 'research',
      action: 'Analysis update',
      details: 'AI benchmark report 68% complete',
      metadata: { progress: 68, task_id: '66666666-6666-6666-6666-666666666666' },
      created_at: new Date(Date.now() - 720000).toISOString(),
    },
    {
      id: 'a4444444-4444-4444-4444-444444444444',
      agent_id: 'seo',
      action: 'Status update',
      details: 'Waiting on Design for brand colors',
      metadata: { blocked_by: 'design' },
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'a5555555-5555-5555-5555-555555555555',
      agent_id: 'sales',
      action: 'Outreach paused',
      details: 'Awaiting updated prospect list from PM',
      metadata: { blocked_by: 'pm' },
      created_at: new Date(Date.now() - 2700000).toISOString(),
    },
    {
      id: 'a6666666-6666-6666-6666-666666666666',
      agent_id: 'pm',
      action: 'Sprint review',
      details: 'Q1 sprint board updated',
      metadata: { sprint: 'Q1-2025' },
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'a7777777-7777-7777-7777-777777777777',
      agent_id: 'dev',
      action: 'Git commit',
      details: 'feat: initial Next.js project setup',
      metadata: { commit: 'abc123' },
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'a8888888-8888-8888-8888-888888888888',
      agent_id: 'growth',
      action: 'Channel analysis',
      details: 'WanderBuddies campaign metrics reviewed',
      metadata: { campaign: 'WanderBuddies' },
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
  ]
  
  const { error } = await supabase.from('activity_log').upsert(activities, { onConflict: 'id' })
  
  if (error) {
    console.error('❌ Failed to seed activity log:', error)
    return false
  }
  
  console.log(`✅ Seeded ${activities.length} activity log entries`)
  return true
}

async function seedKnowledge() {
  console.log('📚 Seeding knowledge base...')
  
  const knowledge = [
    {
      id: 'k1111111-1111-1111-1111-111111111111',
      title: 'Agent Coordination Protocol',
      content: 'When spawning a sub-agent, always include context, expected output format, and success criteria.',
      category: 'protocol',
      tags: ['coordination', 'spawning', 'best-practice'],
      source_agent: 'main',
      created_at: '2025-02-01T10:00:00Z',
      updated_at: '2025-02-01T10:00:00Z',
    },
    {
      id: 'k2222222-2222-2222-2222-222222222222',
      title: 'Slack Notification Best Practices',
      content: 'Use structured messages with clear action items. Tag relevant team members. Keep updates concise.',
      category: 'skill',
      tags: ['slack', 'communication', 'notifications'],
      source_agent: 'pm',
      created_at: '2025-02-05T14:00:00Z',
      updated_at: '2025-02-05T14:00:00Z',
    },
    {
      id: 'k3333333-3333-3333-3333-333333333333',
      title: 'SEO Content Framework',
      content: 'Focus on E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). Target long-tail keywords with clear intent.',
      category: 'lesson',
      tags: ['seo', 'content', 'framework'],
      source_agent: 'seo',
      created_at: '2025-02-10T09:00:00Z',
      updated_at: '2025-02-10T09:00:00Z',
    },
  ]
  
  const { error } = await supabase.from('knowledge').upsert(knowledge, { onConflict: 'id' })
  
  if (error) {
    console.error('❌ Failed to seed knowledge:', error)
    return false
  }
  
  console.log(`✅ Seeded ${knowledge.length} knowledge entries`)
  return true
}

async function seedCronJobs() {
  console.log('⏰ Seeding cron jobs...')
  
  const cronJobs = [
    {
      id: 'daily-status-report',
      name: 'Daily Status Report',
      schedule: '0 9 * * *',
      agent_id: 'main',
      next_run: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      payload: { channel: '#aloa-setup', format: 'summary' },
    },
    {
      id: 'weekly-metrics-rollup',
      name: 'Weekly Metrics Rollup',
      schedule: '0 10 * * 1',
      agent_id: 'pm',
      next_run: new Date(Date.now() + 604800000).toISOString(),
      status: 'active',
      payload: { channel: '#alona-projects-updates', include_charts: true },
    },
  ]
  
  const { error } = await supabase.from('cron_jobs').upsert(cronJobs, { onConflict: 'id' })
  
  if (error) {
    console.error('❌ Failed to seed cron jobs:', error)
    return false
  }
  
  console.log(`✅ Seeded ${cronJobs.length} cron jobs`)
  return true
}

async function main() {
  console.log('🚀 ClawPulse Database Seeding\n')
  console.log('⚠️  IMPORTANT: Run the SQL migration first!')
  console.log('   1. Go to Supabase Dashboard → SQL Editor')
  console.log('   2. Run: supabase/migrations/001_create_tables.sql')
  console.log('   3. Then run this script\n')
  console.log('Proceeding with data seeding in 3 seconds...\n')
  
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  const agentsOk = await seedAgents()
  if (!agentsOk) process.exit(1)
  
  const tasksOk = await seedTasks()
  if (!tasksOk) process.exit(1)
  
  const activityOk = await seedActivityLog()
  if (!activityOk) process.exit(1)
  
  await seedKnowledge()
  await seedCronJobs()
  
  console.log('\n✅ Database seeding complete!')
  console.log('🎯 Data is now in Supabase. Ready to wire up the app!')
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
