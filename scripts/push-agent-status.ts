#!/usr/bin/env npx tsx
/**
 * Reads OpenClaw agent session files and pushes live status to Supabase.
 * Run: npx tsx scripts/push-agent-status.ts
 */
import { readdir, readFile } from 'fs/promises'
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
}

main().catch(e => { console.error(e); process.exit(1) })
