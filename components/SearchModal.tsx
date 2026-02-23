'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { fetchAgents, fetchFullActivityLog, fetchTasks, fetchAllSessions } from '@/lib/supabase-client'
import type { Task } from '@/lib/types'

interface SearchResult {
  type: 'page' | 'agent' | 'session' | 'error' | 'task' | 'command'
  id: string
  title: string
  subtitle: string
  href: string
  status?: string
  avatar?: string
  action?: () => void
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
  { id: 'sessions', title: 'Sessions', subtitle: 'Agent sessions', href: '/sessions', icon: '🔗' },
  { id: 'workflows', title: 'Workflows', subtitle: 'Automation workflows', href: '/workflows', icon: '🔀' },
  { id: 'timeline', title: 'Timeline', subtitle: 'Event timeline', href: '/timeline', icon: '🕐' },
  { id: 'usage', title: 'Usage', subtitle: 'Token usage & costs', href: '/usage', icon: '💰' },
  { id: 'playground', title: 'Playground', subtitle: 'Test & experiment', href: '/playground', icon: '🧪' },
  { id: 'benchmarks', title: 'Benchmarks', subtitle: 'Performance benchmarks', href: '/benchmarks', icon: '🏆' },
  { id: 'mission', title: 'Mission', subtitle: 'Agent missions', href: '/mission', icon: '🎯' },
  { id: 'cron', title: 'Cron', subtitle: 'Scheduled jobs', href: '/cron', icon: '⏰' },
  { id: 'audit', title: 'Audit', subtitle: 'Audit log', href: '/audit', icon: '🔍' },
  { id: 'errors', title: 'Errors', subtitle: 'Error tracking', href: '/errors', icon: '🚨' },
  { id: 'alerts', title: 'Alerts', subtitle: 'Alert rules', href: '/alerts', icon: '🔔' },
  { id: 'settings', title: 'Settings', subtitle: 'App settings', href: '/settings', icon: '⚙️' },
]

const COMMANDS = [
  { id: 'toggle-theme', title: 'Toggle theme', subtitle: 'Switch between light and dark mode', icon: '🌓' },
  { id: 'export-data', title: 'Export data', subtitle: 'Export dashboard data as JSON', icon: '📤' },
  { id: 'new-alert-rule', title: 'New alert rule', subtitle: 'Create a new alert rule', icon: '🔔' },
]

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
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
  session: {
    label: 'Sessions',
    color: '#38bdf8',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  error: {
    label: 'Errors',
    color: '#f87171',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
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
  command: {
    label: 'Commands',
    color: '#fbbf24',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
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

const RECENT_SEARCHES_KEY = 'clawpulse-recent-searches'
const CACHE_TTL = 30_000

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch { return [] }
}

function saveRecentSearch(q: string) {
  const recent = getRecentSearches().filter(s => s !== q)
  recent.unshift(q)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, 5)))
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

// Simple data cache
let dataCache: { agents: any[]; sessions: any[]; errors: any[]; tasks: Task[]; ts: number } | null = null

