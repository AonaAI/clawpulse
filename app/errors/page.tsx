'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchErrors, fetchErrorStats, supabase } from '@/lib/supabase-client'
import type { ErrorEntry } from '@/lib/supabase-client'

// ── Error classification ───────────────────────────────────────────────────

type ErrorType = 'OOM' | 'Timeout' | 'Rate Limit' | 'Auth' | 'API Error' | 'Unknown'
type Severity = 'critical' | 'warning' | 'info'

const ALL_ERROR_TYPES: ErrorType[] = ['OOM', 'Timeout', 'Rate Limit', 'Auth', 'API Error', 'Unknown']

function classifyError(action: string, details: string): ErrorType {
  const text = (action + ' ' + details).toLowerCase()
  if (text.includes('oom') || text.includes('out of memory')) return 'OOM'
  if (text.includes('timeout') || text.includes('timed out')) return 'Timeout'
  if (text.includes('rate limit') || text.includes('429')) return 'Rate Limit'
  if (text.includes('auth') || text.includes('401') || text.includes('403')) return 'Auth'
  if (text.includes('500') || text.includes('api')) return 'API Error'
  return 'Unknown'
}

function getSeverity(type: ErrorType): Severity {
  if (type === 'OOM' || type === 'Auth') return 'critical'
  if (type === 'Timeout' || type === 'Rate Limit' || type === 'API Error') return 'warning'
  return 'info'
}

