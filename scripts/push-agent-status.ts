#!/usr/bin/env npx tsx
/**
 * Reads OpenClaw agent session files and pushes live status to Supabase.
 * Run: npx tsx scripts/push-agent-status.ts
 */
import { readdir, readFile, stat as fsStat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: join(__dirname, '..', '.env.local') })

const AGENTS_DIR = join(homedir(), '.openclaw', 'agents')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface SessionEntry {
  updatedAt?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  createdAt?: number
  model?: string
  kind?: string
  status?: string
}

interface AgentSessionRow {
  id: string
  agent_id: string
  session_key: string
  kind: string
  status: string
  started_at: string | null
  last_active: string | null
  model: string | null
  token_count: number
}

interface TokenAggregate {
  date: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  session_count: number
}

type Status = 'working' | 'idle' | 'offline'

function makeUUID(str: string): string {
  const hash = createHash('md5').update(str).digest('hex')
  return hash.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

function deriveStatus(lastActiveMs: number | null): Status {
  if (lastActiveMs === null) return 'offline'
  const ageMs = Date.now() - lastActiveMs
  if (ageMs < 5 * 60 * 1000) return 'working'
  if (ageMs < 2 * 60 * 60 * 1000) return 'idle'
  return 'offline'
}

async function readAgent(dir: string) {
  const sessionsPath = join(AGENTS_DIR, dir, 'sessions', 'sessions.json')
  try {
    const raw = await readFile(sessionsPath, 'utf-8')
    const sessions = JSON.parse(raw) as Record<string, SessionEntry>
    const entries = Object.entries(sessions)

    let lastActive: number | null = null
    let totalTokens = 0
    const sessionRows: AgentSessionRow[] = []

    for (const [key, s] of entries) {
      if (s.updatedAt && (lastActive === null || s.updatedAt > lastActive)) {
        lastActive = s.updatedAt
      }
      const tokens = s.totalTokens ?? ((s.inputTokens ?? 0) + (s.outputTokens ?? 0))
      totalTokens += tokens

      // Determine session status based on activity age
      const ageMs = s.updatedAt ? Date.now() - s.updatedAt : Infinity
      const sessionStatus = ageMs < 5 * 60 * 1000 ? 'active' : 'completed'

      sessionRows.push({
        id: makeUUID(`${dir}:${key}`),
        agent_id: dir,
        session_key: key,
        kind: s.kind ?? 'session',
        status: sessionStatus,
        started_at: s.createdAt ? new Date(s.createdAt).toISOString() : (s.updatedAt ? new Date(s.updatedAt).toISOString() : null),
        last_active: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
        model: s.model ?? null,
        token_count: tokens,
      })
    }

    const status = deriveStatus(lastActive)
    return {
      id: dir,
      status,
      last_activity: lastActive ? new Date(lastActive).toISOString() : null,
      current_task: JSON.stringify({ sessionCount: entries.length, totalTokens }),
      sessionRows,
    }
  } catch {
    return {
      id: dir,
      status: 'offline' as Status,
      last_activity: null,
      current_task: JSON.stringify({ sessionCount: 0, totalTokens: 0 }),
      sessionRows: [] as AgentSessionRow[],
    }
  }
}

async function pushTokenUsage(agentIds: string[]) {
  let totalRows = 0

  for (const agentId of agentIds) {
    // Use a per-bucket set to track unique sessions
    const sessionsDir = join(AGENTS_DIR, agentId, 'sessions')
    const result = new Map<string, TokenAggregate & { _sessions: Set<string> }>()

    let files: string[]
    try {
      files = await readdir(sessionsDir)
    } catch {
      continue
    }

    const jsonlFiles = files.filter(f =>
      f.endsWith('.jsonl') &&
      !f.includes('.deleted.') &&
      !f.endsWith('.lock')
    )

    for (const file of jsonlFiles) {
      const sessionId = file.slice(0, -'.jsonl'.length)
      let content: string
      try {
        content = await readFile(join(sessionsDir, file), 'utf-8')
      } catch {
        continue
      }

      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        let entry: any
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }

        if (entry.type !== 'message') continue
        if (entry.message?.role !== 'assistant') continue
        const usage = entry.message?.usage
        if (!usage) continue

        const model: string = entry.message.model ?? 'unknown'
        const date: string = entry.timestamp ? entry.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10)
        const key = `${date}:${model}`

        if (!result.has(key)) {
          result.set(key, {
            date,
            model,
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            cost_usd: 0,
            session_count: 0,
            _sessions: new Set(),
          })
        }

        const agg = result.get(key)!
        agg.input_tokens += usage.input ?? 0
        agg.output_tokens += usage.output ?? 0
        agg.total_tokens += usage.totalTokens ?? ((usage.input ?? 0) + (usage.output ?? 0))
        agg.cost_usd += usage.cost?.total ?? 0
        agg._sessions.add(sessionId)
      }
    }

    if (result.size === 0) continue

    const rows = []
    for (const [key, agg] of result) {
      rows.push({
        id: makeUUID(`${agentId}:${key}`),
        agent_id: agentId,
        input_tokens: agg.input_tokens,
        output_tokens: agg.output_tokens,
        total_tokens: agg.total_tokens,
        cost_usd: Math.round(agg.cost_usd * 1e8) / 1e8, // round to 8 decimal places
        model: agg.model,
        recorded_at: new Date(`${agg.date}T00:00:00Z`).toISOString(),
      })
    }

    const { error } = await supabase
      .from('token_usage')
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      console.error(`  Failed to upsert token_usage for ${agentId}:`, error.message)
    } else {
      totalRows += rows.length
    }
  }

  // Clean up seed/stale rows for agents not in the real agent list
  const { error: delErr } = await supabase
    .from('token_usage')
    .delete()
    .not('agent_id', 'in', `(${agentIds.join(',')})`)

  if (delErr) {
    console.error('  Failed to clean up stale token_usage rows:', delErr.message)
  }

  console.log(`  Upserted ${totalRows} token_usage rows across ${agentIds.length} agents`)
}