async function loadSearchData() {
  if (dataCache && Date.now() - dataCache.ts < CACHE_TTL) return dataCache

  const [agentsData, sessionsData, activityData, tasksData] = await Promise.all([
    fetchAgents().catch(() => []),
    fetchAllSessions({ limit: 100 }).catch(() => ({ items: [] })),
    fetchFullActivityLog(100).catch(() => ({ items: [] })),
    fetchTasks().catch(() => []),
  ])

  const agents = agentsData || []
  const sessions = (sessionsData as any)?.items || []
  const rawActivity = (activityData as any)?.items || activityData || []
  const errors = (rawActivity as any[]).filter((a: any) =>
    (a.action || '').toLowerCase().includes('error') ||
    (a.details || '').toLowerCase().includes('error')
  )
  const tasks = tasksData || []

  dataCache = { agents, sessions, errors, tasks, ts: Date.now() }
  return dataCache
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [data, setData] = useState<{ agents: any[]; sessions: any[]; errors: any[]; tasks: Task[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const isCommandMode = query.startsWith('>')

  // Animation
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
    setRecentSearches(getRecentSearches())
    setTimeout(() => inputRef.current?.focus(), 50)

    setLoading(true)
    loadSearchData().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [open])

  const results = useMemo<SearchResult[]>(() => {
    // Command mode
    if (isCommandMode) {
      const cmdQuery = query.slice(1).trim().toLowerCase()
      return COMMANDS
        .filter(c => !cmdQuery || c.title.toLowerCase().includes(cmdQuery))
        .map(c => ({
          type: 'command' as const,
          id: c.id,
          title: c.title,
          subtitle: c.subtitle,
          href: '',
          action: () => {
            if (c.id === 'toggle-theme') {
              document.documentElement.classList.toggle('light')
            } else if (c.id === 'export-data') {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'clawpulse-export.json'; a.click()
              URL.revokeObjectURL(url)
            } else if (c.id === 'new-alert-rule') {
              router.push('/alerts')
            }
          },
        }))
    }

    const q = query.trim().toLowerCase()
    const out: SearchResult[] = []

    // Pages
    const filteredPages = PAGES.filter(p =>
      !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    )
    if (q) {
      for (const p of filteredPages) {
        out.push({ type: 'page', id: p.id, title: p.title, subtitle: p.subtitle, href: p.href })
      }
    } else {
      // No query: show first 6 pages as suggestions
      for (const p of PAGES.slice(0, 6)) {
        out.push({ type: 'page', id: p.id, title: p.title, subtitle: p.subtitle, href: p.href })
      }
      return out
    }

    if (!data) return out

    // Agents
    for (const a of data.agents) {
      const name = a.name || a.agent_name || ''
      const model = a.model || ''
      const role = a.role || a.description || ''
      const status = a.status || ''
      if (name.toLowerCase().includes(q) || model.toLowerCase().includes(q) || role.toLowerCase().includes(q) || status.toLowerCase().includes(q)) {
        out.push({
          type: 'agent',
          id: a.id,
          title: name,
          subtitle: [model, role].filter(Boolean).join(' · '),
          href: `/agents/${a.id}`,
          status: a.status,
          avatar: a.avatar,
        })
      }
    }

    // Sessions
    for (const s of data.sessions) {
      const key = s.session_key || ''
      const agentName = s.agent_name || ''
      const model = s.model || ''
      if (key.toLowerCase().includes(q) || agentName.toLowerCase().includes(q) || model.toLowerCase().includes(q)) {
        out.push({
          type: 'session',
          id: s.id,
          title: key || s.id.slice(0, 12),
          subtitle: [agentName, model].filter(Boolean).join(' · '),
          href: `/sessions/${s.id}`,
          status: s.status,
        })
      }
    }

    // Errors
    for (const e of data.errors) {
      const action = e.action || ''
      const details = e.details || ''
      const agentName = e.agent_name || e.agent_id || ''
      if (action.toLowerCase().includes(q) || details.toLowerCase().includes(q) || agentName.toLowerCase().includes(q)) {
        out.push({
          type: 'error',
          id: e.id,
          title: action,
          subtitle: details.slice(0, 100),
          href: '/errors',
          status: 'failed',
        })
      }
    }

    // Tasks
    for (const t of data.tasks) {
      const title = t.title || ''
      const desc = t.description || ''
      if (title.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) {
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

    return out.slice(0, 30)
  }, [query, data, isCommandMode, router])

  useEffect(() => { setSelectedIndex(0) }, [results])

  useEffect(() => {
    const container = resultsRef.current
    if (!container) return
    const el = container.querySelector(`[data-index="${selectedIndex}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Focus trap: keep Tab focus inside the dialog
  useEffect(() => {
    if (!open || !mounted) return
    const dialog = dialogRef.current
    if (!dialog) return
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [open, mounted])

  const navigate = useCallback((result: SearchResult) => {
    if (result.action) {
      result.action()
      onClose()
      return
    }
    if (query.trim() && !query.startsWith('>')) {
      saveRecentSearch(query.trim())
    }
    onClose()
    router.push(result.href)
  }, [onClose, router, query])

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

  // Group results by type, preserving order
  const typeOrder: string[] = ['page', 'agent', 'session', 'error', 'task', 'command']
  const grouped: Record<string, SearchResult[]> = {}
  for (const r of results) {
    ;(grouped[r.type] ??= []).push(r)
  }

  let globalIdx = -1

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-3 sm:px-0 transition-all duration-200"
      style={{
        background: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        opacity: visible ? 1 : 0,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
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
            placeholder={isCommandMode ? 'Type a command...' : 'Search pages, agents, sessions, errors, tasks...'}
            aria-label={isCommandMode ? 'Command input' : 'Search'}
            aria-autocomplete="list"
            aria-controls="search-results"
            role="combobox"
            aria-expanded={results.length > 0}
            style={{ color: 'var(--cp-text-primary, #f8f4ff)', background: 'transparent' }}
            className="flex-1 text-sm outline-none placeholder:text-gray-500"
          />
          {isCommandMode && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#fbbf2420', color: '#fbbf24' }}>
              CMD
            </span>
          )}
          <kbd
            style={{ color: 'var(--cp-text-muted, #888)', background: 'var(--cp-separator-bg, #1a0533)', border: '1px solid var(--cp-border-subtle, #2d1054)' }}
            className="text-xs px-1.5 py-0.5 rounded font-mono"
          >
            ESC
          </kbd>
        </div>

        {/* Recent searches */}
        {!query.trim() && recentSearches.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--cp-divider-accent, #2d1054)' }} className="px-4 py-2 flex items-center gap-2 flex-wrap">
            <span style={{ color: 'var(--cp-text-dim, #555)' }} className="text-xs">Recent:</span>
            {recentSearches.map(s => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-xs px-2 py-0.5 rounded-full transition-colors"
                style={{ background: 'rgba(100,18,166,0.15)', color: '#c084fc' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} id="search-results" role="listbox" aria-label="Search results" className="max-h-[50vh] overflow-y-auto py-2">
          {loading && (
            <div style={{ color: 'var(--cp-text-muted, #888)' }} className="text-sm text-center py-8">
              <div className="animate-spin inline-block w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mb-2" />
              <div>Loading data...</div>
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ color: 'var(--cp-text-muted, #888)' }} className="text-sm text-center py-8">
              <div className="text-2xl mb-2">🔍</div>
              No results for &ldquo;{query}&rdquo;
              {!isCommandMode && <div className="text-xs mt-1">Type <span className="text-yellow-400">&gt;</span> for commands</div>}
            </div>
          )}
          {typeOrder.map(type => {
            const items = grouped[type]
            if (!items) return null
            const cfg = TYPE_CONFIG[type]
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
                  const cmd = type === 'command' ? COMMANDS.find(c => c.id === item.id) : null
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
                      ) : cmd ? (
                        <span className="text-base flex-shrink-0">{cmd.icon}</span>
                      ) : item.avatar ? (
                        <img src={item.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      ) : (
                        <span style={{ color: cfg.color, opacity: 0.5 }} className="flex-shrink-0">{cfg.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {highlightMatch(item.title, isCommandMode ? query.slice(1).trim() : query)}
                          <StatusDot status={item.status} />
                        </div>
                        <div style={{ color: 'var(--cp-text-muted, #666)' }} className="text-xs truncate">
                          {highlightMatch(item.subtitle, isCommandMode ? query.slice(1).trim() : query)}
                        </div>
                      </div>
                      {item.status && type !== 'command' && (
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
          <span className="ml-auto" style={{ color: '#fbbf24' }}>&gt; commands</span>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
