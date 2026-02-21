'use client'

import { useEffect, useState, Component, type ReactNode } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchHandoffs, fetchCronJobs } from '@/lib/supabase-client'
import type { Task } from '@/lib/types'
import AgentCommGraph from './AgentCommGraph'

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
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active:   { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', label: 'Active' },
  ok:       { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', label: 'OK' },
  disabled: { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)', label: 'Disabled' },
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
        color: '#8b5cf6',
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

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CommsPage() {
  const [handoffs, setHandoffs] = useState<Task[]>([])
  const [handoffsLoading, setHandoffsLoading] = useState(true)
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [cronLoading, setCronLoading] = useState(true)

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
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Comms & Coordination</h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Slack channels, scheduled jobs, and pending handoffs</p>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-10 flex-wrap">
        {[
          { label: 'Slack Channels', value: totalChannels, color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.18)' },
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
                  style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', width: 36, height: 36, minWidth: 36 }}
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
            subtitle="Cron-style automations running across agents"
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
              return (
                <div
                  key={job.id}
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.015] transition-colors"
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
                          {job.last_duration_ms < 1000 ? `${job.last_duration_ms}ms` : `${(job.last_duration_ms / 1000).toFixed(1)}s`}
                        </span>
                      )}
                    </div>
                    {description && <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5 truncate">{description}</p>}
                  </div>

                  {/* Schedule */}
                  <code
                    style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', fontSize: 11 }}
                    className="hidden sm:block px-2 py-1 rounded-md font-mono flex-shrink-0"
                  >
                    {job.schedule}
                  </code>

                  {/* Agent + last run */}
                  <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    {agent && <AgentAvatar agentId={job.agent_id} size={22} />}
                    <span style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs font-medium">{lastRunStr}</span>
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
                    style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
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
