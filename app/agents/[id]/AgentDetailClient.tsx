'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AGENTS } from '@/lib/data'
import { supabase, fetchSessions } from '@/lib/supabase-client'
import type { AgentStatus, Task, Session } from '@/lib/types'

type EventType = 'task_started' | 'task_completed' | 'message_sent' | 'error' | 'deployment' | 'info' | 'warning' | 'analysis'

interface ActivityItem {
  id: string
  agent_id: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
}

interface DailyTokenStat {
  date: string
  total_tokens: number
  total_cost: number
}

interface AgentDetailData {
  mission: string | null
  status: AgentStatus
  sessionCount: number
  totalTokens: number
  totalCost: number
  tasksCompleted: number
  activity: ActivityItem[]
  tasks: Task[]
  weeklyStats: DailyTokenStat[]
  sessions: Session[]
}

function detectEventType(action: string): EventType {
  const a = action.toLowerCase()
  if (a.includes('error') || a.includes('fail') || a.includes('crash')) return 'error'
  if (a.includes('complet') || a.includes('done') || a.includes('finish') || a.includes('success')) return 'task_completed'
  if (a.includes('start') || a.includes('begin') || a.includes('initiat') || a.includes('creat')) return 'task_started'
  if (a.includes('deploy') || a.includes('publish') || a.includes('release') || a.includes('ship')) return 'deployment'
  if (a.includes('message') || a.includes('send') || a.includes('notify') || a.includes('slack') || a.includes('comm')) return 'message_sent'
  if (a.includes('warn') || a.includes('caution') || a.includes('alert')) return 'warning'
  if (a.includes('analys') || a.includes('research') || a.includes('review') || a.includes('audit')) return 'analysis'
  return 'info'
}

const EVENT_CONFIG: Record<EventType, { color: string; bg: string; border: string; label: string }> = {
  task_completed: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Completed' },
  task_started: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', label: 'Started' },
  error: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Error' },
  deployment: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'Deployed' },
  message_sent: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', label: 'Message' },
  warning: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', label: 'Warning' },
  analysis: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', label: 'Analysis' },
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', label: 'Info' },
}

const SESSION_STATUS_CONFIG = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Active' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

