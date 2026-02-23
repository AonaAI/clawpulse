'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchErrors, fetchErrorStats, supabase } from '@/lib/supabase-client'
import type { ErrorEntry } from '@/lib/supabase-client'

// ── Error classification ───────────────────────────────────────────────────

type ErrorType = 'OOM' | 'Timeout' | 'Rate Limit' | 'Auth' | 'API Error' | 'Network' | 'Unknown'
type Severity = 'critical' | 'warning' | 'info'

const ALL_ERROR_TYPES: ErrorType[] = ['OOM', 'Timeout', 'Rate Limit', 'Auth', 'API Error', 'Network', 'Unknown']

function classifyError(action: string, details: string): ErrorType {
  const text = (action + ' ' + details).toLowerCase()
  if (text.includes('oom') || text.includes('out of memory')) return 'OOM'
  if (text.includes('timeout') || text.includes('timed out') || text.includes('deadline')) return 'Timeout'
  if (text.includes('rate limit') || text.includes('429') || text.includes('too many requests')) return 'Rate Limit'
  if (text.includes('auth') || text.includes('401') || text.includes('403') || text.includes('unauthorized') || text.includes('forbidden')) return 'Auth'
  if (text.includes('network') || text.includes('econnrefused') || text.includes('enotfound') || text.includes('dns') || text.includes('socket') || text.includes('connection refused')) return 'Network'
  if (text.includes('500') || text.includes('api') || text.includes('502') || text.includes('503')) return 'API Error'
  return 'Unknown'
}

function getSeverity(type: ErrorType): Severity {
  if (type === 'OOM' || type === 'Auth') return 'critical'
  if (type === 'Timeout' || type === 'Rate Limit' || type === 'API Error' || type === 'Network') return 'warning'
  return 'info'
}

