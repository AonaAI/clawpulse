'use client'

import { useEffect, useState } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchHandoffs } from '@/lib/supabase-client'
import type { Task } from '@/lib/types'

// ── Static cron job data ──────────────────────────────────────────────────

interface CronJob {
  id: string
  name: string
  schedule: string
  description: string
  agent_id: string
  last_run: string
  status: 'active' | 'paused' | 'error'
}

const CRON_JOBS: CronJob[] = [
  { id: '1', name: 'Daily Summary Report',       schedule: '0 9 * * *',   description: 'Compile status from all agents into a daily ops report', agent_id: 'main',     last_run: '9 hr ago',  status: 'active' },
  { id: '2', name: 'Weekly Sprint Review',        schedule: '0 10 * * MON', description: 'Review task board, update priorities, send to Slack',     agent_id: 'pm',       last_run: '3 days ago', status: 'active' },
  { id: '3', name: 'SEO Rank Check',              schedule: '0 6 * * *',   description: 'Pull keyword rankings from SERPs for top 50 keywords',     agent_id: 'seo',      last_run: '15 hr ago', status: 'active' },
  { id: '4', name: 'Sales Outreach Batch',        schedule: '0 8 * * MON-FRI', description: 'Send scheduled outreach messages to prospect list',   agent_id: 'sales',    last_run: '7 hr ago',  status: 'active' },
  { id: '5', name: 'Security Benchmark Scan',     schedule: '0 2 * * SUN', description: 'Run weekly AI security compliance checks and log results', agent_id: 'research', last_run: '5 days ago', status: 'active' },
  { id: '6', name: 'Content Calendar Sync',       schedule: '0 8 * * MON', description: 'Sync upcoming content schedule to Notion and Slack',       agent_id: 'seo',      last_run: '3 days ago', status: 'active' },
  { id: '7', name: 'WanderBuddies Analytics',    schedule: '0 18 * * *',  description: 'Pull daily engagement metrics from WanderBuddies channels', agent_id: 'growth',   last_run: '18 hr ago', status: 'paused' },
  { id: '8', name: 'Fiverr Order Monitor',        schedule: '*/30 * * * *', description: 'Check for new Fiverr orders and route to relevant agents', agent_id: 'fiverr',   last_run: '28 min ago', status: 'error' },
]

const STATUS_CONFIG = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', label: 'Active' },
  paused: { color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)', label: 'Paused' },
  error:  { color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)', label: 'Error' },
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
      <h2 style={{ color: '#f8f4ff' }} className="text-lg font-bold">{title}</h2>
      <p style={{ color: '#6b7280' }} className="text-sm mt-0.5">{subtitle}</p>
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
  low:      { color: '#6b7280', label: 'Low' },
  medium:   { color: '#3b82f6', label: 'Medium' },
  high:     { color: '#f59e0b', label: 'High' },
  critical: { color: '#ef4444', label: 'Critical' },
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CommsPage() {
  const [handoffs, setHandoffs] = useState<Task[]>([])
  const [handoffsLoading, setHandoffsLoading] = useState(true)

  useEffect(() => {
    fetchHandoffs().then(data => {
      setHandoffs(data as Task[])
      setHandoffsLoading(false)
    })
  }, [])

  const totalChannels = CHANNEL_MAP.length
  const activeJobs = CRON_JOBS.filter(j => j.status === 'active').length
  const errorJobs = CRON_JOBS.filter(j => j.status === 'error').length

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Comms & Coordination</h1>
        <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">Slack channels, scheduled jobs, and pending handoffs</p>
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
            <span style={{ color: '#6b7280' }} className="text-sm font-medium">{stat.label}</span>
            <span style={{ color: stat.color }} className="text-sm font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-10">
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
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(109,40,217,0.14)',
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
                  <div style={{ color: '#e9e2ff' }} className="text-sm font-semibold truncate">{channel}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {agentIds.map(id => <AgentAvatar key={id} agentId={id} size={20} />)}
                    <span style={{ color: '#374151', fontSize: 11 }} className="font-medium">{agentIds.length} agent{agentIds.length !== 1 ? 's' : ''}</span>
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
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(109,40,217,0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl overflow-hidden"
          >
            {CRON_JOBS.map((job, i) => {
              const agent = AGENTS.find(a => a.id === job.agent_id)
              const status = STATUS_CONFIG[job.status]
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
                    style={{ background: status.color, boxShadow: job.status === 'active' ? `0 0 6px ${status.color}88` : undefined }}
                    className="w-2 h-2 rounded-full flex-shrink-0"
                  />

                  {/* Job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ color: '#e9e2ff' }} className="text-sm font-semibold">{job.name}</span>
                      <span
                        style={{ color: status.color, background: status.bg, border: `1px solid ${status.border}` }}
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      >
                        {status.label}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280' }} className="text-xs mt-0.5 truncate">{job.description}</p>
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
                    <span style={{ color: '#374151' }} className="text-xs font-medium">{job.last_run}</span>
                  </div>
                </div>
              )
            })}
          </div>
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
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.1)', height: 72 }} className="rounded-xl animate-pulse" />
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
              <span style={{ color: '#6b7280' }} className="text-xs">All blocked tasks are clear</span>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(109,40,217,0.14)',
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
                        <span style={{ color: '#e9e2ff' }} className="text-sm font-semibold truncate">{task.title}</span>
                        <span
                          style={{ color: priority.color, background: `${priority.color}12`, border: `1px solid ${priority.color}30` }}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                        >
                          {priority.label}
                        </span>
                      </div>
                      {task.description && (
                        <p style={{ color: '#6b7280' }} className="text-xs mt-0.5 truncate">{task.description}</p>
                      )}
                    </div>

                    {/* Project */}
                    <span
                      style={{ color: '#6b7280', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11 }}
                      className="hidden sm:block px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
                    >
                      {task.project}
                    </span>

                    {/* Assigned agent */}
                    {agent && (
                      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                        <AgentAvatar agentId={agent.id} size={22} />
                        <span style={{ color: '#6b7280' }} className="text-xs">{agent.name}</span>
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
