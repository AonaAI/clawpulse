'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchAllSessions, fetchSessionTrace } from '@/lib/supabase-client'
import { supabase } from '@/lib/supabase-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  agent_id: string
  agent_name: string
  session_key: string
  kind: string
  status: string
  started_at: string
  last_active: string | null
  model: string | null
  token_count: number
  duration_minutes: number | null
  cost_usd: number
}

interface TraceEvent {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
}

type SortField = 'started_at' | 'last_active' | 'token_count'
type SortDir = 'asc' | 'desc'

// ── Event type detection & config ─────────────────────────────────────────────

type TraceEventType = 'tool_call' | 'message' | 'error' | 'system' | 'task' | 'other'

function detectType(action: string): TraceEventType {
  const a = action.toLowerCase()
  if (a.includes('error') || a.includes('fail') || a.includes('crash')) return 'error'
  if (a.includes('tool') || a.includes('function') || a.includes('invoke') || a.includes('call') || a.includes('bash') || a.includes('read') || a.includes('write') || a.includes('edit') || a.includes('glob') || a.includes('grep')) return 'tool_call'
  if (a.includes('message') || a.includes('slack') || a.includes('send') || a.includes('notify') || a.includes('comm') || a.includes('user')) return 'message'
  if (a.includes('system') || a.includes('cron') || a.includes('heartbeat') || a.includes('schedule') || a.includes('start') || a.includes('session') || a.includes('done')) return 'system'
  if (a.includes('task') || a.includes('complet') || a.includes('finish')) return 'task'
  return 'other'
}

