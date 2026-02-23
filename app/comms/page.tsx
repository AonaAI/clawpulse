'use client'

import { useEffect, useState, Component, type ReactNode } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchHandoffs, fetchCronJobs } from '@/lib/supabase-client'
import type { Task } from '@/lib/types'
import dynamic from 'next/dynamic'

const AgentCommGraph = dynamic(() => import('./AgentCommGraph'), {
  loading: () => <div className="skeleton-shimmer" style={{ width: '100%', height: 400, borderRadius: 12 }} />,
  ssr: false,
})

class GraphErrorBoundary extends Component<{children: ReactNode}, {error: string | null}> {
  constructor(props: {children: ReactNode}) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  componentDidCatch(error: Error) {
    console.error('AgentCommGraph error:', error)
  }
  render() {
    if (this.state.error) {
      return <div style={{ color: '#f87171', padding: 20, border: '1px solid #f87171', borderRadius: 8, margin: '10px 0' }}>Graph error: {this.state.error}</div>
    }
    return this.props.children
  }
}

// ── Cron job types (from Supabase) ────────────────────────────────────────

interface CronJob {
  id: string
  name: string
  schedule: string
  agent_id: string
  enabled: boolean
  status: string
  last_run: string | null
  next_run: string | null
  last_duration_ms: number | null
  consecutive_errors: number
  payload_message: string | null
  last_error?: string | null
  session_target?: string | null
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active:   { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', label: 'Active' },
  ok:       { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', label: 'OK' },
  disabled: { color: 'var(--cp-text-muted)', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)', label: 'Disabled' },
  paused:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)', label: 'Paused' },
  error:    { color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)', label: 'Error' },
  pending:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.2)', label: 'Pending' },
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

function formatTimeUntil(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs < 0) return 'Overdue'
  if (diffMs < 60_000) return 'In < 1 min'
  if (diffMs < 3_600_000) return `In ${Math.floor(diffMs / 60_000)} min`
  if (diffMs < 86_400_000) return `In ${Math.floor(diffMs / 3_600_000)} hr`
  return `In ${Math.floor(diffMs / 86_400_000)}d`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function formatDateTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString('en-AU', {
      timeZone: 'Australia/Brisbane',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return isoStr
  }
}

function formatScheduleHuman(schedule: string): string {
  // "every Xm" / "every Xh" patterns (from pusher)
  const everyMin = schedule.match(/^every\s+(\d+)m$/)
  if (everyMin) {
    const n = parseInt(everyMin[1])
    return n === 1 ? 'Every minute' : `Every ${n} minutes`
  }
  const everyHr = schedule.match(/^every\s+(\d+)h$/)
  if (everyHr) {
    const n = parseInt(everyHr[1])
    return n === 1 ? 'Every hour' : `Every ${n} hours`
  }

  // Cron expression (optional tz suffix like " (AEST)")
  const tzMatch = schedule.match(/\(([^)]+)\)/)
  const tzStr = tzMatch ? ` ${tzMatch[1]}` : ''
  const expr = schedule.replace(/\([^)]+\)/, '').trim()
  const parts = expr.split(/\s+/)

  if (parts.length >= 5) {
    const [min, hour, dom, month, dow] = parts
    // Every X minutes: */X * * * *
    if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
      const interval = parseInt(min.slice(2))
      return interval === 1 ? 'Every minute' : `Every ${interval} minutes`
    }
    // Every X hours: 0 */X * * *
    if (hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
      const interval = parseInt(hour.slice(2))
      return interval === 1 ? 'Every hour' : `Every ${interval} hours`
    }
    // Daily at specific time: M H * * *
    if (!min.includes('/') && !min.includes('*') && !hour.includes('/') && !hour.includes('*') && dom === '*' && month === '*' && dow === '*') {
      const h = parseInt(hour)
      const m = parseInt(min)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 === 0 ? 12 : h % 12
      const mStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : ''
      return `Daily at ${h12}${mStr} ${ampm}${tzStr}`
    }
  }

  // One-shot ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(schedule)) {
    try {
      return `One-shot at ${formatDateTime(schedule)}`
    } catch { /* ignore */ }
  }

  return schedule
}

// ── Derived Slack channel map from AGENTS ─────────────────────────────────

function buildChannelMap() {
  const map = new Map<string, string[]>()
  for (const agent of AGENTS) {
    for (const ch of agent.slack_channels) {
      const existing = map.get(ch) ?? []
      map.set(ch, [...existing, agent.id])
    }
  }
  return Array.from(map.entries())
    .map(([channel, agentIds]) => ({ channel, agentIds }))
    .sort((a, b) => b.agentIds.length - a.agentIds.length)
}

const CHANNEL_MAP = buildChannelMap()

