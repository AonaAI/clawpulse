'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  agent_id: string
  agent_name: string
  session_key: string
  status: string
  started_at: string
  last_active: string | null
  duration_minutes: number | null
  token_count: number
  model: string | null
}

interface Pipeline {
  id: string
  initiator_agent_id: string
  initiator_agent_name: string
  sessions: SessionRow[]
  status: 'active' | 'completed' | 'failed'
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  task_label: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—'
  if (minutes === 0) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// ── Build pipelines from sessions ─────────────────────────────────────────────
// Pipelines are groups of sessions that ran within 10 minutes of each other.
// We cluster by time proximity since there's no explicit FK between sessions.

function buildPipelines(sessions: SessionRow[]): Pipeline[] {
  if (sessions.length === 0) return []

  // Sort sessions chronologically
  const sorted = [...sessions].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  const pipelines: Pipeline[] = []
  const GAP_MS = 10 * 60 * 1000 // 10 minutes gap = new pipeline

  let current: SessionRow[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1]
    const curr = sorted[i]
    const gap = new Date(curr.started_at).getTime() - new Date(prev.started_at).getTime()

    if (gap <= GAP_MS && current.some(s => s.agent_id !== curr.agent_id)) {
      // Same pipeline cluster — different agents within 10 min
      current.push(curr)
    } else if (gap <= GAP_MS && current.length === 1) {
      // Same agent, short gap — could still be part of same pipeline (sequential tasks)
      current.push(curr)
    } else {
      // Flush current pipeline
      if (current.length > 1) pipelines.push(makePipeline(current))
      current = [curr]
    }
  }
  if (current.length > 1) pipelines.push(makePipeline(current))

  return pipelines.sort((a, b) =>
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )
}

function makePipeline(sessions: SessionRow[]): Pipeline {
  const sorted = [...sessions].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const hasActive = sorted.some(s => s.status === 'active')
  const hasFailed = sorted.some(s => s.status === 'failed')
  const status: Pipeline['status'] = hasActive ? 'active' : hasFailed ? 'failed' : 'completed'

  const startMs = new Date(first.started_at).getTime()
  const endMs = last.last_active ? new Date(last.last_active).getTime() : null
  const duration = endMs ? Math.round((endMs - startMs) / 60000) : null

  // Build a task label from agent names
  const agentNames = [...new Set(sorted.map(s => s.agent_name))]
  const taskLabel = agentNames.length === 1
    ? `${agentNames[0]} pipeline`
    : `${agentNames.slice(0, 2).join(' → ')}${agentNames.length > 2 ? ` +${agentNames.length - 2}` : ''}`

  return {
    id: first.id,
    initiator_agent_id: first.agent_id,
    initiator_agent_name: first.agent_name,
    sessions: sorted,
    status,
    started_at: first.started_at,
    ended_at: last.last_active,
    duration_minutes: duration,
    task_label: taskLabel,
  }
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  label: 'Active' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  label: 'Completed' },
  failed:    { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent }: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        >
          {icon}
        </div>
      </div>
      <div style={{ color: 'var(--cp-text-primary)' }} className="text-2xl font-bold tabular-nums">{value}</div>
      <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold mt-0.5">{label}</div>
      {sub && <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-1">{sub}</div>}
    </div>
  )
}

// ── Flow Diagram ──────────────────────────────────────────────────────────────

