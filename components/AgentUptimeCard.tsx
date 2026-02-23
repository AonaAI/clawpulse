'use client'

import type { Session } from '@/lib/types'

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000

function computeUptime(sessions: Session[]): number {
  const now = Date.now()
  const windowStart = now - SEVEN_DAYS_MS

  let activeMs = 0
  for (const s of sessions) {
    const start = Math.max(new Date(s.started_at).getTime(), windowStart)
    const rawEnd =
      s.status === 'active'
        ? now
        : s.last_active
        ? new Date(s.last_active).getTime()
        : new Date(s.started_at).getTime()
    const end = Math.min(rawEnd, now)
    if (end > start) activeMs += end - start
  }

  return Math.min((activeMs / SEVEN_DAYS_MS) * 100, 100)
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remH = hours % 24
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`
  }
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function computeStreak(sessions: Session[], agentStatus: string): string {
  if (sessions.length === 0) return '—'

  const now = Date.now()
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )
  const latest = sorted[0]

  if (agentStatus === 'working' && latest.status === 'active') {
    return formatDuration(now - new Date(latest.started_at).getTime())
  }
  if (latest.last_active) {
    return formatDuration(now - new Date(latest.last_active).getTime())
  }
  return '—'
}

function computeAvgDuration(sessions: Session[]): number {
  const withDur = sessions.filter(s => (s.duration_minutes ?? 0) > 0)
  if (withDur.length === 0) return 0
  return Math.round(
    withDur.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / withDur.length
  )
}

function computeSessionsToday(sessions: Session[]): number {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.started_at) >= todayStart).length
}

interface StatBoxProps {
  label: string
  value: string
  sub: string
  color: string
}

function StatBox({ label, value, sub, color }: StatBoxProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
      }}
      className="p-3"
    >
      <div
        style={{ color: 'var(--cp-text-dim)', fontSize: 10 }}
        className="font-semibold uppercase tracking-wider mb-1"
      >
        {label}
      </div>
      <div style={{ color }} className="text-xl font-bold truncate">
        {value}
      </div>
      <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-0.5">
        {sub}
      </div>
    </div>
  )
}

export default function AgentUptimeCard({
  sessions,
  loading,
  agentStatus,
}: {
  sessions: Session[]
  loading: boolean
  agentStatus: string
}) {
  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">
          Health Stats
        </h2>
        <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-0.5">
          Last 7 days
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-4">
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-4">
          No session data available
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Uptime"
            value={`${computeUptime(sessions).toFixed(1)}%`}
            sub="last 7 days"
            color={
              computeUptime(sessions) >= 95
                ? '#34d399'
                : computeUptime(sessions) >= 80
                ? '#fbbf24'
                : '#f87171'
            }
          />
          <StatBox
            label="Streak"
            value={computeStreak(sessions, agentStatus)}
            sub="current state"
            color="#8b5cf6"
          />
          <StatBox
            label="Avg Session"
            value={computeAvgDuration(sessions) > 0 ? `${computeAvgDuration(sessions)}m` : '—'}
            sub="duration"
            color="#22d3ee"
          />
          <StatBox
            label="Today"
            value={String(computeSessionsToday(sessions))}
            sub="sessions"
            color="#f59e0b"
          />
        </div>
      )}
    </div>
  )
}