// ── Small components ──────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold">{title}</h2>
      <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-0.5">{subtitle}</p>
    </div>
  )
}

function AgentAvatar({ agentId, size = 24 }: { agentId: string; size?: number }) {
  const agent = AGENTS.find(a => a.id === agentId)
  return (
    <div
      title={agent?.name ?? agentId}
      style={{
        width: size,
        height: size,
        minWidth: size,
        fontSize: size * 0.35,
        background: 'rgba(139,92,246,0.14)',
        border: '1px solid rgba(139,92,246,0.25)',
        color: 'var(--cp-text-accent-light)',
      }}
      className="rounded-md flex items-center justify-center font-bold"
    >
      {(agent?.name ?? agentId).slice(0, 2).toUpperCase()}
    </div>
  )
}

const PRIORITY_CONFIG = {
  low:      { color: 'var(--cp-text-muted)', label: 'Low' },
  medium:   { color: '#3b82f6', label: 'Medium' },
  high:     { color: '#f59e0b', label: 'High' },
  critical: { color: '#ef4444', label: 'Critical' },
}

// ── Cron job expanded panel ───────────────────────────────────────────────

function CronJobExpandedPanel({ job, statusKey }: { job: CronJob; statusKey: string }) {
  const isError = statusKey === 'error'
  const agent = AGENTS.find(a => a.id === job.agent_id)

  return (
    <div style={{
      borderTop: '1px solid var(--cp-separator-bg)',
      background: 'var(--cp-code-bg)',
      padding: '16px 20px 20px 28px',
    }}>
      {/* Error banner */}
      {isError && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(248,113,113,0.07)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 8,
        }}>
          <div style={{ color: '#f87171', fontWeight: 600, fontSize: 13 }} className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Job is in error state
          </div>
          {job.last_error && (
            <div style={{
              marginBottom: 12,
              padding: '8px 12px',
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 6,
              color: '#fca5a5',
              fontSize: 12,
              fontFamily: 'monospace',
              lineHeight: 1.6,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}>
              {job.last_error}
            </div>
          )}
          <div className="flex flex-wrap gap-6">
            <div>
              <div style={{ color: 'rgba(248,113,113,0.55)', fontSize: 11, marginBottom: 2 }}>Consecutive Errors</div>
              <div style={{ color: '#f87171', fontWeight: 700, fontSize: 20 }}>{job.consecutive_errors}</div>
            </div>
            {job.last_run && (
              <div>
                <div style={{ color: 'rgba(248,113,113,0.55)', fontSize: 11, marginBottom: 2 }}>Last Failed Run</div>
                <div style={{ color: '#f87171', fontSize: 13 }}>{formatDateTime(job.last_run)}</div>
                <div style={{ color: 'rgba(248,113,113,0.5)', fontSize: 11 }}>{formatTimeAgo(new Date(job.last_run))}</div>
              </div>
            )}
            {job.last_duration_ms !== null && (
              <div>
                <div style={{ color: 'rgba(248,113,113,0.55)', fontSize: 11, marginBottom: 2 }}>Last Duration</div>
                <div style={{ color: '#f87171', fontSize: 13 }}>{formatDuration(job.last_duration_ms)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Schedule */}
        <div>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-1">Schedule</div>
          <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 500 }}>{formatScheduleHuman(job.schedule)}</div>
          <code style={{ color: 'var(--cp-text-accent-light)', fontSize: 11, display: 'block', marginTop: 3, opacity: 0.8 }}>{job.schedule}</code>
        </div>

        {/* Next run */}
        <div>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-1">Next Run</div>
          {job.next_run ? (
            <>
              <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 500 }}>{formatTimeUntil(new Date(job.next_run))}</div>
              <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, marginTop: 2 }}>{formatDateTime(job.next_run)}</div>
            </>
          ) : (
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 13 }}>Not scheduled</div>
          )}
        </div>

        {/* Session Target */}
        <div>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-1">Session Target</div>
          {agent ? (
            <div className="flex items-center gap-2 mt-1">
              <AgentAvatar agentId={job.agent_id} size={20} />
              <div>
                <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 500 }}>{agent.name}</div>
                <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11 }}>{job.session_target ?? job.agent_id}</div>
              </div>
            </div>
          ) : (
            <code style={{ color: 'var(--cp-text-muted)', fontSize: 11 }}>{job.agent_id}</code>
          )}
        </div>

        {/* Job ID */}
        <div>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-1">Job ID</div>
          <code style={{ color: 'var(--cp-text-muted)', fontSize: 10, wordBreak: 'break-all', display: 'block', lineHeight: 1.5 }}>{job.id}</code>
        </div>
      </div>

      {/* Full payload */}
      {job.payload_message && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-2">Payload / Instructions</div>
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid var(--cp-border-subtle)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--cp-text-muted)',
            fontSize: 12,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {job.payload_message}
          </div>
        </div>
      )}

      {/* Last run mini table */}
      {job.last_run && (
        <div>
          <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="mb-2">Run History</div>
          <div style={{
            background: 'var(--cp-card-bg)',
            border: '1px solid var(--cp-border-subtle)',
            borderRadius: 8,
            overflow: 'hidden',
            fontSize: 12,
          }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '7px 14px', borderBottom: '1px solid var(--cp-input-bg)' }}>
              <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600 }}>TIMESTAMP</span>
              <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600 }}>STATUS</span>
              <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textAlign: 'right' }}>DURATION</span>
            </div>
            {/* Last run row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '9px 14px', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--cp-text-primary)' }}>{formatDateTime(job.last_run)}</div>
                <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11 }}>{formatTimeAgo(new Date(job.last_run))}</div>
              </div>
              <div>
                <span style={{
                  color: isError ? '#f87171' : '#34d399',
                  background: isError ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)',
                  border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}`,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontWeight: 600,
                }}>
                  {isError ? 'Error' : 'OK'}
                </span>
              </div>
              <div style={{ color: 'var(--cp-text-muted)', textAlign: 'right' }}>
                {job.last_duration_ms !== null ? formatDuration(job.last_duration_ms) : '—'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CommsPage() {
  const [handoffs, setHandoffs] = useState<Task[]>([])
  const [handoffsLoading, setHandoffsLoading] = useState(true)
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [cronLoading, setCronLoading] = useState(true)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  useEffect(() => {
    fetchHandoffs().then(data => {
      setHandoffs(data as Task[])
      setHandoffsLoading(false)
    })
    fetchCronJobs().then(data => {
      setCronJobs(data as CronJob[])
      setCronLoading(false)
    })
  }, [])

  const totalChannels = CHANNEL_MAP.length
  const activeJobs = cronJobs.filter(j => j.enabled && j.status !== 'error').length
  const errorJobs = cronJobs.filter(j => j.status === 'error' || j.consecutive_errors > 0).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">Comms & Coordination</h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Slack channels, scheduled jobs, and pending handoffs</p>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-10 flex-wrap">
        {[
          { label: 'Slack Channels', value: totalChannels, color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.18)' },
          { label: 'Active Jobs',    value: activeJobs,    color: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.18)'  },
          { label: 'Job Errors',     value: errorJobs,     color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.18)' },
          { label: 'Pending Handoffs', value: handoffs.length, color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.18)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.border}`, backdropFilter: 'blur(12px)' }} className="rounded-xl px-4 py-2 flex items-center gap-2.5">
            <span style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">{stat.label}</span>
            <span style={{ color: stat.color }} className="text-sm font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-10">
        {/* ── 0. Agent Communication Graph ─────────────────────────── */}
        <section>
          <SectionHeader
            title="Agent Communication Graph"
            subtitle="Spawn permissions and shared Slack channels between agents"
          />
          <GraphErrorBoundary>
            <AgentCommGraph />
          </GraphErrorBoundary>
        </section>

        {/* ── 1. Slack Channel Map ─────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Slack Channel Map"
            subtitle="Channels and which agents participate in each"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CHANNEL_MAP.map(({ channel, agentIds }) => (
              <div
                key={channel}
                style={{
                  background: 'var(--cp-card-bg)',
                  border: '1px solid var(--cp-border)',
                  backdropFilter: 'blur(12px)',
                }}
                className="rounded-xl p-4 flex items-center gap-3"
              >
                {/* Channel icon */}
                <div
                  style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 36, height: 36, minWidth: 36 }}
                  className="rounded-lg flex items-center justify-center text-sm font-bold"
                >
                  #
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold truncate">{channel}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {agentIds.map(id => <AgentAvatar key={id} agentId={id} size={20} />)}
                    <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 11 }} className="font-medium">{agentIds.length} agent{agentIds.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. Scheduled Jobs ────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Scheduled Jobs"
            subtitle="Cron-style automations running across agents — click a row to expand"
          />
          {cronLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ background: 'var(--cp-card-bg)', border: '1px solid rgba(109,40,217,0.1)', height: 64 }} className="rounded-xl animate-pulse" />
              ))}
            </div>
          ) : cronJobs.length === 0 ? (
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-8 text-center">
              <span style={{ color: 'var(--cp-text-dim)' }} className="text-sm">No cron jobs found. Run the push script to sync from OpenClaw.</span>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--cp-card-bg)',
                border: '1px solid var(--cp-border)',
                backdropFilter: 'blur(12px)',
              }}
              className="rounded-xl overflow-hidden"
            >
              {cronJobs.map((job, i) => {
                const agent = AGENTS.find(a => a.id === job.agent_id)
                const statusKey = !job.enabled ? 'disabled' : job.consecutive_errors > 0 ? 'error' : job.status === 'error' ? 'error' : 'ok'
                const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.ok
                const lastRunStr = job.last_run ? formatTimeAgo(new Date(job.last_run)) : 'Never'
                const description = job.payload_message ? job.payload_message.slice(0, 100) + (job.payload_message.length > 100 ? '…' : '') : ''
                const isExpanded = expandedJobId === job.id
                const isError = statusKey === 'error'

                // Left border color
                const leftBorderColor = isError
                  ? 'rgba(248,113,113,0.55)'
                  : (statusKey === 'ok' && job.enabled)
                    ? 'rgba(52,211,153,0.35)'
                    : 'transparent'

                return (
                  <div
                    key={job.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--cp-input-bg)' : undefined }}
                  >
                    {/* Clickable row */}
                    <button
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 20px',
                        background: 'transparent',
                        border: 'none',
                        borderLeft: `3px solid ${leftBorderColor}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Status dot */}
                      <span
                        style={{ background: status.color, boxShadow: job.enabled && statusKey === 'ok' ? `0 0 6px ${status.color}88` : undefined }}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                      />

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold">{job.name}</span>
                          <span
                            style={{ color: status.color, background: status.bg, border: `1px solid ${status.border}` }}
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          >
                            {status.label}
                          </span>
                          {job.last_duration_ms !== null && (
                            <span style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs">
                              {formatDuration(job.last_duration_ms)}
                            </span>
                          )}
                        </div>
                        {description && <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5 truncate">{description}</p>}
                      </div>

                      {/* Schedule */}
                      <code
                        style={{ color: 'var(--cp-text-accent-light)', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', fontSize: 11 }}
                        className="hidden sm:block px-2 py-1 rounded-md font-mono flex-shrink-0"
                      >
                        {job.schedule}
                      </code>

                      {/* Agent + last run */}
                      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                        {agent && <AgentAvatar agentId={job.agent_id} size={22} />}
                        <span style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs font-medium">{lastRunStr}</span>
                      </div>

                      {/* Chevron */}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          color: 'var(--cp-text-dimmer)',
                          flexShrink: 0,
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.22s ease',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Accordion panel */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: isExpanded ? '1fr' : '0fr',
                        transition: 'grid-template-rows 0.25s ease',
                      }}
                    >
                      <div style={{ overflow: 'hidden', minHeight: 0 }}>
                        <CronJobExpandedPanel job={job} statusKey={statusKey} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 3. Pending Handoffs ──────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Pending Handoffs"
            subtitle="Blocked tasks waiting for coordination or reassignment"
          />
          {handoffsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ background: 'var(--cp-card-bg)', border: '1px solid rgba(109,40,217,0.1)', height: 72 }} className="rounded-xl animate-pulse" />
              ))}
            </div>
          ) : handoffs.length === 0 ? (
            <div
              style={{
                background: 'rgba(52,211,153,0.04)',
                border: '1px solid rgba(52,211,153,0.15)',
                backdropFilter: 'blur(12px)',
              }}
              className="rounded-xl px-6 py-8 flex flex-col items-center gap-2"
            >
              <svg width="24" height="24" fill="none" stroke="#34d399" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ color: '#34d399' }} className="text-sm font-semibold">No pending handoffs</span>
              <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">All blocked tasks are clear</span>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--cp-card-bg)',
                border: '1px solid var(--cp-border)',
                backdropFilter: 'blur(12px)',
              }}
              className="rounded-xl overflow-hidden"
            >
              {handoffs.map((task, i) => {
                const agent = AGENTS.find(a => a.id === task.assigned_agent)
                const priority = PRIORITY_CONFIG[task.priority]
                return (
                  <div
                    key={task.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--cp-input-bg)' : undefined }}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    {/* Blocked indicator */}
                    <div
                      style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', width: 36, height: 36, minWidth: 36 }}
                      className="rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold truncate">{task.title}</span>
                        <span
                          style={{ color: priority.color, background: `${priority.color}12`, border: `1px solid ${priority.color}30` }}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        >
                          {priority.label}
                        </span>
                      </div>
                      {task.description && (
                        <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5 truncate">{task.description}</p>
                      )}
                    </div>

                    {/* Project */}
                    <span
                      style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-tag-bg)', border: '1px solid var(--cp-border-subtle)', fontSize: 11 }}
                      className="hidden sm:block px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
                    >
                      {task.project}
                    </span>

                    {/* Assigned agent */}
                    {agent && (
                      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                        <AgentAvatar agentId={agent.id} size={22} />
                        <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{agent.name}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