function FlowDiagram({ sessions }: { sessions: SessionRow[] }) {
  const unique = Array.from(
    new Map(sessions.map(s => [s.agent_id, s])).values()
  )

  if (unique.length <= 1) return null

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {unique.map((s, idx) => {
        const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.completed
        const isLast = idx === unique.length - 1
        return (
          <div key={s.agent_id} className="flex items-center gap-0">
            {/* Agent node */}
            <div className="flex flex-col items-center gap-1">
              <div
                style={{
                  background: 'var(--cp-divider-accent)',
                  border: `1px solid ${cfg.border}`,
                  color: cfg.color,
                  boxShadow: `0 0 12px ${cfg.color}20`,
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
              >
                {getInitials(s.agent_name)}
              </div>
              <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, maxWidth: 60, textAlign: 'center', lineHeight: 1.2 }} className="truncate w-14 text-center">
                {s.agent_name.split(' ')[0]}
              </span>
            </div>
            {/* Arrow connector */}
            {!isLast && (
              <div className="flex items-center mx-1" style={{ marginBottom: 16 }}>
                <div style={{ width: 16, height: 1, background: 'rgba(109,40,217,0.4)' }} />
                <svg width="6" height="8" viewBox="0 0 6 8" fill="none">
                  <path d="M0 0L6 4L0 8" fill="rgba(109,40,217,0.5)" />
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[pipeline.status]

  const uniqueAgents = [...new Set(pipeline.sessions.map(s => s.agent_name))]

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: `1px solid ${expanded ? cfg.border : 'var(--cp-border)'}`,
        backdropFilter: 'blur(12px)',
        transition: 'border-color 0.2s',
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{ borderBottom: expanded ? '1px solid rgba(109,40,217,0.1)' : 'none' }}
      >
        {/* Initiator avatar */}
        <div
          style={{
            background: 'var(--cp-divider-accent)',
            border: '1px solid rgba(139,92,246,0.22)',
            color: 'var(--cp-text-accent-light)',
            width: 36,
            height: 36,
            minWidth: 36,
            fontSize: 11,
            fontWeight: 700,
          }}
          className="rounded-lg flex items-center justify-center flex-shrink-0"
        >
          {getInitials(pipeline.initiator_agent_name)}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">{pipeline.task_label}</span>
            <span
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
              className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            >
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>{formatTimestamp(pipeline.started_at)}</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>·</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>{formatDuration(pipeline.duration_minutes)}</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>·</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>{pipeline.sessions.length} session{pipeline.sessions.length !== 1 ? 's' : ''}</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>·</span>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>{uniqueAgents.length} agent{uniqueAgents.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Flow diagram preview */}
        <div className="hidden sm:flex items-center flex-shrink-0">
          <FlowDiagram sessions={pipeline.sessions} />
        </div>

        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--cp-text-dim)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Expanded steps */}
      {expanded && (
        <div className="px-5 py-4 space-y-3">
          {/* Full flow diagram */}
          <div className="flex items-center gap-2 mb-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--cp-text-accent-light)', flexShrink: 0 }}>
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pipeline Flow</span>
          </div>
          <div
            style={{ background: 'rgba(109,40,217,0.04)', border: '1px solid var(--cp-divider-accent)', borderRadius: 10 }}
            className="p-4 mb-4 overflow-x-auto"
          >
            <FlowDiagram sessions={pipeline.sessions} />
          </div>

          {/* Sessions list */}
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Sessions — {pipeline.sessions.length} step{pipeline.sessions.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-2">
            {pipeline.sessions.map((session, idx) => {
              const sCfg = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.completed
              return (
                <div
                  key={session.id}
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(109,40,217,0.1)',
                    borderRadius: 8,
                  }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Step number */}
                  <div
                    style={{ background: 'rgba(109,40,217,0.15)', color: 'var(--cp-text-accent-light)', width: 22, height: 22, minWidth: 22, fontSize: 10, fontWeight: 800, borderRadius: 6 }}
                    className="flex items-center justify-center flex-shrink-0"
                  >
                    {idx + 1}
                  </div>

                  {/* Agent avatar */}
                  <div
                    style={{ background: 'var(--cp-divider-accent)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 28, height: 28, minWidth: 28, fontSize: 10, fontWeight: 700 }}
                    className="rounded-lg flex items-center justify-center flex-shrink-0"
                  >
                    {getInitials(session.agent_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ color: 'var(--cp-text-primary)', fontSize: 13 }} className="font-semibold">{session.agent_name}</span>
                      <span
                        style={{ background: sCfg.bg, border: `1px solid ${sCfg.border}`, color: sCfg.color }}
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                      >
                        {sCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>{formatTimestamp(session.started_at)}</span>
                      <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>· {formatDuration(session.duration_minutes)}</span>
                      {session.token_count > 0 && (
                        <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                          · {session.token_count >= 1000 ? `${(session.token_count / 1000).toFixed(1)}k` : session.token_count} tokens
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link to session detail */}
                  <Link
                    href={`/sessions/${session.id}`}
                    onClick={e => e.stopPropagation()}
                    title="View session"
                    style={{ color: 'var(--cp-text-dim)' }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')

  useEffect(() => {
    async function load() {
      // Fetch recent sessions with agent names — look back 7 days
      const since = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data, error } = await supabase
        .from('agent_sessions')
        .select('*, agent:agents(name)')
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(500)

      if (error) {
        console.error('Error fetching sessions for workflows:', error)
        setLoading(false)
        return
      }

      const rows: SessionRow[] = (data || []).map(r => {
        const agentRow = r.agent as unknown as { name: string } | null
        const durationMs = r.last_active && r.started_at
          ? new Date(r.last_active).getTime() - new Date(r.started_at).getTime()
          : null
        return {
          id: r.id,
          agent_id: r.agent_id,
          agent_name: agentRow?.name || r.agent_id,
          session_key: r.session_key,
          status: r.status || 'completed',
          started_at: r.started_at,
          last_active: r.last_active,
          duration_minutes: durationMs !== null ? Math.round(durationMs / 60000) : null,
          token_count: r.token_count ?? 0,
          model: r.model,
        }
      })

      setSessions(rows)
      setLoading(false)
    }
    load()
  }, [])

  const allPipelines = buildPipelines(sessions)

  const filteredPipelines = statusFilter === 'all'
    ? allPipelines
    : allPipelines.filter(p => p.status === statusFilter)

  // ── Stats ──
  const activePipelines = allPipelines.filter(p => p.status === 'active').length
  const completedToday = allPipelines.filter(p => p.status === 'completed' && isToday(p.started_at)).length

  const durations = allPipelines.filter(p => p.duration_minutes !== null).map(p => p.duration_minutes!)
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  // Most active chain: find the most frequent pair of agents
  const chainCounts: Record<string, number> = {}
  for (const p of allPipelines) {
    const agents = [...new Set(p.sessions.map(s => s.agent_name))]
    if (agents.length >= 2) {
      const key = `${agents[0]} → ${agents[1]}`
      chainCounts[key] = (chainCounts[key] || 0) + 1
    }
  }
  const mostActiveChain = Object.entries(chainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
          Workflows
        </h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
          Pipeline visualization — agent collaboration &amp; task chains
          {allPipelines.length > 0 && (
            <span style={{ color: 'var(--cp-text-accent-light)' }} className="ml-2 font-bold">
              · {allPipelines.length} pipeline{allPipelines.length !== 1 ? 's' : ''} (7d)
            </span>
          )}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Pipelines"
          value={loading ? '…' : activePipelines.toString()}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
          accent="#34d399"
        />
        <StatCard
          label="Completed Today"
          value={loading ? '…' : completedToday.toString()}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          accent="#22d3ee"
        />
        <StatCard
          label="Avg Duration"
          value={loading ? '…' : formatDuration(avgDuration)}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          accent="#a78bfa"
        />
        <StatCard
          label="Most Active Chain"
          value={loading ? '…' : (mostActiveChain.length > 18 ? mostActiveChain.slice(0, 16) + '…' : mostActiveChain)}
          sub={mostActiveChain !== '—' ? `${chainCounts[mostActiveChain] || 0} runs` : undefined}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
          }
          accent="#f59e0b"
        />
      </div>

      {/* Filter bar */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2 flex-wrap"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-dim)', flexShrink: 0 }}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {(['all', 'active', 'completed', 'failed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              background: statusFilter === s ? 'rgba(124,58,237,0.18)' : 'transparent',
              border: `1px solid ${statusFilter === s ? 'rgba(139,92,246,0.35)' : 'transparent'}`,
              color: statusFilter === s ? '#c4b5fd' : 'var(--cp-text-muted)',
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize"
          >
            {s === 'all' ? `All (${allPipelines.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${allPipelines.filter(p => p.status === s).length})`}
          </button>
        ))}
        <div style={{ color: 'var(--cp-text-dim)', marginLeft: 'auto', fontSize: 12 }}>
          Last 7 days
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="skeleton-shimmer rounded-xl"
              style={{ height: 80 }}
            />
          ))}
        </div>
      ) : filteredPipelines.length === 0 ? (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }}
          className="rounded-xl p-16 text-center"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-semibold">No pipelines found</div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-2 max-w-xs mx-auto leading-relaxed">
            Pipelines are detected when multiple agents run sessions within a short time window. They appear here as agents collaborate on tasks.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPipelines.map(pipeline => (
            <PipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </div>
      )}
    </div>
  )
}