// ─── SQL to run once in the Supabase SQL editor ────────────────────────────
// CREATE TABLE IF NOT EXISTS public.slack_messages (
//   id TEXT PRIMARY KEY,
//   agent_id TEXT NOT NULL,
//   channel TEXT NOT NULL,
//   message TEXT NOT NULL,
//   sent_at TIMESTAMPTZ NOT NULL,
//   session_id TEXT,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_slack_messages_sent ON public.slack_messages (sent_at DESC);
// ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "anon_read" ON public.slack_messages FOR SELECT TO anon USING (true);
// CREATE POLICY "service_all" ON public.slack_messages FOR ALL TO service_role USING (true);
// ─────────────────────────────────────────────────────────────────────────────

interface SlackMessageRow {
  id: string
  agent_id: string
  channel: string
  message: string
  sent_at: string
  session_id: string
}

async function pushSlackMessages(agentIds: string[]) {
  const CREATE_TABLE_SQL = `
-- Run this once in your Supabase SQL editor:
CREATE TABLE IF NOT EXISTS public.slack_messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slack_messages_sent ON public.slack_messages (sent_at DESC);
ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON public.slack_messages FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON public.slack_messages FOR ALL TO service_role USING (true);`

  let totalRows = 0

  for (const agentId of agentIds) {
    const sessionsDir = join(AGENTS_DIR, agentId, 'sessions')
    const messages: SlackMessageRow[] = []

    let files: string[]
    try {
      files = await readdir(sessionsDir)
    } catch {
      continue
    }

    const jsonlFiles = files.filter(f =>
      f.endsWith('.jsonl') &&
      !f.includes('.deleted.') &&
      !f.endsWith('.lock')
    )

    for (const file of jsonlFiles) {
      const sessionId = file.slice(0, -'.jsonl'.length)
      let content: string
      try {
        content = await readFile(join(sessionsDir, file), 'utf-8')
      } catch {
        continue
      }

      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        let entry: any
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }

        // Only look at assistant messages
        if (entry.type !== 'message') continue
        if (entry.message?.role !== 'assistant') continue

        const contentArr = entry.message?.content
        if (!Array.isArray(contentArr)) continue

        for (const block of contentArr) {
          if (block.type !== 'tool_use' && block.type !== 'toolCall') continue
          if (block.name !== 'message') continue
          const input = block.input || block.arguments || {}
          if (input.action !== 'send') continue

          const channel = String(input.target || input.channel || input.channel_id || 'unknown')
          const text = String(input.message || input.text || input.content || '')
          const truncated = text.slice(0, 500)
          const timestamp: string = entry.timestamp || new Date().toISOString()

          const id = makeUUID(`${agentId}:${sessionId}:${timestamp}:${channel}:${truncated.slice(0, 50)}`)
          messages.push({ id, agent_id: agentId, channel, message: truncated, sent_at: timestamp, session_id: sessionId })
        }
      }
    }

    if (messages.length === 0) continue

    // Keep last 100 per agent sorted newest first
    const sorted = messages.sort((a, b) => b.sent_at.localeCompare(a.sent_at)).slice(0, 100)

    const { error } = await supabase
      .from('slack_messages')
      .upsert(sorted, { onConflict: 'id' })

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).code === '42P01') {
        console.error('\n  ⚠  slack_messages table does not exist. Run this SQL in the Supabase dashboard:')
        console.error(CREATE_TABLE_SQL)
        console.error()
      } else {
        console.error(`  Failed to upsert slack_messages for ${agentId}:`, error.message)
      }
    } else {
      totalRows += sorted.length
      console.log(`  ${agentId}: ${sorted.length} Slack message(s)`)
    }
  }

  console.log(`  Upserted ${totalRows} slack_messages rows across ${agentIds.length} agents`)
}

