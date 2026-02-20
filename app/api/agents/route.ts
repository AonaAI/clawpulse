export const dynamic = 'force-static'

import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const AGENTS_DIR = join(homedir(), '.openclaw', 'agents')

const DIR_TO_NAME: Record<string, string> = {
  main: 'Aloa',
  dev: 'Dev',
  pm: 'PM',
  sales: 'Aaron',
  clawpulse: 'Pulse',
  login: 'Login',
  fiverr: 'Fiverr',
}

type AgentStatus = 'working' | 'idle' | 'offline'

export interface AgentLiveData {
  dir: string
  name: string
  sessionCount: number
  lastActive: number | null
  totalTokens: number
  status: AgentStatus
}

interface SessionEntry {
  updatedAt?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

function deriveStatus(lastActiveMs: number | null): AgentStatus {
  if (lastActiveMs === null) return 'offline'
  const ageMs = Date.now() - lastActiveMs
  if (ageMs < 5 * 60 * 1000) return 'working'
  if (ageMs < 2 * 60 * 60 * 1000) return 'idle'
  return 'offline'
}

async function readAgentData(dir: string): Promise<AgentLiveData> {
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
      // totalTokens is the cumulative count per session; fall back to input+output sum
      totalTokens += s.totalTokens ?? (s.inputTokens ?? 0) + (s.outputTokens ?? 0)
    }

    return {
      dir,
      name: DIR_TO_NAME[dir] ?? dir,
      sessionCount: entries.length,
      lastActive,
      totalTokens,
      status: deriveStatus(lastActive),
    }
  } catch {
    return {
      dir,
      name: DIR_TO_NAME[dir] ?? dir,
      sessionCount: 0,
      lastActive: null,
      totalTokens: 0,
      status: 'offline',
    }
  }
}

export async function GET() {
  try {
    const dirs = await readdir(AGENTS_DIR)
    const results = await Promise.all(dirs.map(readAgentData))
    return NextResponse.json(results)
  } catch (error) {
    console.error('[api/agents] Failed to read agents directory:', error)
    return NextResponse.json(
      { error: 'Failed to read agent data' },
      { status: 500 }
    )
  }
}