const ERROR_TYPE_CONFIG: Record<ErrorType, { color: string; bg: string; border: string }> = {
  'OOM':        { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  'Timeout':    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)'  },
  'Rate Limit': { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
  'Auth':       { color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  'API Error':  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
  'Network':    { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.35)' },
  'Unknown':    { color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)' },
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', label: 'Critical' },
  warning:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  label: 'Warning'  },
  info:     { color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', label: 'Info'     },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

function getInitials(name: string): string {
  return name.split(/[\s-_]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ErrorTypeBadge({ type }: { type: ErrorType }) {
  const cfg = ERROR_TYPE_CONFIG[type]
  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap"
    >
      {type}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity]
  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize whitespace-nowrap"
    >
      {cfg.label}
    </span>
  )
}

function AgentAvatar({ name }: { name: string }) {
  return (
    <div
      style={{
        background: 'rgba(109,40,217,0.15)',
        border: '1px solid rgba(139,92,246,0.2)',
        color: 'var(--cp-text-accent-light)',
        width: 28, height: 28, minWidth: 28,
        fontSize: 10, fontWeight: 700,
      }}
      className="rounded-lg flex items-center justify-center flex-shrink-0"
    >
      {getInitials(name)}
    </div>
  )
}

// ── Error Trend Chart (CSS-only) ───────────────────────────────────────────

function ErrorTrendChart({ items }: { items: ErrorEntry[] }) {
  // Build 24 hourly buckets
  const now = Date.now()
  const buckets = new Array(24).fill(0)
  for (const item of items) {
    const hoursAgo = Math.floor((now - new Date(item.created_at).getTime()) / 3_600_000)
    if (hoursAgo >= 0 && hoursAgo < 24) {
      buckets[23 - hoursAgo]++
    }
  }
  const max = Math.max(...buckets, 1)

  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
      className="rounded-xl p-4 mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-bold uppercase tracking-wider">
          Errors per hour (last 24h)
        </div>
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">
          Peak: {max} errors/hr
        </div>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 64 }}>
        {buckets.map((count, i) => {
          const pct = (count / max) * 100
          const isRecent = i >= 21
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all relative group"
              style={{
                height: `${Math.max(pct, 2)}%`,
                background: count === 0
                  ? 'rgba(148,163,184,0.1)'
                  : isRecent
                    ? 'rgba(248,113,113,0.6)'
                    : 'rgba(248,113,113,0.3)',
                minWidth: 2,
              }}
              title={`${23 - i}h ago: ${count} error${count !== 1 ? 's' : ''}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }}>24h ago</span>
        <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }}>now</span>
      </div>
    </div>
  )
}

// ── Error Card with Collapsible Details ────────────────────────────────────

function ErrorCard({
  entry,
  isExpanded,
  onToggle,
  onDismiss,
  onResolve,
}: {
  entry: ErrorEntry
  isExpanded: boolean
  onToggle: () => void
  onDismiss: () => void
  onResolve: () => void
}) {
  const type = classifyError(entry.action, entry.details)
  const severity = getSeverity(type)
  const typeCfg = ERROR_TYPE_CONFIG[type]
  const message = entry.details || entry.action
  const truncated = message.length > 120 ? message.slice(0, 120) + '…' : message

  const stackTrace = entry.metadata?.stack_trace as string | undefined
    || entry.metadata?.traceback as string | undefined
    || entry.metadata?.error_stack as string | undefined

  return (
    <div
      style={{
        background: isExpanded ? `rgba(${type === 'OOM' || type === 'Auth' ? '248,113,113' : type === 'Network' ? '244,114,182' : '251,191,36'},0.03)` : 'transparent',
        borderLeft: `3px solid ${typeCfg.color}`,
        borderBottom: '1px solid var(--cp-input-bg)',
        transition: 'all 0.15s',
      }}
      className="group"
    >
      {/* Main row */}
      <div
        onClick={onToggle}
        className="hover:bg-white/[0.02] cursor-pointer px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <AgentAvatar name={entry.agent_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">{entry.agent_name}</span>
              <ErrorTypeBadge type={type} />
              <SeverityBadge severity={severity} />
              <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs ml-auto whitespace-nowrap">
                {timeAgo(entry.created_at)}
              </span>
            </div>
            <div
              style={{ color: 'var(--cp-text-secondary)', fontSize: 13, lineHeight: 1.5 }}
              className="break-words"
            >
              {isExpanded ? message : truncated}
            </div>
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-mono mt-1">
              {formatTimestamp(entry.created_at)}
            </div>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{
              color: 'var(--cp-text-dim)',
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Collapsible details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 ml-10">
          {/* Stack trace / metadata */}
          {stackTrace && (
            <div className="mb-3">
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Stack Trace
              </div>
              <pre
                style={{
                  background: 'var(--cp-code-bg)',
                  border: '1px solid rgba(109,40,217,0.15)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 11,
                  color: 'var(--cp-text-secondary)',
                  overflow: 'auto',
                  maxHeight: 200,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {stackTrace}
              </pre>
            </div>
          )}

          {Object.keys(entry.metadata).length > 0 && !stackTrace && (
            <div className="mb-3">
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Details
              </div>
              <pre
                style={{
                  background: 'var(--cp-code-bg)',
                  border: '1px solid rgba(109,40,217,0.15)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 11,
                  color: 'var(--cp-text-secondary)',
                  overflow: 'auto',
                  maxHeight: 160,
                }}
              >
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Context row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {[
              { label: 'Agent', value: entry.agent_name },
              { label: 'Type', value: type },
              { label: 'Severity', value: SEVERITY_CONFIG[severity].label },
              { label: 'Session', value: entry.session_id ? entry.session_id.slice(0, 12) + '…' : '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss() }}
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--cp-text-secondary)' }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/[0.08] transition-all"
            >
              Dismiss
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onResolve() }}
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-all"
            >
              Mark Resolved
            </button>
            {entry.session_id && (
              <Link
                href={`/sessions/${entry.session_id}`}
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)' }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-purple-500/20 transition-all inline-flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                View Session
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function ErrorsPage() {
  const [items, setItems] = useState<ErrorEntry[]>([])
  const [allItems, setAllItems] = useState<ErrorEntry[]>([]) // unfiltered for chart
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<Set<string>>(new Set())

  // Stats
  const [stats, setStats] = useState({
    totalLast24h: 0,
    criticalCount: 0,
    totalSessions24h: 0,
    mostAffectedAgent: '—',
    mostCommonType: '—',
    prevDayErrors: 0,
  })

  // Filters
  const [agentFilter, setAgentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<ErrorType | 'all'>('all')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])

  // Load agent list
  useEffect(() => {
    supabase.from('agents').select('id, name').order('name').then(({ data }) => {
      if (data) setAgents(data)
    })
  }, [])

  const loadData = useCallback(async (reset: boolean) => {
    const currentOffset = reset ? 0 : offset
    if (reset) { setLoading(true); setExpandedId(null) }
    else setLoadingMore(true)

    const [result, statsResult, chartResult] = await Promise.all([
      fetchErrors({
        limit: PAGE_SIZE,
        offset: currentOffset,
        agentId: agentFilter !== 'all' ? agentFilter : undefined,
      }),
      reset ? fetchErrorStats() : Promise.resolve(null),
      reset ? fetchErrors({ limit: 500 }) : Promise.resolve(null), // for chart
    ])

    const filtered = typeFilter !== 'all'
      ? result.items.filter(e => classifyError(e.action, e.details) === typeFilter)
      : result.items

    if (reset) {
      setItems(filtered)
      setOffset(PAGE_SIZE)
      if (chartResult) setAllItems(chartResult.items)
    } else {
      setItems(prev => [...prev, ...filtered])
      setOffset(prev => prev + PAGE_SIZE)
    }
    setTotal(result.total)
    if (statsResult) {
      // Count critical errors
      const criticalCount = (chartResult?.items || []).filter(e => {
        const type = classifyError(e.action, e.details)
        return getSeverity(type) === 'critical'
      }).length
      setStats({ ...statsResult, criticalCount, prevDayErrors: 0 })
    }
    setLoading(false)
    setLoadingMore(false)
  }, [agentFilter, typeFilter, offset])

  useEffect(() => {
    setOffset(0)
    loadData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, typeFilter])

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id))
    setExpandedId(null)
  }

  const handleResolve = (id: string) => {
    setResolved(prev => new Set(prev).add(id))
    setExpandedId(null)
  }

  const visibleItems = items.filter(e => !dismissed.has(e.id) && !resolved.has(e.id))
  const trendUp = stats.totalLast24h > stats.prevDayErrors

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
          Errors
        </h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
          Agent error tracking &amp; classification
          {total > 0 && <span style={{ color: '#f87171' }} className="ml-2 font-bold">· {total.toLocaleString()} errors found</span>}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Errors (24h)',
            value: loading ? '…' : stats.totalLast24h.toString(),
            color: '#f87171',
            extra: trendUp ? '↑' : '↓',
            extraColor: trendUp ? '#f87171' : '#34d399',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ),
          },
          {
            label: 'Critical',
            value: loading ? '…' : stats.criticalCount.toString(),
            color: '#ef4444',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ),
          },
          {
            label: 'Most Affected Agent',
            value: loading ? '…' : stats.mostAffectedAgent,
            color: 'var(--cp-text-accent-light)',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
            ),
          },
          {
            label: 'Error Rate',
            value: loading ? '…' : `${stats.totalSessions24h}%`,
            color: '#fb923c',
            extra: trendUp ? '↑' : '↓',
            extraColor: trendUp ? '#fb923c' : '#34d399',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            ),
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'var(--cp-card-bg)',
              border: '1px solid var(--cp-border)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: card.color, opacity: 0.7 }}>{card.icon}</span>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">{card.label}</div>
            </div>
            <div className="flex items-baseline gap-2">
              <div style={{ color: card.color }} className="text-2xl font-bold truncate">{card.value}</div>
              {'extra' in card && card.extra && (
                <span style={{ color: card.extraColor, fontSize: 14, fontWeight: 700 }}>{card.extra}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error Trend Chart */}
      {!loading && allItems.length > 0 && (
        <ErrorTrendChart items={allItems} />
      )}

      {/* Filters */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-dim)', flexShrink: 0 }}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)' }}
          className="rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-500"
        >
          <option value="all">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {/* Error type filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            style={{
              background: typeFilter === 'all' ? 'rgba(124,58,237,0.18)' : 'var(--cp-input-bg)',
              border: typeFilter === 'all' ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--cp-border-subtle)',
              color: typeFilter === 'all' ? '#c4b5fd' : '#6b7280',
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold"
          >
            All
          </button>
          {ALL_ERROR_TYPES.map(type => {
            const cfg = ERROR_TYPE_CONFIG[type]
            const active = typeFilter === type
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  background: active ? cfg.bg : 'var(--cp-input-bg)',
                  border: active ? `1px solid ${cfg.border}` : '1px solid var(--cp-border-subtle)',
                  color: active ? cfg.color : '#6b7280',
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
              >
                {type}
              </button>
            )
          })}
        </div>

        <div style={{ color: 'var(--cp-text-dim)', marginLeft: 'auto', fontSize: 12 }}>
          {loading ? 'Loading…' : `${visibleItems.length} of ${total}`}
          {(dismissed.size > 0 || resolved.size > 0) && (
            <span className="ml-2">
              ({dismissed.size + resolved.size} hidden)
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-12 text-center">
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Scanning for errors…</div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-16 text-center"
        >
          <div className="flex justify-center mb-4">
            <div
              style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.2)',
                width: 64, height: 64, borderRadius: 16,
              }}
              className="flex items-center justify-center"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold mb-2">
            {dismissed.size + resolved.size > 0
              ? 'All errors have been addressed 🎉'
              : 'No errors detected — your agents are running smoothly 🎉'}
          </div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm max-w-sm mx-auto">
            Errors will appear here when agent activity logs contain error, failure, or exception signals.
          </div>
        </div>
      ) : (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl overflow-hidden"
        >
          {visibleItems.map(entry => (
            <ErrorCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
              onDismiss={() => handleDismiss(entry.id)}
              onResolve={() => handleResolve(entry.id)}
            />
          ))}

          {/* Load more */}
          {items.length < total && (
            <div style={{ borderTop: '1px solid rgba(109,40,217,0.1)' }} className="px-5 py-4 flex justify-center">
              <button
                onClick={() => loadData(false)}
                disabled={loadingMore}
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)' }}
                className="px-6 py-2 rounded-xl text-sm font-semibold hover:bg-purple-500/20 disabled:opacity-50 transition-all"
              >
                {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