// ─── Activity Log from JSONL sessions ──────────────────────────────────────

interface ActivityRow {
  id: string
  agent_id: string
  action: string
  details: string
  metadata: Record<string, any>
  created_at: string
}

async function pushActivityLog(agentIds: string[]) {
  // First, delete old seed data (rows with created_at before 2026-02-20 which were seeded)
  const { error: delErr } = await supabase
    .from('activity_log')
    .delete()
    .lt('created_at', '2026-02-20T00:00:00Z')

  if (delErr) {
    console.error('  Failed to delete old seed activity data:', delErr.message)
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000 // only files modified in last 24h
  let totalRows = 0

  for (const agentId of agentIds) {
    const sessionsDir = join(AGENTS_DIR, agentId, 'sessions')
    const events: ActivityRow[] = []

    let files: string[]
    try {
      files = await readdir(sessionsDir)
    } catch {
      continue
    }

    const jsonlFiles = files.filter(f =>
      f.endsWith('.jsonl') &&
      !f.includes('.deleted.') &&
      !f.endsWith('.lock')
    )

    for (const file of jsonlFiles) {
      const sessionKey = file.slice(0, -'.jsonl'.length)
      const filePath = join(sessionsDir, file)

      // Check file modification time
      try {
        const fileStat = await fsStat(filePath)
        if (fileStat.mtimeMs < cutoff) continue
      } catch {
        continue
      }

      let content: string
      try {
        content = await readFile(filePath, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        let entry: any
        try {
          entry = JSON.parse(line)
        } catch {
          continue
        }

        const timestamp: string = entry.timestamp || new Date().toISOString()
        const deterministicId = makeUUID(`activity:${agentId}:${sessionKey}:${i}`)

        // Handle tool_use in assistant messages
        if (entry.type === 'message' && entry.message?.role === 'assistant') {
          const contentArr = entry.message?.content
          if (!Array.isArray(contentArr)) continue

          for (const block of contentArr) {
            if (block.type === 'tool_use' || block.type === 'toolCall') {
              const toolName = block.name || 'unknown'
              const input = block.input || block.arguments || {}
              let summary = ''

              // Create brief summary based on tool
              if (toolName === 'exec' || toolName === 'bash') {
                summary = String(input.command || input.cmd || '').slice(0, 100)
              } else if (toolName === 'edit' || toolName === 'write' || toolName === 'read') {
                summary = String(input.file_path || input.path || '').split('/').pop() || ''
              } else if (toolName === 'message') {
                summary = `${input.action || 'send'} → ${input.target || input.channel || 'unknown'}`
              } else if (toolName === 'browser') {
                summary = String(input.action || input.url || '').slice(0, 80)
              } else if (toolName === 'web_search') {
                summary = String(input.query || '').slice(0, 80)
              } else {
                summary = JSON.stringify(input).slice(0, 80)
              }

              const blockId = makeUUID(`activity:${agentId}:${sessionKey}:${i}:${toolName}:${block.id || ''}`)

              events.push({
                id: blockId,
                agent_id: agentId,
                action: 'tool_call',
                details: `Used ${toolName}: ${summary}`.slice(0, 255),
                metadata: { tool: toolName, session_key: sessionKey },
                created_at: timestamp,
              })
            }

            // Check for assistant text mentioning deploy/commit/push/build
            if (block.type === 'text' && typeof block.text === 'string') {
              const text = block.text.toLowerCase()
              let action: string | null = null
              if (text.includes('deployed') || text.includes('firebase deploy') || text.includes('deploy complete')) {
                action = 'deploy'
              } else if (text.includes('committed') || text.includes('git commit')) {
                action = 'commit'
              } else if (text.includes('git push') || text.includes('pushed to')) {
                action = 'commit'
              } else if (text.includes('build succeeded') || text.includes('build complete') || text.includes('npm run build')) {
                action = 'deploy'
              }

              if (action) {
                const snippet = block.text.slice(0, 120)
                events.push({
                  id: makeUUID(`activity:${agentId}:${sessionKey}:${i}:action:${action}`),
                  agent_id: agentId,
                  action,
                  details: snippet,
                  metadata: { session_key: sessionKey },
                  created_at: timestamp,
                })
              }
            }
          }
          continue
        }

        // System events
        if (entry.type === 'system') {
          events.push({
            id: deterministicId,
            agent_id: agentId,
            action: 'system',
            details: String(entry.message || entry.data?.text || 'System event').slice(0, 255),
            metadata: { session_key: sessionKey },
            created_at: timestamp,
          })
          continue
        }

        // Session start
        if (entry.type === 'session') {
          events.push({
            id: deterministicId,
            agent_id: agentId,
            action: 'system',
            details: `Session started: ${sessionKey.slice(0, 8)}...`,
            metadata: { session_key: sessionKey, version: entry.version },
            created_at: timestamp,
          })
          continue
        }

        // Error entries
        if (entry.type === 'error' || entry.type === 'message' && entry.message?.role === 'system' && entry.message?.content?.[0]?.text?.toLowerCase().includes('error')) {
          events.push({
            id: deterministicId,
            agent_id: agentId,
            action: 'error',
            details: String(entry.message?.content?.[0]?.text || entry.error || 'Error occurred').slice(0, 255),
            metadata: { session_key: sessionKey },
            created_at: timestamp,
          })
        }
      }
    }

    if (events.length === 0) continue

    // Keep last 200 per agent, sorted newest first
    const sorted = events.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200)

    // Batch upsert in chunks of 50
    for (let i = 0; i < sorted.length; i += 50) {
      const chunk = sorted.slice(i, i + 50)
      const { error } = await supabase
        .from('activity_log')
        .upsert(chunk, { onConflict: 'id' })

      if (error) {
        console.error(`  Failed to upsert activity_log for ${agentId}:`, error.message)
        break
      }
    }

    totalRows += sorted.length
    console.log(`  ${agentId}: ${sorted.length} activity event(s)`)
  }

  console.log(`  Upserted ${totalRows} activity_log rows across ${agentIds.length} agents`)
}

// ─── Cron Jobs from OpenClaw CLI ───────────────────────────────────────────

async function pushCronJobs() {
  const { execSync } = await import('child_process')
  let raw: string
  try {
    raw = execSync('openclaw cron list --json 2>/dev/null', { encoding: 'utf-8', timeout: 15000 })
  } catch (e) {
    console.error('  Failed to run openclaw cron list:', (e as Error).message)
    return
  }

  let jobs: any[]
  try {
    const parsed = JSON.parse(raw)
    jobs = parsed.jobs || []
  } catch {
    console.error('  Failed to parse cron list JSON')
    return
  }

  if (jobs.length === 0) {
    console.log('  No cron jobs found')
    return
  }

  const rows = jobs.map((j: any) => {
    // Build schedule string
    let schedule = ''
    if (j.schedule?.kind === 'cron') {
      schedule = j.schedule.expr || ''
      if (j.schedule.tz) schedule += ` (${j.schedule.tz})`
    } else if (j.schedule?.kind === 'every') {
      const mins = Math.round((j.schedule.everyMs || 0) / 60000)
      schedule = mins >= 60 ? `every ${(mins / 60).toFixed(0)}h` : `every ${mins}m`
    } else {
      schedule = JSON.stringify(j.schedule).slice(0, 80)
    }

    return {
      id: j.id,
      name: j.name || 'Unnamed',
      schedule,
      agent_id: j.agentId || 'unknown',
      enabled: j.enabled ?? true,
      status: j.state?.lastStatus || 'pending',
      last_run: j.state?.lastRunAtMs ? new Date(j.state.lastRunAtMs).toISOString() : null,
      next_run: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : null,
      last_duration_ms: j.state?.lastDurationMs ?? null,
      consecutive_errors: j.state?.consecutiveErrors ?? 0,
      payload_message: j.payload?.message?.slice(0, 500) || null,
    }
  })

  const { error } = await supabase
    .from('cron_jobs')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    console.error('  Failed to upsert cron_jobs:', error.message)
  } else {
    console.log(`  Upserted ${rows.length} cron jobs`)
  }
}

