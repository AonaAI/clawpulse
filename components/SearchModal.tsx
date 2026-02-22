'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { fetchAgents } from '@/lib/supabase-client'
import { fetchKnowledge, fetchFullActivityLog, fetchTasks } from '@/lib/supabase-client'
import type { KnowledgeEntry, Task } from '@/lib/types'
import { useDebounce } from '@/lib/useDebounce'

interface SearchResult {
  type: 'page' | 'agent' | 'task' | 'activity'
  id: string
  title: string
  subtitle: string
  href: string
  status?: string
  avatar?: string
}

const PAGES = [
  { id: 'overview', title: 'Overview', subtitle: 'Dashboard overview', href: '/', icon: '📊' },
  { id: 'agents', title: 'Agents', subtitle: 'Manage AI agents', href: '/agents', icon: '🤖' },
  { id: 'tasks', title: 'Tasks', subtitle: 'Task board & tracking', href: '/tasks', icon: '📋' },
  { id: 'knowledge', title: 'Knowledge', subtitle: 'Knowledge base', href: '/knowledge', icon: '📚' },
  { id: 'comms', title: 'Comms', subtitle: 'Agent communications', href: '/comms', icon: '💬' },
  { id: 'metrics', title: 'Metrics', subtitle: 'Performance metrics', href: '/metrics', icon: '📈' },
  { id: 'compare', title: 'Compare', subtitle: 'Compare agents', href: '/compare', icon: '⚖️' },
  { id: 'activity', title: 'Activity', subtitle: 'Activity log', href: '/activity', icon: '⚡' },
  { id: 'timeline', title: 'Timeline', subtitle: 'Event timeline', href: '/timeline', icon: '🕐' },
  { id: 'usage', title: 'Usage', subtitle: 'Token usage & costs', href: '/usage', icon: '💰' },
  { id: 'mission', title: 'Mission', subtitle: 'Agent missions', href: '/mission', icon: '🎯' },
  { id: 'audit', title: 'Audit', subtitle: 'Audit log', href: '/audit', icon: '🔍' },
  { id: 'settings', title: 'Settings', subtitle: 'App settings', href: '/settings', icon: '⚙️' },
]