const ERROR_TYPE_CONFIG: Record<ErrorType, { color: string; bg: string; border: string }> = {
  'OOM':        { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  'Timeout':    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)'  },
  'Rate Limit': { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
  'Auth':       { color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  'API Error':  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
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

// ── Error Detail Panel ─────────────────────────────────────────────────────

function ErrorDetailPanel({ entry, onClose }: { entry: ErrorEntry; onClose: () => void }) {
  const type = classifyError(entry.action, entry.details)
  const severity = getSeverity(type)
  const typeCfg = ERROR_TYPE_CONFIG[type]
  const severityCfg = SEVERITY_CONFIG[severity]

  const stackTrace = entry.metadata?.stack_trace as string | undefined
    || entry.metadata?.traceback as string | undefined
    || entry.metadata?.error_stack as string | undefined

  return (
    <div
      style={{
        background: 'var(--cp-card-solid-bg)',
        border: `1px solid ${typeCfg.border}`,
        backdropFilter: 'blur(16px)',
        borderRadius: 14,
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--cp-divider-accent)' }} className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <AgentAvatar name={entry.agent_name} />
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-sm">{entry.agent_name}</span>
            <ErrorTypeBadge type={type} />
            <SeverityBadge severity={severity} />
          </div>
          <div style={{ color: 'var(--cp-text-secondary)', fontSize: 13, fontWeight: 500 }}>{entry.action}</div>
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-0.5 font-mono">
            {formatTimestamp(entry.created_at)}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--cp-text-dim)', flexShrink: 0 }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* Error message */}
        {entry.details && (
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Error Message
            </div>
            <div
              style={{
                background: 'rgba(248,113,113,0.05)',
                border: '1px solid rgba(248,113,113,0.18)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {entry.details}
            </div>
          </div>
        )}

        {/* Stack trace */}
        {stackTrace && (
          <div>
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

        {/* Session context */}
        <div>
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Session Context
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Agent', value: entry.agent_name },
              { label: 'Error Type', value: type },
              { label: 'Severity', value: severityCfg.label },
              { label: 'Session ID', value: entry.session_id ? entry.session_id.slice(0, 16) + '…' : '—' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata (if any extra keys) */}
        {Object.keys(entry.metadata).length > 0 && !stackTrace && (
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Metadata
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
      </div>

      {/* Footer */}
      {entry.session_id && (
        <div style={{ borderTop: '1px solid rgba(109,40,217,0.1)' }} className="px-5 py-3 flex justify-end">
          <Link
            href="/sessions"
            style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--cp-text-accent-light)',
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-500/20 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            View Session
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function ErrorsPage() {
  const [items, setItems] = useState<ErrorEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ErrorEntry | null>(null)

  // Stats
  const [stats, setStats] = useState({
    totalLast24h: 0,
    totalSessions24h: 0,
    mostAffectedAgent: '—',
    mostCommonType: '—',
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
    if (reset) { setLoading(true); setSelectedEntry(null) }
    else setLoadingMore(true)

    const [result, statsResult] = await Promise.all([
      fetchErrors({
        limit: PAGE_SIZE,
        offset: currentOffset,
        agentId: agentFilter !== 'all' ? agentFilter : undefined,
      }),
      reset ? fetchErrorStats() : Promise.resolve(null),
    ])

    const filtered = typeFilter !== 'all'
      ? result.items.filter(e => classifyError(e.action, e.details) === typeFilter)
      : result.items

    if (reset) {
      setItems(filtered)
      setOffset(PAGE_SIZE)
    } else {
      setItems(prev => [...prev, ...filtered])
      setOffset(prev => prev + PAGE_SIZE)
    }
    setTotal(result.total)
    if (statsResult) setStats(statsResult)
    setLoading(false)
    setLoadingMore(false)
  }, [agentFilter, typeFilter, offset])

  useEffect(() => {
    setOffset(0)
    loadData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, typeFilter])

  const handleRowClick = (entry: ErrorEntry) => {
    setSelectedEntry(prev => prev?.id === entry.id ? null : entry)
  }

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
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ),
          },
          {
            label: 'Error Rate',
            value: loading ? '…' : `${stats.totalSessions24h}%`,
            color: '#fb923c',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                <line x1="2" y1="20" x2="22" y2="20" />
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
                <path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.85" />
              </svg>
            ),
          },
          {
            label: 'Most Common Type',
            value: loading ? '…' : stats.mostCommonType,
            color: '#fbbf24',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
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
            <div style={{ color: card.color }} className="text-2xl font-bold truncate">{card.value}</div>
          </div>
        ))}
      </div>

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
          {loading ? 'Loading…' : `${items.length} of ${total}`}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-12 text-center">
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Scanning for errors…</div>
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
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
            No errors detected — your agents are running smoothly 🎉
          </div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm max-w-sm mx-auto">
            Errors will appear here when agent activity logs contain error, failure, or exception signals.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table */}
          <div
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div
              style={{ borderBottom: '1px solid var(--cp-divider-accent)', background: 'rgba(109,40,217,0.04)' }}
              className="hidden md:grid grid-cols-[140px_160px_120px_1fr_90px_80px] gap-3 px-5 py-3"
            >
              {['Timestamp', 'Agent', 'Error Type', 'Message', 'Session', 'Severity'].map(h => (
                <div key={h} style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-bold uppercase tracking-wider">{h}</div>
              ))}
            </div>

            {/* Rows */}
            {items.map((entry, idx) => {
              const type = classifyError(entry.action, entry.details)
              const severity = getSeverity(type)
              const typeCfg = ERROR_TYPE_CONFIG[type]
              const isSelected = selectedEntry?.id === entry.id
              const message = entry.details || entry.action
              const truncated = message.length > 80 ? message.slice(0, 80) + '…' : message

              return (
                <div key={entry.id}>
                  <div
                    onClick={() => handleRowClick(entry)}
                    style={{
                      borderBottom: idx < items.length - 1 && !isSelected ? '1px solid var(--cp-input-bg)' : 'none',
                      cursor: 'pointer',
                      background: isSelected ? `rgba(${type === 'OOM' ? '248,113,113' : type === 'Timeout' ? '251,146,60' : type === 'Rate Limit' ? '251,191,36' : type === 'Auth' ? '167,139,250' : type === 'API Error' ? '96,165,250' : '148,163,184'},0.05)` : 'transparent',
                      borderLeft: isSelected ? `2px solid ${typeCfg.color}` : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    className="group hover:bg-white/[0.02] md:grid grid-cols-[140px_160px_120px_1fr_90px_80px] gap-3 px-5 py-3 flex flex-col"
                  >
                    {/* Timestamp */}
                    <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-mono hidden md:block">
                      {formatTimestamp(entry.created_at)}
                    </div>

                    {/* Mobile: timestamp + agent row */}
                    <div className="flex items-center justify-between md:hidden mb-1.5">
                      <div className="flex items-center gap-2">
                        <AgentAvatar name={entry.agent_name} />
                        <span style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">{entry.agent_name}</span>
                      </div>
                      <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-mono">
                        {formatTimestamp(entry.created_at)}
                      </span>
                    </div>

                    {/* Agent (desktop) */}
                    <div className="hidden md:flex items-center gap-2">
                      <AgentAvatar name={entry.agent_name} />
                      <span style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold truncate">{entry.agent_name}</span>
                    </div>

                    {/* Error type */}
                    <div className="flex items-center md:block">
                      <ErrorTypeBadge type={type} />
                    </div>

                    {/* Message */}
                    <div
                      style={{ color: 'var(--cp-text-secondary)', fontSize: 13, lineHeight: 1.5 }}
                      title={message}
                      className="truncate"
                    >
                      {truncated}
                    </div>

                    {/* Session link */}
                    <div className="hidden md:flex items-center">
                      {entry.session_id ? (
                        <Link
                          href="/sessions"
                          onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--cp-text-accent-light)', fontSize: 11, fontFamily: 'monospace' }}
                          className="hover:underline truncate"
                        >
                          {entry.session_id.slice(0, 10) + '…'}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>—</span>
                      )}
                    </div>

                    {/* Severity */}
                    <div className="flex items-center justify-between md:justify-start gap-2">
                      <SeverityBadge severity={severity} />
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{
                          color: isSelected ? typeCfg.color : 'var(--cp-text-dim)',
                          transform: isSelected ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s, opacity 0.15s',
                          opacity: isSelected ? 1 : 0,
                          flexShrink: 0,
                        }}
                        className="group-hover:opacity-60"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>

                  {/* Inline detail panel */}
                  {isSelected && (
                    <div className="px-3 pb-3" style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--cp-input-bg)' : 'none' }}>
                      <ErrorDetailPanel entry={entry} onClose={() => setSelectedEntry(null)} />
                    </div>
                  )}
                </div>
              )
            })}

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
        </div>
      )}
    </div>
  )
}