const TYPE_CONFIG: Record<TraceEventType, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  tool_call: {
    color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', label: 'Tool Call',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  },
  message: {
    color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', label: 'Message',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  error: {
    color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', label: 'Error',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  },
  system: {
    color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', label: 'System',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  },
  task: {
    color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.3)', label: 'Task',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  },
  other: {
    color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: 'Event',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Active' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatFullDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—'
  if (minutes === 0) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatDeltaMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── SortIcon ──────────────────────────────────────────────────────────────────

function SortIcon({ field, current, dir }: { field: string; current: string; dir: SortDir }) {
  if (field !== current) return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
      <path d="M12 5v14M5 12l7-7 7 7" />
    </svg>
  )
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-accent-light)' }}>
      {dir === 'asc' ? <path d="M12 5v14M5 12l7-7 7 7" /> : <path d="M12 19V5M5 12l7 7 7-7" />}
    </svg>
  )
}

// ── TraceEventCard ────────────────────────────────────────────────────────────

function TraceCard({
  event,
  prevTime,
  totalMs,
  isFirst,
  isLast,
}: {
  event: TraceEvent
  prevTime: string | null
  totalMs: number
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const type = detectType(event.action)
  const cfg = TYPE_CONFIG[type]
  const hasDetails = !!(event.details || Object.keys(event.metadata).length > 0)

  const deltaMs = prevTime ? (new Date(event.created_at).getTime() - new Date(prevTime).getTime()) : 0
  const barWidth = totalMs > 0 ? Math.max(2, Math.min(100, (deltaMs / totalMs) * 100)) : 0

  return (
    <div className="flex items-start gap-0 relative" style={{ minHeight: 44 }}>
      {/* Timestamp */}
      <div
        style={{ color: 'var(--cp-text-dim)', width: 68, flexShrink: 0, textAlign: 'right', paddingRight: 8, paddingTop: 9 }}
        className="text-xs font-mono"
      >
        {formatTime(event.created_at)}
      </div>

      {/* Dot + line */}
      <div style={{ width: 22, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 2, height: isFirst ? 8 : 10, background: isFirst ? 'transparent' : 'rgba(109,40,217,0.2)', flexShrink: 0 }} />
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.color, border: '2px solid var(--background)', boxShadow: `0 0 5px ${cfg.color}55`, flexShrink: 0 }} />
        {!isLast && <div style={{ width: 2, flex: 1, background: 'rgba(109,40,217,0.2)', minHeight: 14, flexShrink: 0 }} />}
      </div>

      {/* Card */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4, paddingLeft: 8, paddingTop: 3, minWidth: 0 }}>
        <div
          onClick={() => hasDetails && setExpanded(e => !e)}
          style={{
            background: expanded ? cfg.bg : 'rgba(255,255,255,0.015)',
            border: `1px solid ${expanded ? cfg.border : 'rgba(109,40,217,0.08)'}`,
            borderRadius: 8,
            cursor: hasDetails ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
          className={hasDetails ? 'hover:bg-white/[0.025] hover:border-purple-600/20' : ''}
        >
          <div className="px-3 py-2">
            {/* Top row */}
            <div className="flex items-center gap-2 mb-0.5">
              <span
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 6px', borderRadius: 5, fontWeight: 700, flexShrink: 0 }}
              >
                {cfg.icon}
                {cfg.label}
              </span>
              {!isFirst && deltaMs > 0 && (
                <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="font-mono">
                  +{formatDeltaMs(deltaMs)}
                </span>
              )}
              {hasDetails && (
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: 'var(--cp-text-dim)', marginLeft: 'auto', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
            {/* Action */}
            <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>
              {event.action}
            </div>
            {/* Duration bar */}
            {!isFirst && totalMs > 0 && (
              <div className="mt-1.5" style={{ height: 2, background: 'var(--cp-separator-bg)', borderRadius: 2 }}>
                <div style={{ width: `${barWidth}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.color}50, ${cfg.color})`, borderRadius: 2 }} />
              </div>
            )}
          </div>

          {/* Expanded */}
          {expanded && hasDetails && (
            <div style={{ borderTop: `1px solid ${cfg.border}`, background: 'var(--cp-code-bg)', borderRadius: '0 0 7px 7px' }} className="px-3 py-2 space-y-2">
              {event.details && (
                <div>
                  <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Details</div>
                  <p style={{ color: 'var(--cp-text-secondary)', fontSize: 12, lineHeight: 1.6 }} className="whitespace-pre-wrap">{event.details}</p>
                </div>
              )}
              {Object.keys(event.metadata).length > 0 && (
                <div>
                  <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Metadata</div>
                  <pre style={{ background: 'var(--cp-code-bg)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--cp-text-secondary)', overflow: 'auto', maxHeight: 180 }}>
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Session Trace Panel ───────────────────────────────────────────────────────

function SessionSidePanel({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionTrace(session.id).then(data => {
      setTrace(data)
      setLoading(false)
    })
  }, [session.id])

  const statusCfg = STATUS_CONFIG[session.status] ?? { color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: session.status }
  const totalMs = session.last_active && session.started_at
    ? new Date(session.last_active).getTime() - new Date(session.started_at).getTime()
    : 0

  const typeCounts = trace.reduce<Record<string, number>>((acc, e) => {
    const t = detectType(e.action)
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
      />
      <div
        style={{
          background: 'var(--cp-card-solid-bg)',
          borderLeft: '1px solid var(--cp-border-stronger)',
          backdropFilter: 'blur(16px)',
        }}
        className="fixed top-0 right-0 z-50 h-full w-full md:w-[450px] overflow-y-auto shadow-2xl animate-slide-in-right"
      >
      {/* Panel header */}
      <div
        style={{ borderBottom: '1px solid var(--cp-divider-accent)', background: 'var(--cp-card-solid-bg)' }}
        className="px-5 py-4 flex items-start justify-between gap-3 sticky top-0 z-10"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div
              style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 28, height: 28, minWidth: 28, fontSize: 10, fontWeight: 700 }}
              className="rounded-lg flex items-center justify-center flex-shrink-0"
            >
              {getInitials(session.agent_name)}
            </div>
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-sm">{session.agent_name}</span>
            <span
              style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }}
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
            >
              {statusCfg.label}
            </span>
          </div>
          <code
            style={{ fontSize: 11, color: 'var(--cp-text-accent-light)', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', padding: '1px 8px', borderRadius: 5, display: 'inline-block' }}
          >
            {session.session_key}
          </code>
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

      {/* Session stats */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ borderBottom: '1px solid rgba(109,40,217,0.08)' }}>
        {[
          { label: 'Started', value: formatFullDate(session.started_at) },
          { label: 'Duration', value: formatDuration(session.duration_minutes) },
          { label: 'Tokens', value: formatTokens(session.token_count) },
          { label: 'Events', value: loading ? '…' : trace.length.toString() },
        ].map(s => (
          <div key={s.label}>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Type breakdown */}
      {!loading && Object.keys(typeCounts).length > 0 && (
        <div className="px-5 py-2.5 flex flex-wrap gap-1.5" style={{ borderBottom: '1px solid rgba(109,40,217,0.08)' }}>
          {(Object.entries(typeCounts) as [TraceEventType, number][]).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type]
            return (
              <span
                key={type}
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}
              >
                {cfg.icon}
                {cfg.label}
                <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0 4px', fontSize: 10, fontWeight: 800 }}>{count}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Trace body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton-shimmer" style={{ width: 60, height: 12, borderRadius: 4 }} />
                <div className="skeleton-shimmer" style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 1 }} />
                <div className="skeleton-shimmer flex-1" style={{ height: 50, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ) : trace.length === 0 ? (
          <div className="text-center py-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 10px' }}>
              <line x1="12" y1="2" x2="12" y2="22" />
              <circle cx="12" cy="6" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="18" r="2" />
              <line x1="14" y1="6" x2="20" y2="6" /><line x1="14" y1="12" x2="20" y2="12" /><line x1="14" y1="18" x2="20" y2="18" />
            </svg>
            <div style={{ color: 'var(--cp-text-muted)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>No trace events</div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
              Detailed traces are logged when agents link activity events to this session via <code style={{ background: 'rgba(109,40,217,0.1)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>session_id</code>.
            </div>
            <div
              style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 8, padding: '8px 14px', marginTop: 12, display: 'inline-block' }}
            >
              <span style={{ color: 'var(--cp-text-accent-light)', fontSize: 12, fontWeight: 600 }}>Detailed traces coming soon</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical guide line */}
            <div
              style={{
                position: 'absolute',
                left: 78,
                top: 14,
                bottom: 6,
                width: 2,
                background: 'linear-gradient(180deg, var(--cp-border-stronger) 0%, rgba(109,40,217,0.04) 100%)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Waterfall — {trace.length} event{trace.length !== 1 ? 's' : ''}
            </div>
            {trace.map((event, idx) => (
              <TraceCard
                key={event.id}
                event={event}
                prevTime={idx === 0 ? null : trace[idx - 1].created_at}
                totalMs={totalMs}
                isFirst={idx === 0}
                isLast={idx === trace.length - 1}
              />
            ))}
            {/* End marker */}
            <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: 68 }}>
              <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--cp-border-stronger)', border: '1.5px solid var(--cp-divider-accent)' }} />
              </div>
              <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 600 }}>
                Session end{session.last_active && <span style={{ opacity: 0.6 }}> · {formatTime(session.last_active)}</span>}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* View full details link */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(109,40,217,0.08)' }}>
        <Link
          href={`/sessions/${session.id}`}
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)' }}
          className="block text-center px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-500/20 transition-all"
        >
          View full session details →
        </Link>
      </div>
    </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

function useRetentionDays(): number {
  const [days, setDays] = useState(0)
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem('data_retention_days')
        setDays(v !== null ? Number(v) : 0)
      } catch {}
    }
    read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'data_retention_days' || e.key === 'archive_applied_at') read()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return days
}

function isArchived(startedAt: string, retentionDays: number): boolean {
  if (retentionDays <= 0) return false
  const cutoff = Date.now() - retentionDays * 86_400_000
  return new Date(startedAt).getTime() < cutoff
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const retentionDays = useRetentionDays()

  // Filters & sort
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('started_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])

  // Load agent list for filter dropdown
  useEffect(() => {
    supabase.from('agents').select('id, name').order('name').then(({ data }) => {
      if (data) setAgents(data)
    })
  }, [])

  const loadSessions = useCallback(async (reset: boolean) => {
    const currentOffset = reset ? 0 : offset
    if (reset) { setLoading(true); setSelectedSession(null) }
    else setLoadingMore(true)

    const { items, total: t } = await fetchAllSessions({
      limit: PAGE_SIZE,
      offset: currentOffset,
      agentId: agentFilter !== 'all' ? agentFilter : undefined,
      sortBy: sortField,
      sortAsc: sortDir === 'asc',
    })

    if (reset) {
      setSessions(items)
      setOffset(PAGE_SIZE)
    } else {
      setSessions(prev => [...prev, ...items])
      setOffset(prev => prev + PAGE_SIZE)
    }
    setTotal(t)
    setLoading(false)
    setLoadingMore(false)
  }, [agentFilter, sortField, sortDir, offset])

  useEffect(() => {
    setOffset(0)
    loadSessions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleRowClick = (session: SessionRow) => {
    setSelectedSession(prev => prev?.id === session.id ? null : session)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
            Sessions
          </h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
            Agent session history &amp; trace viewer
            {total > 0 && <span style={{ color: 'var(--cp-text-accent-light)' }} className="ml-2 font-bold">· {total.toLocaleString()} sessions</span>}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-dim)', flexShrink: 0 }}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)' }}
          className="rounded-lg px-3 py-1.5 text-sm outline-none focus:border-purple-500"
        >
          <option value="all">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {retentionDays > 0 && (
          <label className="flex items-center gap-2 cursor-pointer ml-auto" style={{ flexShrink: 0 }}>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: 12 }}>Show archived</span>
            <button
              onClick={() => setShowArchived(v => !v)}
              style={{
                background: showArchived ? 'rgba(139,92,246,0.35)' : 'var(--cp-input-bg)',
                border: `1px solid ${showArchived ? 'rgba(139,92,246,0.5)' : 'var(--cp-border-strong)'}`,
              }}
              className="relative w-9 h-5 rounded-full transition-all flex-shrink-0"
            >
              <div
                style={{
                  background: showArchived ? '#a78bfa' : 'var(--cp-text-dim)',
                  transform: showArchived ? 'translateX(18px)' : 'translateX(3px)',
                }}
                className="absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all"
              />
            </button>
          </label>
        )}
        {!retentionDays && (
          <div style={{ color: 'var(--cp-text-dim)', marginLeft: 'auto', fontSize: 12 }}>
            {loading ? 'Loading…' : `${sessions.length} of ${total}`}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-12 text-center">
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Loading sessions…</div>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-16 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.35)" strokeWidth="1.5" style={{ margin: '0 auto 10px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-semibold">No sessions found</div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-2">Sessions are recorded as agents run tasks.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table */}
          <div
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cp-divider-accent)' }}>
                    <th style={{ color: 'var(--cp-text-dim)' }} className="text-left text-xs font-bold uppercase tracking-wider px-5 py-3">Agent</th>
                    <th style={{ color: 'var(--cp-text-dim)' }} className="text-left text-xs font-bold uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Session ID</th>
                    <th
                      onClick={() => handleSort('started_at')}
                      style={{ color: sortField === 'started_at' ? '#c4b5fd' : 'var(--cp-text-dim)', cursor: 'pointer', userSelect: 'none' }}
                      className="text-left text-xs font-bold uppercase tracking-wider px-4 py-3"
                    >
                      <span className="flex items-center gap-1.5">Started <SortIcon field="started_at" current={sortField} dir={sortDir} /></span>
                    </th>
                    <th
                      onClick={() => handleSort('last_active')}
                      style={{ color: sortField === 'last_active' ? '#c4b5fd' : 'var(--cp-text-dim)', cursor: 'pointer', userSelect: 'none' }}
                      className="text-left text-xs font-bold uppercase tracking-wider px-4 py-3 hidden md:table-cell"
                    >
                      <span className="flex items-center gap-1.5">Duration <SortIcon field="last_active" current={sortField} dir={sortDir} /></span>
                    </th>
                    <th
                      onClick={() => handleSort('token_count')}
                      style={{ color: sortField === 'token_count' ? '#c4b5fd' : 'var(--cp-text-dim)', cursor: 'pointer', userSelect: 'none' }}
                      className="text-left text-xs font-bold uppercase tracking-wider px-4 py-3 hidden sm:table-cell"
                    >
                      <span className="flex items-center gap-1.5">Tokens <SortIcon field="token_count" current={sortField} dir={sortDir} /></span>
                    </th>
                    <th style={{ color: 'var(--cp-text-dim)' }} className="text-left text-xs font-bold uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const activeSessions = retentionDays > 0
                      ? sessions.filter(s => !isArchived(s.started_at, retentionDays))
                      : sessions
                    const archivedSessions = retentionDays > 0
                      ? sessions.filter(s => isArchived(s.started_at, retentionDays))
                      : []
                    const displaySessions = showArchived ? [...activeSessions, ...archivedSessions] : activeSessions
                    const archiveStartIdx = activeSessions.length
                    return displaySessions.map((session, idx) => {
                    if (showArchived && archivedSessions.length > 0 && idx === archiveStartIdx) {
                      return [
                        <tr key="archive-separator">
                          <td colSpan={6} className="px-5 py-2" style={{ borderBottom: '1px solid var(--cp-input-bg)' }}>
                            <div className="flex items-center gap-2">
                              <div style={{ flex: 1, height: 1, background: 'var(--cp-border-strong)' }} />
                              <span style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 600 }}>📦 Archived · {archivedSessions.length} session{archivedSessions.length !== 1 ? 's' : ''}</span>
                              <div style={{ flex: 1, height: 1, background: 'var(--cp-border-strong)' }} />
                            </div>
                          </td>
                        </tr>,
                        renderSessionRow(session, idx)
                      ]
                    }
                    return renderSessionRow(session, idx)
                    function renderSessionRow(session: SessionRow, idx: number) {
                    const archived = isArchived(session.started_at, retentionDays)
                    const isSelected = selectedSession?.id === session.id
                    const statusCfg = STATUS_CONFIG[session.status] ?? { color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: session.status }
                    return (
                      <tr
                        key={session.id}
                        onClick={() => handleRowClick(session)}
                        style={{
                          borderBottom: idx < displaySessions.length - 1 ? '1px solid var(--cp-input-bg)' : 'none',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(109,40,217,0.08)' : 'transparent',
                          opacity: archived ? 0.45 : 1,
                          transition: 'background 0.15s, opacity 0.15s',
                        }}
                        className="group hover:bg-white/[0.02]"
                      >
                        {/* Agent */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 28, height: 28, minWidth: 28, fontSize: 10, fontWeight: 700 }}
                              className="rounded-lg flex items-center justify-center flex-shrink-0"
                            >
                              {getInitials(session.agent_name)}
                            </div>
                            <div>
                              <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">{session.agent_name}</div>
                              {session.model && <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>{session.model.length > 18 ? session.model.slice(0, 18) + '…' : session.model}</div>}
                            </div>
                          </div>
                        </td>
                        {/* Session key */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span style={{ background: 'rgba(109,40,217,0.08)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-accent-light)', fontFamily: 'monospace', fontSize: 11 }} className="px-2 py-0.5 rounded">
                            {session.session_key.length > 14 ? session.session_key.slice(0, 7) + '…' + session.session_key.slice(-5) : session.session_key}
                          </span>
                        </td>
                        {/* Started */}
                        <td className="px-4 py-3">
                          <span style={{ color: 'var(--cp-text-secondary)', fontSize: 13 }}>{formatTimestamp(session.started_at)}</span>
                        </td>
                        {/* Duration */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span style={{ color: 'var(--cp-text-secondary)', fontSize: 13 }} className="tabular-nums">{formatDuration(session.duration_minutes)}</span>
                        </td>
                        {/* Tokens */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span style={{ color: 'var(--cp-text-secondary)', fontSize: 13 }} className="tabular-nums font-medium">{formatTokens(session.token_count)}</span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }} className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                              {statusCfg.label}
                            </span>
                            {archived && (
                              <span style={{ background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.2)', color: 'var(--cp-text-dim)' }} className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                                Archived
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/sessions/${session.id}`}
                                onClick={e => e.stopPropagation()}
                                title="View session details"
                                style={{ color: 'var(--cp-text-dim)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6 }}
                                className="group-hover:opacity-80 hover:!opacity-100 hover:bg-white/[0.06] transition-all flex-shrink-0"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </Link>
                              <svg
                                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ color: isSelected ? '#a78bfa' : 'var(--cp-text-dim)', transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s, opacity 0.15s', opacity: isSelected ? 1 : 0, flexShrink: 0 }}
                                className="group-hover:opacity-60"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                    }})
                  })()}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {sessions.length < total && (
              <div style={{ borderTop: '1px solid rgba(109,40,217,0.1)' }} className="px-5 py-4 flex justify-center">
                <button
                  onClick={() => loadSessions(false)}
                  disabled={loadingMore}
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)' }}
                  className="px-6 py-2 rounded-xl text-sm font-semibold hover:bg-purple-500/20 disabled:opacity-50 transition-all"
                >
                  {loadingMore ? 'Loading…' : `Load more (${sessions.length} of ${total})`}
                </button>
              </div>
            )}
          </div>

          {/* Side panel */}
          {selectedSession && (
            <SessionSidePanel session={selectedSession} onClose={() => setSelectedSession(null)} />
          )}
        </div>
      )}
    </div>
  )
}
