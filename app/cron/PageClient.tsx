'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronSession {
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

interface CronJob {
  id: string          // extracted cron job identifier
  name: string        // human-readable name
  schedule: string    // cron expression or interval hint
  lastRun: string | null
  nextRun: string | null
  status: 'active' | 'paused' | 'errored'
  successCount: number
  failCount: number
  runs: CronSession[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCronId(sessionKey: string): string {
  // session_key looks like "cron:job-name:uuid" or "cron:job-name"
  const parts = sessionKey.split(':')
  if (parts.length >= 2) return parts[1]
  return sessionKey
}

function extractCronName(cronId: string): string {
  return cronId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function guessSchedule(cronId: string): string {
  const id = cronId.toLowerCase()
  if (id.includes('hourly')) return '0 * * * *'
  if (id.includes('daily')) return '0 0 * * *'
  if (id.includes('weekly')) return '0 0 * * 0'
  if (id.includes('heartbeat')) return '*/5 * * * *'
  if (id.includes('sync')) return '*/15 * * * *'
  if (id.includes('cleanup')) return '0 3 * * *'
  if (id.includes('report')) return '0 9 * * *'
  return 'recurring'
}

function estimateNextRun(lastRun: string | null, schedule: string): string | null {
  if (!lastRun) return null
  const last = new Date(lastRun)
  let intervalMs = 3600000 // default 1h
  if (schedule.startsWith('*/5')) intervalMs = 5 * 60000
  else if (schedule.startsWith('*/15')) intervalMs = 15 * 60000
  else if (schedule.includes('0 0 * * *')) intervalMs = 86400000
  else if (schedule.includes('0 0 * * 0')) intervalMs = 7 * 86400000
  const next = new Date(last.getTime() + intervalMs)
  return next > new Date() ? next.toISOString() : null
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—'
  if (minutes === 0) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatAvgDuration(runs: CronSession[]): string {
  const durations = runs.filter(r => r.duration_minutes !== null).map(r => r.duration_minutes!)
  if (durations.length === 0) return '—'
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length
  return formatDuration(Math.round(avg))
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Active' },
  paused: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', label: 'Paused' },
  errored: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Errored' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function CronDetailPanel({ job, onClose }: { job: CronJob; onClose: () => void }) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const successRate = job.successCount + job.failCount > 0
    ? Math.round((job.successCount / (job.successCount + job.failCount)) * 100)
    : 100

  const statusCfg = STATUS_CONFIG[job.status]
  const recentRuns = job.runs.slice(0, 10)

  const toggleError = (id: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
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
        className="fixed top-0 right-0 z-50 h-full w-full md:w-[480px] overflow-y-auto shadow-2xl animate-slide-in-right"
      >
        {/* Header */}
        <div
          style={{ borderBottom: '1px solid var(--cp-divider-accent)', background: 'var(--cp-card-solid-bg)' }}
          className="px-5 py-4 flex items-start justify-between gap-3 sticky top-0 z-10"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div
                style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 28, height: 28, minWidth: 28 }}
                className="rounded-lg flex items-center justify-center flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-sm">{job.name}</span>
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
              {job.schedule}
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

        {/* Success Rate */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(109,40,217,0.08)' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Success Rate</span>
            <span style={{ color: successRate >= 80 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171', fontSize: 16, fontWeight: 700 }}>
              {successRate}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--cp-separator-bg)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${successRate}%`,
              height: '100%',
              background: successRate >= 80 ? 'linear-gradient(90deg, #34d399, #22d3ee)' : successRate >= 50 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #f87171, #ef4444)',
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ color: '#34d399', fontSize: 11 }}>{job.successCount} succeeded</span>
            <span style={{ color: '#f87171', fontSize: 11 }}>{job.failCount} failed</span>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 py-3 grid grid-cols-2 gap-3" style={{ borderBottom: '1px solid rgba(109,40,217,0.08)' }}>
          {[
            { label: 'Last Run', value: job.lastRun ? formatTimestamp(job.lastRun) : '—' },
            { label: 'Next Run', value: job.nextRun ? formatTimestamp(job.nextRun) : '—' },
            { label: 'Total Runs', value: job.runs.length.toString() },
            { label: 'Avg Duration', value: formatAvgDuration(job.runs) },
          ].map(s => (
            <div key={s.label}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
              <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Run History */}
        <div className="px-5 py-4">
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Run History — Last {recentRuns.length}
          </div>
          {recentRuns.length === 0 ? (
            <div className="text-center py-6">
              <div style={{ color: 'var(--cp-text-muted)', fontSize: 13, fontWeight: 600 }}>No runs recorded</div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => {
                const isFailed = run.status === 'failed'
                const isExpanded = expandedErrors.has(run.id)
                const runStatusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.completed
                return (
                  <div key={run.id}>
                    <div
                      onClick={() => isFailed && toggleError(run.id)}
                      style={{
                        background: isFailed ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.015)',
                        border: `1px solid ${isFailed ? 'rgba(248,113,113,0.2)' : 'rgba(109,40,217,0.08)'}`,
                        borderRadius: 8,
                        cursor: isFailed ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                      }}
                      className={isFailed ? 'hover:border-red-500/30' : ''}
                    >
                      <div className="px-3 py-2.5 flex items-center gap-3">
                        {/* Status dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: runStatusCfg.color, boxShadow: `0 0 6px ${runStatusCfg.color}44`, flexShrink: 0 }} />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ color: 'var(--cp-text-secondary)', fontSize: 12, fontWeight: 500 }}>
                              {formatTimestamp(run.started_at)}
                            </span>
                            <span
                              style={{ background: runStatusCfg.bg, border: `1px solid ${runStatusCfg.border}`, color: runStatusCfg.color }}
                              className="text-xs px-1.5 py-0 rounded font-semibold" style-font-size="10px"
                            >
                              {runStatusCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                              {formatDuration(run.duration_minutes)}
                            </span>
                            {run.agent_name && (
                              <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                                {run.agent_name}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Expand arrow for failed */}
                        {isFailed && (
                          <svg
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            style={{ color: '#f87171', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </div>
                      {/* Error details */}
                      {isFailed && isExpanded && (
                        <div style={{ borderTop: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.03)', borderRadius: '0 0 7px 7px' }} className="px-3 py-2.5">
                          <div style={{ color: '#f87171', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Error Details</div>
                          <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12, lineHeight: 1.5 }} className="whitespace-pre-wrap font-mono">
                            {run.session_key.includes('error') ? `Session failed: ${run.session_key}` : `Cron job run failed at ${formatTimestamp(run.started_at)}`}
                            {run.last_active && run.started_at && (
                              <>{'\n'}Duration before failure: {formatDuration(run.duration_minutes)}</>
                            )}
                            {run.token_count > 0 && <>{'\n'}Tokens consumed: {run.token_count.toLocaleString()}</>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CronJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null)

  const loadCronJobs = useCallback(async () => {
    setLoading(true)

    // Fetch all sessions where session_key contains "cron:"
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*, agent:agents(name)')
      .ilike('session_key', '%:cron:%')
      .order('started_at', { ascending: false })

    if (error) {
      console.error('Error fetching cron sessions:', error)
      setLoading(false)
      return
    }

    // Group by cron job ID
    const jobMap = new Map<string, CronSession[]>()
    for (const row of data || []) {
      const agentRow = row.agent as unknown as { name: string } | null
      const cronId = extractCronId(row.session_key)
      const durationMs = row.last_active && row.started_at
        ? new Date(row.last_active).getTime() - new Date(row.started_at).getTime()
        : null

      const session: CronSession = {
        id: row.id,
        agent_id: row.agent_id,
        agent_name: agentRow?.name || row.agent_id,
        session_key: row.session_key,
        status: row.status || 'completed',
        started_at: row.started_at,
        last_active: row.last_active,
        duration_minutes: durationMs !== null ? Math.round(durationMs / 60000) : null,
        token_count: row.token_count ?? 0,
        model: row.model,
      }

      if (!jobMap.has(cronId)) jobMap.set(cronId, [])
      jobMap.get(cronId)!.push(session)
    }

    // Build CronJob objects
    const cronJobs: CronJob[] = Array.from(jobMap.entries()).map(([cronId, runs]) => {
      // Sort runs by started_at descending
      runs.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

      const successCount = runs.filter(r => r.status === 'completed' || r.status === 'active').length
      const failCount = runs.filter(r => r.status === 'failed').length
      const lastRun = runs[0]?.started_at ?? null

      // Determine job status
      const recentFailed = runs.slice(0, 3).some(r => r.status === 'failed')
      const hasActiveRun = runs.some(r => r.status === 'active')
      const schedule = guessSchedule(cronId)

      let status: 'active' | 'paused' | 'errored' = 'active'
      if (recentFailed && failCount > successCount) status = 'errored'
      else if (!hasActiveRun && lastRun) {
        const hoursSinceLastRun = (Date.now() - new Date(lastRun).getTime()) / 3600000
        if (hoursSinceLastRun > 48) status = 'paused'
      }

      return {
        id: cronId,
        name: extractCronName(cronId),
        schedule,
        lastRun,
        nextRun: estimateNextRun(lastRun, schedule),
        status,
        successCount,
        failCount,
        runs,
      }
    })

    // Sort: errored first, then active, then paused
    const statusOrder = { errored: 0, active: 1, paused: 2 }
    cronJobs.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

    setJobs(cronJobs)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCronJobs()
  }, [loadCronJobs])

  // Summary stats
  const totalJobs = jobs.length
  const activeJobs = jobs.filter(j => j.status === 'active').length
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const failedToday = jobs.reduce((sum, j) => sum + j.runs.filter(r => r.status === 'failed' && new Date(r.started_at) >= todayStart).length, 0)
  const allRuns = jobs.flatMap(j => j.runs)
  const avgDuration = formatAvgDuration(allRuns)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
          Cron Jobs
        </h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
          Scheduled &amp; recurring job monitoring
          {totalJobs > 0 && <span style={{ color: 'var(--cp-text-accent-light)' }} className="ml-2 font-bold">· {totalJobs} jobs</span>}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Jobs', value: loading ? '…' : totalJobs.toString(), color: 'var(--cp-text-accent-light)', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.15)' },
          { label: 'Active', value: loading ? '…' : activeJobs.toString(), color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
          { label: 'Failed Today', value: loading ? '…' : failedToday.toString(), color: failedToday > 0 ? '#f87171' : 'var(--cp-text-secondary)', bg: failedToday > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(148,163,184,0.08)', border: failedToday > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)' },
          { label: 'Avg Run Duration', value: loading ? '…' : avgDuration, color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.15)' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{ background: 'var(--cp-card-bg)', border: `1px solid ${stat.border}`, backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-4"
          >
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Job Cards */}
      {loading ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-12 text-center">
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Loading cron jobs…</div>
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-16 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.35)" strokeWidth="1.5" style={{ margin: '0 auto 10px' }}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-semibold">No cron jobs found</div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-2 max-w-sm mx-auto">
            Cron jobs are detected from agent sessions with <code style={{ background: 'rgba(109,40,217,0.1)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>cron:</code> prefix in session keys.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map(job => {
            const isSelected = selectedJob?.id === job.id
            const statusCfg = STATUS_CONFIG[job.status]
            const successRate = job.successCount + job.failCount > 0
              ? Math.round((job.successCount / (job.successCount + job.failCount)) * 100)
              : 100

            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(isSelected ? null : job)}
                style={{
                  background: isSelected ? 'rgba(109,40,217,0.08)' : 'var(--cp-card-bg)',
                  border: `1px solid ${isSelected ? 'rgba(139,92,246,0.3)' : job.status === 'errored' ? 'rgba(248,113,113,0.2)' : 'var(--cp-border)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(12px)',
                }}
                className="rounded-xl p-4 hover:border-purple-500/30 hover:bg-white/[0.02]"
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 28, height: 28, minWidth: 28 }}
                      className="rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm truncate">
                      {job.name}
                    </span>
                  </div>
                  <span
                    style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }}
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Schedule */}
                <code style={{ fontSize: 11, color: 'var(--cp-text-accent-light)', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.12)', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 10 }}>
                  {job.schedule}
                </code>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 600 }}>Last Run</div>
                    <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12, fontWeight: 500 }}>
                      {job.lastRun ? formatTimestamp(job.lastRun) : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 600 }}>Next Run</div>
                    <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12, fontWeight: 500 }}>
                      {job.nextRun ? formatTimestamp(job.nextRun) : '—'}
                    </div>
                  </div>
                </div>

                {/* Success/Fail counts */}
                <div className="flex items-center gap-3 mb-2">
                  <span style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>✓ {job.successCount}</span>
                  <span style={{ color: job.failCount > 0 ? '#f87171' : 'var(--cp-text-dim)', fontSize: 11, fontWeight: 600 }}>✗ {job.failCount}</span>
                </div>

                {/* Success rate bar */}
                <div style={{ height: 4, background: 'var(--cp-separator-bg)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${successRate}%`,
                    height: '100%',
                    background: successRate >= 80 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171',
                    borderRadius: 2,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Side Panel */}
      {selectedJob && (
        <CronDetailPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  )
}
