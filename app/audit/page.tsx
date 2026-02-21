'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchAuditLog, fetchAuditStats } from '@/lib/supabase-client'
import type { AuditLogEntry } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import type { ConnectionStatus } from '@/lib/useRealtimeSubscription'
import { DateRangePicker, type DateRange, getPresetDates } from '@/components/DateRangePicker'

const ACTIONS = ['all', 'create', 'update', 'delete'] as const
const ACTION_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  create: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  update: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  delete: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
}
const PAGE_SIZE = 50

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_COLORS[action] || { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }} className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
      {action}
    </span>
  )
}

function ExpandableChanges({ changes }: { changes: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const keys = Object.keys(changes)
  if (keys.length === 0) return <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">—</span>

  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ color: '#a78bfa' }} className="text-xs font-semibold hover:underline">
        {open ? '▾ Hide' : `▸ ${keys.length} field${keys.length !== 1 ? 's' : ''}`}
      </button>
      {open && (
        <pre
          style={{
            background: 'var(--cp-code-bg)',
            border: '1px solid var(--cp-border-strong)',
            color: 'var(--cp-text-secondary)',
          }}
          className="text-xs mt-1 p-2 rounded-lg overflow-x-auto max-h-48 overflow-y-auto"
        >
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}
    </div>
  )
}

