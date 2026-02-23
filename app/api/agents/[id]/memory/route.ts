export const dynamic = 'force-static'

import { NextResponse } from 'next/server'
import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { AGENTS } from '@/lib/data'

export function generateStaticParams() {
  return AGENTS.map(a => ({ id: a.id }))
}

export interface MemoryFile {
  name: string
  content: string
  size: number
  modified: string
}

function getWorkspacePath(agentId: string): string | null {
  const agent = AGENTS.find(a => a.id === agentId)
  if (!agent) return null
  return agent.workspace.replace('~', homedir())
}

async function tryReadFile(filePath: string, name: string): Promise<MemoryFile | null> {
  try {
    const [content, info] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)])
    return { name, content, size: info.size, modified: info.mtime.toISOString() }
  } catch {
    return null
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspacePath = getWorkspacePath(id)
  if (!workspacePath) {
    return NextResponse.json({ files: [] })
  }

  const files: MemoryFile[] = []

  // Root memory files
  for (const name of ['MEMORY.md', 'IDENTITY.md', 'SOUL.md']) {
    const f = await tryReadFile(join(workspacePath, name), name)
    if (f) files.push(f)
  }

  // memory/*.md sub-directory
  try {
    const memDir = join(workspacePath, 'memory')
    const entries = (await readdir(memDir)).filter(e => e.endsWith('.md')).sort()
    for (const entry of entries) {
      const f = await tryReadFile(join(memDir, entry), `memory/${entry}`)
      if (f) files.push(f)
    }
  } catch {
    // no memory/ directory
  }

  return NextResponse.json({ files })
}