// ─── Spawn Requests ────────────────────────────────────────────────────────

async function processSpawnRequests() {
  const { execSync } = await import('child_process')

  // Fetch pending requests
  const { data: pending, error } = await supabase
    .from('spawn_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('  Failed to fetch spawn_requests:', error.message)
    return
  }

  if (!pending || pending.length === 0) {
    console.log('  No pending spawn requests')
    return
  }

  for (const req of pending) {
    console.log(`  Processing spawn request ${req.id} for agent ${req.agent_id}: ${req.task.slice(0, 60)}...`)

    // Mark as running
    await supabase.from('spawn_requests').update({ status: 'running' }).eq('id', req.id)

    try {
      const modelFlag = req.model && req.model !== 'default' ? ` --model ${req.model}` : ''
      const escapedTask = req.task.replace(/"/g, '\\"').replace(/\$/g, '\\$')
      const cmd = `openclaw sessions spawn --agent ${req.agent_id} --task "${escapedTask}"${modelFlag} 2>&1`

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 })

      await supabase
        .from('spawn_requests')
        .update({ status: 'done', result: output.slice(0, 500) })
        .eq('id', req.id)

      console.log(`  ✓ Spawn request ${req.id} completed`)
    } catch (e: any) {
      const errMsg = e.stderr || e.stdout || e.message || 'Unknown error'
      await supabase
        .from('spawn_requests')
        .update({ status: 'error', result: String(errMsg).slice(0, 500) })
        .eq('id', req.id)

      console.error(`  ✗ Spawn request ${req.id} failed:`, String(errMsg).slice(0, 100))
    }
  }

  console.log(`  Processed ${pending.length} spawn request(s)`)
}