const TASK_STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  todo: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', label: 'To Do' },
  in_progress: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', label: 'In Progress' },
  done: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Done' },
  blocked: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Blocked' },
}

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  low: { color: '#4b5563' },
  medium: { color: '#6b7280' },
  high: { color: '#f59e0b' },
  critical: { color: '#f87171' },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg = {
    working: { dot: '#34d399', text: 'Working', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', pulse: true },
    idle: { dot: '#4b5563', text: 'Idle', color: '#6b7280', bg: 'rgba(75,85,99,0.06)', border: 'rgba(75,85,99,0.2)', pulse: false },
    offline: { dot: '#374151', text: 'Offline', color: '#4b5563', bg: 'rgba(55,65,81,0.04)', border: 'rgba(55,65,81,0.15)', pulse: false },
    unknown: { dot: '#4b5563', text: 'Unknown', color: '#6b7280', bg: 'rgba(75,85,99,0.04)', border: 'rgba(75,85,99,0.15)', pulse: false },
  }[status]

  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
    >
      <span
        style={{ background: cfg.dot }}
        className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${cfg.pulse ? 'status-glow-working' : ''}`}
      />
      {cfg.text}
    </span>
  )
}

function ModelBadge({ model }: { model: string }) {
  const isOpus = model.includes('Opus')
  const isSonnet = model.includes('Sonnet')
  const color = isOpus ? '#a78bfa' : isSonnet ? '#60a5fa' : '#34d399'
  const bg = isOpus ? 'rgba(167,139,250,0.1)' : isSonnet ? 'rgba(96,165,250,0.1)' : 'rgba(52,211,153,0.1)'
  const border = isOpus ? 'rgba(167,139,250,0.25)' : isSonnet ? 'rgba(96,165,250,0.25)' : 'rgba(52,211,153,0.25)'
  return (
    <span style={{ color, background: bg, border: `1px solid ${border}` }} className="text-sm px-3 py-1 rounded-full font-semibold">
      {model}
    </span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(109,40,217,0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-4 sm:p-5"
    >
      <div style={{ color: '#4b5563' }} className="text-xs font-semibold uppercase tracking-wider mb-2">{label}</div>
      <div style={{ color }} className="text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div style={{ color: '#4b5563' }} className="text-xs font-medium mt-1">{sub}</div>}
    </div>
  )
}

function buildWeeklyChart(stats: DailyTokenStat[]): DailyTokenStat[] {
  const map = new Map(stats.map(s => [s.date, s]))
  const days: DailyTokenStat[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    days.push(map.get(key) ?? { date: key, total_tokens: 0, total_cost: 0 })
  }
  return days
}

function SessionRow({ session, isLast }: { session: Session; isLast: boolean }) {
  const statusCfg = SESSION_STATUS_CONFIG[session.status] || SESSION_STATUS_CONFIG.completed
  const heartbeatAge = session.status === 'active' && session.last_active
    ? Date.now() - new Date(session.last_active).getTime()
    : null
  const isRecentHeartbeat = heartbeatAge !== null && heartbeatAge < 5 * 60 * 1000

  return (
    <div
      className="px-4 sm:px-5 py-4 flex items-start gap-3"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
        <div
          style={{ background: statusCfg.color }}
          className={`w-2 h-2 rounded-full ${isRecentHeartbeat ? 'status-glow-working' : ''}`}
        />
        {!isLast && <div style={{ background: 'rgba(255,255,255,0.06)', width: '1px', height: '24px' }} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, fontSize: '10px' }}
              className="px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
            >
              {statusCfg.label}
            </span>
            {isRecentHeartbeat && (
              <span style={{ color: '#34d399', fontSize: '10px' }} className="font-semibold">● live</span>
            )}
          </div>
          <span style={{ color: '#374151', fontSize: '11px' }} className="font-mono flex-shrink-0">
            {formatSessionDate(session.started_at)}
          </span>
        </div>

        {session.summary && (
          <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: '1.5' }} className="mb-2">{session.summary}</p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {session.duration_minutes != null && (
            <span style={{ color: '#6b7280' }} className="text-xs font-medium">
              <span style={{ color: '#4b5563' }}>Duration</span> {session.duration_minutes}m
            </span>
          )}
          {(session.tokens_used ?? session.token_count ?? 0) > 0 && (
            <span style={{ color: '#8b5cf6' }} className="text-xs font-semibold">
              {formatTokens(session.tokens_used ?? session.token_count ?? 0)} tokens
            </span>
          )}
          {session.model && (
            <span style={{ color: '#4b5563' }} className="text-xs font-mono">
              {session.model}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgentDetailClient({ id }: { id: string }) {
  const agent = AGENTS.find(a => a.id === id)

  const [data, setData] = useState<AgentDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agent) { setLoading(false); return }

    async function load() {
      const agentId = id

      const [
        missionRes,
        tokenAllRes,
        tokenWeekRes,
        activityRes,
        tasksRes,
        liveRes,
        sessionsData,
      ] = await Promise.all([
        supabase.from('agents').select('mission').eq('id', agentId).single(),
        supabase.from('token_usage').select('total_tokens, cost_usd').eq('agent_id', agentId),
        supabase.from('token_usage')
          .select('total_tokens, cost_usd, recorded_at')
          .eq('agent_id', agentId)
          .gte('recorded_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('recorded_at', { ascending: true }),
        supabase.from('activity_log')
          .select('id, agent_id, action, details, metadata, created_at')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('tasks')
          .select('*')
          .eq('assigned_agent', agentId)
          .order('updated_at', { ascending: false }),
        fetch('/api/agents').then(r => r.ok ? r.json() : []).catch(() => []),
        fetchSessions(agentId, 20),
      ])

      const allTokenRows = tokenAllRes.data || []
      const totalTokens = allTokenRows.reduce((s, r) => s + r.total_tokens, 0)
      const totalCost = allTokenRows.reduce((s, r) => s + Number(r.cost_usd), 0)

      const weekMap = new Map<string, DailyTokenStat>()
      for (const r of tokenWeekRes.data || []) {
        const day = r.recorded_at.slice(0, 10)
        if (!weekMap.has(day)) weekMap.set(day, { date: day, total_tokens: 0, total_cost: 0 })
        const e = weekMap.get(day)!
        e.total_tokens += r.total_tokens
        e.total_cost += Number(r.cost_usd)
      }

      const tasks = (tasksRes.data || []) as Task[]
      const tasksCompleted = tasks.filter(t => t.status === 'done').length

      const agentDir = agent!.dir ?? agent!.id
      const liveAgents = Array.isArray(liveRes) ? liveRes : []
      const live = liveAgents.find((a: { dir: string }) => a.dir === agentDir)
      const status: AgentStatus = live?.status ?? 'offline'
      const sessionCount: number = live?.sessionCount ?? (sessionsData.length || allTokenRows.length)

      setData({
        mission: missionRes.data?.mission ?? null,
        status,
        sessionCount,
        totalTokens,
        totalCost,
        tasksCompleted,
        activity: (activityRes.data || []) as ActivityItem[],
        tasks,
        weeklyStats: Array.from(weekMap.values()),
        sessions: sessionsData as Session[],
      })
      setLoading(false)
    }

    load()
  }, [id, agent])

  if (!agent) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <Link href="/agents" style={{ color: '#6b7280' }} className="text-sm font-medium flex items-center gap-1.5 mb-6 hover:text-purple-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to agents
        </Link>
        <div style={{ color: '#4b5563' }} className="text-center py-20">Agent not found</div>
      </div>
    )
  }

  const initials = agent.name.slice(0, 2).toUpperCase()
  const weeklyChart = data ? buildWeeklyChart(data.weeklyStats) : buildWeeklyChart([])
  const maxWeekTokens = Math.max(...weeklyChart.map(d => d.total_tokens), 1)

  // Session stats
  const sessions = data?.sessions ?? []
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const avgDuration = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / completedSessions.length)
    : 0
  const sessionTokens = sessions.reduce((s, r) => s + (r.tokens_used ?? r.token_count ?? 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href="/agents"
        style={{ color: '#6b7280' }}
        className="text-sm font-medium flex items-center gap-1.5 mb-6 hover:text-purple-400 transition-colors w-fit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to agents
      </Link>

      {/* Agent header card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(79,46,220,0.03) 100%)',
          border: '1px solid rgba(109,40,217,0.22)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
        className="rounded-2xl p-4 sm:p-6 mb-6"
      >
        <div className="flex items-start gap-4 sm:gap-5 flex-wrap">
          {/* Avatar */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(79,46,220,0.15) 100%)',
              border: '2px solid rgba(139,92,246,0.45)',
              boxShadow: '0 0 32px rgba(124,58,237,0.2)',
              color: '#c4b5fd',
              fontSize: '28px',
              fontWeight: 700,
              width: '72px',
              height: '72px',
              minWidth: '72px',
            }}
            className="rounded-2xl flex items-center justify-center flex-shrink-0"
          >
            {initials}
          </div>

          {/* Name + role + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 style={{ color: '#f8f4ff' }} className="text-xl sm:text-2xl font-bold tracking-tight">{agent.name}</h1>
              {data && <StatusBadge status={data.status} />}
            </div>
            <div style={{ color: '#9ca3af' }} className="text-sm sm:text-base font-medium mb-3">{agent.role}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <ModelBadge model={agent.model} />
              <span
                style={{ color: '#4b5563', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px' }}
                className="px-2.5 py-1 rounded-lg font-mono"
              >
                {agent.workspace}
              </span>
            </div>
          </div>
        </div>

        {/* Mission */}
        {data?.mission && (
          <div
            style={{
              borderTop: '1px solid rgba(109,40,217,0.18)',
              marginTop: '20px',
              paddingTop: '16px',
            }}
          >
            <div style={{ color: '#4b5563' }} className="text-xs font-bold uppercase tracking-wider mb-2">Mission</div>
            <p style={{ color: '#9ca3af', lineHeight: '1.6' }} className="text-sm">{data.mission}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Sessions"
          value={loading ? '—' : String(data?.sessionCount ?? 0)}
          sub="all time"
          color="#8b5cf6"
        />
        <StatCard
          label="Total Tokens"
          value={loading ? '—' : formatTokens(data?.totalTokens ?? 0)}
          sub="consumed"
          color="#22d3ee"
        />
        <StatCard
          label="Total Cost"
          value={loading ? '—' : formatCost(data?.totalCost ?? 0)}
          sub="USD"
          color="#34d399"
        />
        <StatCard
          label="Tasks Done"
          value={loading ? '—' : String(data?.tasksCompleted ?? 0)}
          sub={loading ? '' : `of ${data?.tasks.length ?? 0} assigned`}
          color="#f59e0b"
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Session history + chart + activity */}
        <div className="xl:col-span-2 space-y-6">
          {/* Session History */}
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid rgba(109,40,217,0.12)' }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base">Session History</h2>
                  <p style={{ color: '#4b5563' }} className="text-xs mt-0.5">
                    {loading ? '—' : `${sessions.length} sessions`}
                  </p>
                </div>
                {/* Session stats */}
                {!loading && sessions.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {avgDuration > 0 && (
                      <div className="text-right">
                        <div style={{ color: '#4b5563' }} className="text-xs">Avg duration</div>
                        <div style={{ color: '#8b5cf6' }} className="text-sm font-bold">{avgDuration}m</div>
                      </div>
                    )}
                    {sessionTokens > 0 && (
                      <div className="text-right">
                        <div style={{ color: '#4b5563' }} className="text-xs">Session tokens</div>
                        <div style={{ color: '#22d3ee' }} className="text-sm font-bold">{formatTokens(sessionTokens)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-10">Loading…</div>
            ) : sessions.length === 0 ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-10">No sessions recorded yet</div>
            ) : (
              <div>
                {sessions.map((session, i) => (
                  <SessionRow key={session.id} session={session} isLast={i === sessions.length - 1} />
                ))}
              </div>
            )}
          </div>

          {/* 7-day token chart */}
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base">7-Day Token Usage</h2>
              {data && data.weeklyStats.length > 0 && (
                <span style={{ color: '#4b5563' }} className="text-xs font-medium">
                  {formatTokens(data.weeklyStats.reduce((s, d) => s + d.total_tokens, 0))} this week
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">Loading…</div>
            ) : weeklyChart.every(d => d.total_tokens === 0) ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">No token usage in the last 7 days</div>
            ) : (
              <div className="space-y-2.5">
                {weeklyChart.map(day => {
                  const pct = (day.total_tokens / maxWeekTokens) * 100
                  return (
                    <div key={day.date}>
                      <div className="flex items-center mb-1">
                        <span style={{ color: '#6b7280' }} className="text-xs font-medium w-14 sm:w-16 flex-shrink-0">
                          {formatDate(day.date)}
                        </span>
                        <div className="flex-1 mx-2 sm:mx-3" style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: pct > 0 ? 'linear-gradient(90deg, #7c3aed, #8b5cf6)' : 'transparent',
                              borderRadius: '999px',
                              transition: 'width 0.6s ease',
                            }}
                          />
                        </div>
                        <div className="text-right flex-shrink-0" style={{ minWidth: '72px' }}>
                          <span style={{ color: '#e9e2ff' }} className="text-xs font-bold">
                            {day.total_tokens > 0 ? formatTokens(day.total_tokens) : '—'}
                          </span>
                          {day.total_cost > 0 && (
                            <span style={{ color: '#4b5563' }} className="text-xs ml-1">{formatCost(day.total_cost)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid rgba(109,40,217,0.12)' }}>
              <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base">Recent Activity</h2>
              <p style={{ color: '#4b5563' }} className="text-xs mt-0.5">Last 50 events</p>
            </div>

            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-12">Loading…</div>
            ) : !data || data.activity.length === 0 ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-12">No activity yet</div>
            ) : (
              <div>
                {data.activity.map((event, i) => {
                  const type = detectEventType(event.action)
                  const cfg = EVENT_CONFIG[type]
                  const isLast = i === data.activity.length - 1
                  return (
                    <div
                      key={event.id}
                      className="px-4 sm:px-5 py-3.5 flex items-start gap-3"
                      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <span
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: '10px' }}
                        className="px-2 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 whitespace-nowrap"
                      >
                        {cfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div style={{ color: '#8b5cf6' }} className="text-sm font-semibold leading-tight">{event.action}</div>
                        {event.details && (
                          <div style={{ color: '#4b5563' }} className="text-xs mt-0.5 leading-relaxed truncate">{event.details}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div style={{ color: '#374151', fontSize: '11px' }} className="font-mono">{formatTimestamp(event.created_at)}</div>
                        <div style={{ color: '#374151', fontSize: '10px' }}>{formatTimeAgo(event.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-6">
          {/* Assigned tasks */}
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid rgba(109,40,217,0.12)' }}>
              <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base">Assigned Tasks</h2>
              <p style={{ color: '#4b5563' }} className="text-xs mt-0.5">
                {loading ? '—' : `${data?.tasks.length ?? 0} tasks`}
              </p>
            </div>

            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-10">Loading…</div>
            ) : !data || data.tasks.length === 0 ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-10">No assigned tasks</div>
            ) : (
              <div>
                {data.tasks.map((task, i) => {
                  const sc = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo
                  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  const isLast = i === data.tasks.length - 1
                  return (
                    <div
                      key={task.id}
                      className="px-4 sm:px-5 py-3.5"
                      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span style={{ color: '#e9e2ff' }} className="text-sm font-semibold leading-tight">{task.title}</span>
                        <span
                          style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: '10px' }}
                          className="px-2 py-0.5 rounded-full font-bold flex-shrink-0 whitespace-nowrap"
                        >
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: pc.color }} className="text-xs font-semibold capitalize">{task.priority}</span>
                        <span style={{ color: '#374151' }} className="text-xs">·</span>
                        <span style={{ color: '#4b5563' }} className="text-xs">{task.project}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Slack channels */}
          {agent.slack_channels.length > 0 && (
            <div
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
              className="rounded-xl p-4 sm:p-5"
            >
              <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base mb-4">Slack Channels</h2>
              <div className="space-y-2">
                {agent.slack_channels.map(ch => (
                  <div
                    key={ch}
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span style={{ color: '#6b7280', fontSize: '12px' }} className="font-mono">{ch}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Can spawn */}
          {agent.spawn_permissions.length > 0 && (
            <div
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
              className="rounded-xl p-4 sm:p-5"
            >
              <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base mb-4">Can Spawn</h2>
              <div className="flex flex-wrap gap-2">
                {agent.spawn_permissions.map(spawnId => {
                  const target = AGENTS.find(a => a.id === spawnId)
                  return (
                    <Link
                      key={spawnId}
                      href={`/agents/${spawnId}`}
                      style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.22)' }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-purple-500/20 transition-colors min-h-[36px] flex items-center"
                    >
                      {target?.name ?? spawnId}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
