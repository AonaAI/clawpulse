'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AGENTS, SAMPLE_TASKS, ACTIVITY_LOG } from '@/lib/data'
import { fetchKnowledge, fetchFullActivityLog, fetchTasks } from '@/lib/supabase-client'
import type { KnowledgeEntry, Task } from '@/lib/types'

interface SearchResult {
  type: 'agent' | 'task' | 'knowledge' | 'activity'
  id: string
  title: string
  subtitle: string
  href: string
}

const TYPE_CONFIG = {
  agent: {
    label: 'Agents',
    color: '#a78bfa',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  task: {
    label: 'Tasks',
    color: '#60a5fa',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="4" height="18" rx="1" /><rect x="10" y="3" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="16" rx="1" />
      </svg>
    ),
  },
  knowledge: {
    label: 'Knowledge',
    color: '#34d399',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  activity: {
    label: 'Activity',
    color: '#fbbf24',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  // Simple substring match + word-start match
  if (lower.includes(q)) return true
  // Check if each char of query appears in order
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS)
  const [activityItems, setActivityItems] = useState(ACTIVITY_LOG)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Load data on open
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)

    // Fetch live data
    fetchKnowledge().then(d => d && setKnowledge(d))
    fetchTasks().then(d => d && setTasks(d))
    fetchFullActivityLog(50).then(d => {
      if (d) setActivityItems(d.map((item: any) => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name || item.agent_id,
        action: item.action,
        details: item.details,
        time: item.created_at,
      })))
    })
  }, [open])

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []
    const q = query.trim()
    const out: SearchResult[] = []

    // Agents
    for (const a of AGENTS) {
      if (fuzzyMatch(a.name, q) || fuzzyMatch(a.role, q)) {
        out.push({ type: 'agent', id: a.id, title: a.name, subtitle: a.role, href: `/agents?highlight=${a.id}` })
      }
    }

    // Tasks
    for (const t of tasks) {
      if (fuzzyMatch(t.title, q) || fuzzyMatch(t.description, q)) {
        out.push({ type: 'task', id: t.id, title: t.title, subtitle: `${t.status} · ${t.priority}`, href: `/tasks?highlight=${t.id}` })
      }
    }

    // Knowledge
    for (const k of knowledge) {
      if (fuzzyMatch(k.title, q) || fuzzyMatch(k.content, q)) {
        out.push({ type: 'knowledge', id: k.id, title: k.title, subtitle: k.category, href: `/knowledge?highlight=${k.id}` })
      }
    }

    // Activity
    for (const a of activityItems) {
      if (fuzzyMatch(a.action, q) || fuzzyMatch(a.details, q)) {
        out.push({ type: 'activity', id: a.id, title: a.action, subtitle: a.details, href: '/activity' })
      }
    }

    return out.slice(0, 20)
  }, [query, tasks, knowledge, activityItems])

  // Reset selection on results change
  useEffect(() => { setSelectedIndex(0) }, [results])

  // Scroll selected into view
  useEffect(() => {
    const container = resultsRef.current
    if (!container) return
    const el = container.querySelector(`[data-index="${selectedIndex}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const navigate = useCallback((result: SearchResult) => {
    onClose()
    router.push(result.href)
  }, [onClose, router])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigate(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selectedIndex, navigate, onClose])

  if (!open) return null

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  let globalIdx = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: 'var(--cp-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cp-panel-bg)',
          border: '1px solid var(--cp-border-stronger)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(109,40,217,0.1)',
        }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
      >
        {/* Input */}
        <div style={{ borderBottom: '1px solid var(--cp-divider-accent)' }} className="flex items-center gap-3 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search agents, tasks, knowledge, activity..."
            style={{ color: 'var(--cp-text-primary)', background: 'transparent' }}
            className="flex-1 text-sm outline-none placeholder:text-gray-500"
          />
          <kbd
            style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-separator-bg)', border: '1px solid var(--cp-border-subtle)' }}
            className="text-xs px-1.5 py-0.5 rounded font-mono"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-2">
          {query.trim() && results.length === 0 && (
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm text-center py-8">
              No results found
            </div>
          )}
          {!query.trim() && (
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm text-center py-8">
              Start typing to search...
            </div>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]
            return (
              <div key={type}>
                <div style={{ color: cfg.color }} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <span style={{ opacity: 0.7 }}>{cfg.icon}</span>
                  {cfg.label}
                </div>
                {items.map(item => {
                  globalIdx++
                  const idx = globalIdx
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        background: isSelected ? 'rgba(109,40,217,0.15)' : 'transparent',
                        color: isSelected ? '#f8f4ff' : '#a0a0b0',
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors duration-75"
                    >
                      <span style={{ color: cfg.color, opacity: 0.5 }}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs truncate">{item.subtitle}</div>
                      </div>
                      {isSelected && (
                        <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">↵</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{ borderTop: '1px solid var(--cp-divider-accent)', color: 'var(--cp-text-dim)' }}
          className="px-4 py-2 flex items-center gap-4 text-xs"
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