async function main() {
  const dirs = await readdir(AGENTS_DIR)
  const agents = await Promise.all(dirs.map(readAgent))

  let totalSessions = 0
  for (const agent of agents) {
    const { error } = await supabase
      .from('agents')
      .update({
        status: agent.status,
        last_activity: agent.last_activity,
        current_task: agent.current_task,
      })
      .eq('id', agent.id)

    if (error) {
      console.error(`Failed to update ${agent.id}:`, error.message)
    }

    // Push session data to agent_sessions
    if (agent.sessionRows.length > 0) {
      const { error: sessErr } = await supabase
        .from('agent_sessions')
        .upsert(agent.sessionRows, { onConflict: 'agent_id,session_key' })

      if (sessErr) {
        console.error(`Failed to push sessions for ${agent.id}:`, sessErr.message)
      } else {
        totalSessions += agent.sessionRows.length
      }
    }
  }

  console.log(`[${new Date().toISOString()}] Pushed status for ${agents.length} agents (${totalSessions} sessions): ${agents.map(a => `${a.id}=${a.status}`).join(', ')}`)

  // Push real token usage from .jsonl session files
  console.log('Parsing .jsonl session files for token usage...')
  await pushTokenUsage(dirs)

  // Push real activity log from .jsonl session files
  console.log('Parsing .jsonl session files for activity log...')
  await pushActivityLog(dirs)

  // Push Slack message previews from .jsonl session files
  console.log('Parsing .jsonl session files for Slack messages...')
  await pushSlackMessages(dirs)

  // Push cron jobs from OpenClaw CLI
  console.log('Fetching cron jobs from OpenClaw...')
  await pushCronJobs()

  // Process spawn requests
  console.log('Processing spawn requests...')
  await processSpawnRequests()
}

main().catch(e => { console.error(e); process.exit(1) })