function LiveBadge({ status }: { status: ConnectionStatus }) {
  const cfg = status === 'connected'
    ? { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)', color: '#34d399', dot: 'bg-emerald-400', ping: true, label: 'LIVE' }
    : status === 'reconnecting'
    ? { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', color: '#fbbf24', dot: 'bg-amber-400', ping: false, label: 'RECONNECTING' }
    : { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171', dot: 'bg-red-400', ping: false, label: 'OFFLINE' }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span className="relative flex h-2 w-2">
        {cfg.ping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      <span style={{ color: cfg.color }} className="text-xs font-bold tracking-wide">{cfg.label}</span>
    </div>
  )
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const defaultDates = getPresetDates('30d')
  const [dateRange, setDateRange] = useState<DateRange>({ preset: '30d', ...defaultDates })

  // Stats
  const [stats, setStats] = useState({ todayCount: 0, topActor: '—', topEntityType: '—' })

  // Distinct values for filters
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [actors, setActors] = useState<string[]>([])

  const loadData = useCallback(async (p: number) => {
    setLoading(true)
    const [result, statsResult] = await Promise.all([
      fetchAuditLog({
        limit: PAGE_SIZE,
        offset: p * PAGE_SIZE,
        action: actionFilter,
        entity_type: entityFilter,
        actor: actorFilter,
        from: dateRange.from,
        to: dateRange.to,
      }),
      p === 0 ? fetchAuditStats() : Promise.resolve(null),
    ])
    setItems(result.items)
    setTotal(result.total)
    if (statsResult) setStats(statsResult)

    // Collect unique filter values from results
    if (p === 0) {
      const et = new Set<string>()
      const ac = new Set<string>()
      for (const item of result.items) {
        et.add(item.entity_type)
        ac.add(item.actor)
      }
      setEntityTypes(prev => Array.from(new Set([...prev, ...et])))
      setActors(prev => Array.from(new Set([...prev, ...ac])))
    }
    setLoading(false)
  }, [actionFilter, entityFilter, actorFilter, dateRange])

  useEffect(() => {
    setPage(0)
    loadData(0)
  }, [loadData])

  const handleInsert = useCallback((record: Record<string, unknown>) => {
    const entry = record as unknown as AuditLogEntry
    setItems(prev => [entry, ...prev.slice(0, PAGE_SIZE - 1)])
    setTotal(prev => prev + 1)
    setStats(prev => ({ ...prev, todayCount: prev.todayCount + 1 }))
  }, [])

  const { connectionStatus } = useRealtimeSubscription([
    { table: 'audit_log', event: 'INSERT', onInsert: handleInsert as (record: Record<string, unknown>) => void },
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const goToPage = (p: number) => {
    setPage(p)
    loadData(p)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1 font-medium">
            Track all mutations across the system
            {total > 0 && <span style={{ color: '#a78bfa' }} className="ml-2 font-bold">· {total.toLocaleString()} entries</span>}
          </p>
        </div>
        <LiveBadge status={connectionStatus} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Changes Today', value: stats.todayCount.toString(), color: '#34d399' },
          { label: 'Most Active Actor', value: stats.topActor, color: '#818cf8' },
          { label: 'Most Changed Entity', value: stats.topEntityType, color: '#f59e0b' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background: 'var(--cp-card-bg)',
              border: '1px solid var(--cp-border)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-4"
          >
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider mb-1">{s.label}</div>
            <div style={{ color: s.color }} className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl p-4 mb-6 space-y-3"
      >
        {/* Action filter */}
        <div className="flex flex-wrap gap-2">
          <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold self-center mr-1">Action:</span>
          {ACTIONS.map(a => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              style={{
                background: actionFilter === a ? (a === 'all' ? 'rgba(124,58,237,0.18)' : ACTION_COLORS[a]?.bg || 'rgba(124,58,237,0.18)') : 'rgba(255,255,255,0.04)',
                border: actionFilter === a ? `1px solid ${a === 'all' ? 'rgba(139,92,246,0.4)' : ACTION_COLORS[a]?.border || 'rgba(139,92,246,0.4)'}` : '1px solid rgba(255,255,255,0.07)',
                color: actionFilter === a ? (a === 'all' ? '#c4b5fd' : ACTION_COLORS[a]?.color || '#c4b5fd') : '#6b7280',
              }}
              className="px-3 py-1 rounded-lg text-xs font-semibold capitalize"
            >
              {a}
            </button>
          ))}
        </div>

        {/* Entity type & actor filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold">Entity:</span>
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              style={{
                background: 'var(--cp-code-bg)',
                border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)',
              }}
              className="rounded-lg px-2 py-1 text-xs outline-none"
            >
              <option value="all">All</option>
              {entityTypes.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold">Actor:</span>
            <select
              value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              style={{
                background: 'var(--cp-code-bg)',
                border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)',
              }}
              className="rounded-lg px-2 py-1 text-xs outline-none"
            >
              <option value="all">All</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <DateRangePicker onChange={(r: DateRange) => setDateRange(r)} />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl overflow-hidden"
      >
        {/* Header row */}
        <div
          style={{ borderBottom: '1px solid rgba(109,40,217,0.15)', background: 'rgba(109,40,217,0.05)' }}
          className="hidden sm:grid grid-cols-[140px_80px_100px_1fr_100px_1fr] gap-3 px-5 py-3"
        >
          {['Time', 'Action', 'Entity', 'Entity ID', 'Actor', 'Changes'].map(h => (
            <div key={h} style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-bold uppercase tracking-wider">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Loading…</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">No audit entries found</div>
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.id}
              style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              className="sm:grid grid-cols-[140px_80px_100px_1fr_100px_1fr] gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Time */}
              <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-mono">
                {new Date(item.created_at).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              {/* Action */}
              <div><ActionBadge action={item.action} /></div>
              {/* Entity Type */}
              <div style={{ color: '#c4b5fd' }} className="text-xs font-semibold capitalize">{item.entity_type}</div>
              {/* Entity ID */}
              <div style={{ color: 'var(--cp-text-secondary)' }} className="text-xs font-mono truncate" title={item.entity_id}>
                {item.entity_id.length > 20 ? item.entity_id.slice(0, 8) + '…' + item.entity_id.slice(-8) : item.entity_id}
              </div>
              {/* Actor */}
              <div style={{ color: '#818cf8' }} className="text-xs font-semibold">{item.actor}</div>
              {/* Changes */}
              <div><ExpandableChanges changes={item.changes || {}} /></div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">
            Page {page + 1} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              style={{
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#c4b5fd',
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              style={{
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#c4b5fd',
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
