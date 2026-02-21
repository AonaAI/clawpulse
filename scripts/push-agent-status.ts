#!/usr/bin/env npx tsx
/**
 * Reads OpenClaw agent session files and pushes live status to Supabase.
 * Run: npx tsx scripts/push-agent-status.ts
 */
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
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
}

type Status = 'working' | 'idle' | 'offline'

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
    const entries = Object.values(sessions)

    let lastActive: number | null = null
    let totalTokens = 0

    for (const s of entries) {
      if (s.updatedAt && (lastActive === null || s.updatedAt > lastActive)) {
        lastActive = s.updatedAt
      }
      totalTokens += s.totalTokens ?? ((s.inputTokens ?? 0) + (s.outputTokens ?? 0))
    }

    const status = deriveStatus(lastActive)
    return {
      id: dir,
      status,
      last_activity: lastActive ? new Date(lastActive).toISOString() : null,
      // Pack session_count and total_tokens into current_task as JSON metadata
      current_task: JSON.stringify({ sessionCount: entries.length, totalTokens }),
    }
  } catch {
    return {
      id: dir,
      status: 'offline' as Status,
      last_activity: null,
      current_task: JSON.stringify({ sessionCount: 0, totalTokens: 0 }),
    }
  }
}

async function main() {
  const dirs = await readdir(AGENTS_DIR)
  const agents = await Promise.all(dirs.map(readAgent))

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
  }

  console.log(`[${new Date().toISOString()}] Pushed status for ${agents.length} agents: ${agents.map(a => `${a.id}=${a.status}`).join(', ')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