const TYPE_CONFIG = {
  page: {
    label: 'Pages',
    color: '#c084fc',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
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

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  online: '#22c55e',
  idle: '#eab308',
  offline: '#6b7280',
  running: '#3b82f6',
  completed: '#22c55e',
  done: '#22c55e',
  pending: '#eab308',
  failed: '#ef4444',
  blocked: '#ef4444',
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-purple-300 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

function StatusDot({ status }: { status?: string }) {
  if (!status) return null
  const color = STATUS_COLORS[status.toLowerCase()] || '#6b7280'
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color }}
      title={status}
    />
  )
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [agents, setAgents] = useState<any[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activityItems, setActivityItems] = useState<any[]>([])
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Animation: mount then animate in
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Load data on open
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)

    fetchAgents().then(d => d && setAgents(d))
    fetchTasks().then(d => d && setTasks(d))
    fetchFullActivityLog(50).then(result => {
      const d = result?.items || result
      if (d) setActivityItems((d as any[]).map((item: any) => ({
        id: item.id,
        agent_name: item.agent_name || item.agent_id,
        action: item.action,
        details: item.details,
        time: item.created_at,
      })))
    })
  }, [open])

  const debouncedQuery = useDebounce(query, 300)

  const results = useMemo<SearchResult[]>(() => {
    const q = debouncedQuery.trim().toLowerCase()
    const out: SearchResult[] = []

    // Pages — always show if no query, or filter
    const filteredPages = PAGES.filter(p =>
      !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    )
    for (const p of q ? filteredPages : []) {
      out.push({ type: 'page', id: p.id, title: p.title, subtitle: p.subtitle, href: p.href })
    }

    if (!q) {
      // Show pages as default suggestions
      for (const p of PAGES.slice(0, 6)) {
        out.push({ type: 'page', id: p.id, title: p.title, subtitle: p.subtitle, href: p.href })
      }
      return out
    }

    // Agents
    for (const a of agents) {
      const name = a.name || a.agent_name || ''
      const role = a.role || a.description || ''
      if (name.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
        out.push({
          type: 'agent',
          id: a.id,
          title: name,
          subtitle: role,
          href: `/agents/${a.id}`,
          status: a.status,
          avatar: a.avatar,
        })
      }
    }

    // Tasks
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
        out.push({
          type: 'task',
          id: t.id,
          title: t.title,
          subtitle: `${t.status} · ${t.priority}`,
          href: `/tasks?highlight=${t.id}`,
          status: t.status,
        })
      }
    }

    // Activity
    for (const a of activityItems) {
      if ((a.action || '').toLowerCase().includes(q) || (a.details || '').toLowerCase().includes(q)) {
        out.push({
          type: 'activity',
          id: a.id,
          title: a.action,
          subtitle: a.details || '',
          href: '/activity',
        })
      }
    }

    return out.slice(0, 25)
  }, [debouncedQuery, agents, tasks, activityItems])

  useEffect(() => { setSelectedIndex(0) }, [results])

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

  if (!mounted) return null

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  let globalIdx = -1

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] transition-all duration-200"
      style={{
        background: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        opacity: visible ? 1 : 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cp-panel-bg, #1a0533)',
          border: '1px solid var(--cp-border-stronger, #2d1054)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(100,18,166,0.15)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
          transition: 'transform 200ms ease-out, opacity 200ms ease-out',
          opacity: visible ? 1 : 0,
        }}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
      >
        {/* Input */}
        <div style={{ borderBottom: '1px solid var(--cp-divider-accent, #2d1054)' }} className="flex items-center gap-3 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, agents, tasks, activity..."
            style={{ color: 'var(--cp-text-primary, #f8f4ff)', background: 'transparent' }}
            className="flex-1 text-sm outline-none placeholder:text-gray-500"
          />
          <kbd
            style={{ color: 'var(--cp-text-muted, #888)', background: 'var(--cp-separator-bg, #1a0533)', border: '1px solid var(--cp-border-subtle, #2d1054)' }}
            className="text-xs px-1.5 py-0.5 rounded font-mono"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto py-2">
          {debouncedQuery.trim() && results.length === 0 && (
            <div style={{ color: 'var(--cp-text-muted, #888)' }} className="text-sm text-center py-8">
              <div className="text-2xl mb-2">🔍</div>
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]
            if (!cfg) return null
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
                  const page = type === 'page' ? PAGES.find(p => p.id === item.id) : null
                  return (
                    <button
                      key={`${type}-${item.id}`}
                      data-index={idx}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        background: isSelected ? 'rgba(100,18,166,0.2)' : 'transparent',
                        color: isSelected ? '#f8f4ff' : 'var(--cp-text-secondary, #a0a0b0)',
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors duration-75"
                    >
                      {page ? (
                        <span className="text-base flex-shrink-0">{page.icon}</span>
                      ) : item.avatar ? (
                        <img src={item.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      ) : (
                        <span style={{ color: cfg.color, opacity: 0.5 }} className="flex-shrink-0">{cfg.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {highlightMatch(item.title, debouncedQuery)}
                          <StatusDot status={item.status} />
                        </div>
                        <div style={{ color: 'var(--cp-text-muted, #666)' }} className="text-xs truncate">
                          {highlightMatch(item.subtitle, debouncedQuery)}
                        </div>
                      </div>
                      {item.status && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: `${STATUS_COLORS[item.status.toLowerCase()] || '#6b7280'}20`,
                            color: STATUS_COLORS[item.status.toLowerCase()] || '#6b7280',
                          }}
                        >
                          {item.status}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ color: 'var(--cp-text-muted, #888)' }} className="text-xs flex-shrink-0">↵</span>
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
          style={{ borderTop: '1px solid var(--cp-divider-accent, #2d1054)', color: 'var(--cp-text-dim, #555)' }}
          className="px-4 py-2 flex items-center gap-4 text-xs"
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
