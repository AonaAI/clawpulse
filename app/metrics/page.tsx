'use client'

import { useEffect, useState } from 'react'
import { fetchTasks, fetchActivityLog } from '@/lib/supabase-client'
import { AGENTS } from '@/lib/data'
import type { Task } from '@/lib/types'

// ── Chart primitives ──────────────────────────────────────────────────────

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 8, overflow: 'hidden', flex: 1 }}>
      <div
        style={{
          width: `${pct}%`,
          background: color,
          height: '100%',
          borderRadius: 4,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
          minWidth: value > 0 ? 4 : 0,
        }}
      />
    </div>
  )
}

interface BarRow {
  label: string
  value: number
  color: string
  subLabel?: string
}

function BarTable({ rows, max }: { rows: BarRow[]; max: number }) {
  if (rows.length === 0) return (
    <div style={{ color: '#374151' }} className="text-sm text-center py-8">No data yet</div>
  )
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.label} className="flex items-center gap-3">
          <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, minWidth: 80, textAlign: 'right' }} className="truncate">
            {row.label}
          </div>
          <HBar value={row.value} max={max} color={row.color} />
          <div style={{ color: row.color, fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, bg, border }: {
  label: string
  value: string | number
  sub?: string
  color: string
  bg: string
  border: string
}) {
  return (
    <div
      style={{ background: bg, border: `1px solid ${border}`, backdropFilter: 'blur(12px)' }}
      className="rounded-xl p-5"
    >
      <div style={{ color: '#6b7280' }} className="text-xs font-bold uppercase tracking-wider mb-2">{label}</div>
      <div style={{ color }} className="text-3xl font-bold leading-none">{value}</div>
      {sub && <div style={{ color: '#6b7280' }} className="text-xs mt-1.5 font-medium">{sub}</div>}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
      className="rounded-xl p-6"
    >
      <div className="mb-5">
        <h2 style={{ color: '#f8f4ff' }} className="text-base font-bold">{title}</h2>
        <p style={{ color: '#6b7280' }} className="text-xs mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// ── Activity mini-timeline ────────────────────────────────────────────────

interface ActivityItem {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  time: string
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return (
    <div style={{ color: '#374151' }} className="text-sm text-center py-8">No activity yet</div>
  )
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const agent = AGENTS.find(a => a.id === item.agent_id)
        return (
          <div key={item.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center flex-shrink-0 pt-1">
              <div
                style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.22)', color: '#8b5cf6', width: 28, height: 28, fontSize: 10 }}
                className="rounded-lg flex items-center justify-center font-bold"
              >
                {(agent?.name ?? item.agent_id).slice(0, 2).toUpperCase()}
              </div>
              {i < items.length - 1 && (
                <div style={{ width: 1, height: 20, background: 'rgba(109,40,217,0.12)', marginTop: 4 }} />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span style={{ color: '#c4b5fd' }} className="text-sm font-semibold">{item.agent_name}</span>
                <span style={{ color: '#e9e2ff' }} className="text-sm">{item.action}</span>
              </div>
              {item.details && <p style={{ color: '#6b7280' }} className="text-xs mt-0.5">{item.details}</p>}
            </div>
            <span style={{ color: '#374151' }} className="text-xs flex-shrink-0 pt-0.5">{item.time}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo:        '#9ca3af',
  in_progress: '#60a5fa',
  done:        '#34d399',
  blocked:     '#f87171',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      '#6b7280',
  medium:   '#3b82f6',
  high:     '#f59e0b',
  critical: '#ef4444',
}

export default function MetricsPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchTasks(), fetchActivityLog(20)]).then(([t, a]) => {
      setTasks(t as Task[])
      setActivity(a as ActivityItem[])
      setLoading(false)
    })
  }, [])

  // ── Derived metrics ─────────────────────────────────────────────────────
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  // Status distribution
  const statusRows: BarRow[] = [
    { label: 'To Do',      value: tasks.filter(t => t.status === 'todo').length,        color: STATUS_COLORS.todo },
    { label: 'In Progress',value: tasks.filter(t => t.status === 'in_progress').length, color: STATUS_COLORS.in_progress },
    { label: 'Done',       value: tasks.filter(t => t.status === 'done').length,        color: STATUS_COLORS.done },
    { label: 'Blocked',    value: tasks.filter(t => t.status === 'blocked').length,     color: STATUS_COLORS.blocked },
  ].filter(r => r.value > 0)
  const statusMax = Math.max(...statusRows.map(r => r.value), 1)

  // Tasks per agent
  const agentRows: BarRow[] = AGENTS.map(agent => ({
    label: agent.name,
    value: tasks.filter(t => t.assigned_agent === agent.id).length,
    color: '#8b5cf6',
    subLabel: agent.role,
  })).filter(r => r.value > 0).sort((a, b) => b.value - a.value)
  const agentMax = Math.max(...agentRows.map(r => r.value), 1)

  // Priority distribution
  const priorityRows: BarRow[] = [
    { label: 'Critical', value: tasks.filter(t => t.priority === 'critical').length, color: PRIORITY_COLORS.critical },
    { label: 'High',     value: tasks.filter(t => t.priority === 'high').length,     color: PRIORITY_COLORS.high },
    { label: 'Medium',   value: tasks.filter(t => t.priority === 'medium').length,   color: PRIORITY_COLORS.medium },
    { label: 'Low',      value: tasks.filter(t => t.priority === 'low').length,      color: PRIORITY_COLORS.low },
  ].filter(r => r.value > 0)
  const priorityMax = Math.max(...priorityRows.map(r => r.value), 1)

  // Tasks per project
  const projectCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.project] = (acc[t.project] ?? 0) + 1
    return acc
  }, {})
  const projectRows: BarRow[] = Object.entries(projectCounts)
    .map(([label, value]) => ({ label, value, color: '#22d3ee' }))
    .sort((a, b) => b.value - a.value)
  const projectMax = Math.max(...projectRows.map(r => r.value), 1)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Metrics</h1>
        <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">Task throughput, agent workload, and system activity</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.1)', height: 96 }} className="rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Tasks"
              value={total}
              sub="across all agents"
              color="#a78bfa"
              bg="rgba(167,139,250,0.06)"
              border="rgba(167,139,250,0.18)"
            />
            <StatCard
              label="Completion Rate"
              value={`${completionRate}%`}
              sub={`${done} of ${total} done`}
              color="#34d399"
              bg="rgba(52,211,153,0.06)"
              border="rgba(52,211,153,0.18)"
            />
            <StatCard
              label="In Progress"
              value={inProgress}
              sub="active right now"
              color="#60a5fa"
              bg="rgba(96,165,250,0.06)"
              border="rgba(96,165,250,0.18)"
            />
            <StatCard
              label="Blocked"
              value={blocked}
              sub="need attention"
              color="#f87171"
              bg="rgba(248,113,113,0.06)"
              border="rgba(248,113,113,0.18)"
            />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Section title="Tasks by Status" subtitle="Distribution across kanban columns">
              <BarTable rows={statusRows} max={statusMax} />
            </Section>

            <Section title="Tasks by Priority" subtitle="Urgency breakdown across all tasks">
              <BarTable rows={priorityRows} max={priorityMax} />
            </Section>

            <Section title="Tasks per Agent" subtitle="Workload distribution — all statuses">
              {agentRows.length === 0 ? (
                <div style={{ color: '#374151' }} className="text-sm text-center py-8">No assignments yet</div>
              ) : (
                <BarTable rows={agentRows} max={agentMax} />
              )}
            </Section>

            <Section title="Tasks by Project" subtitle="Volume of tasks per project area">
              <BarTable rows={projectRows} max={projectMax} />
            </Section>
          </div>

          {/* Activity feed */}
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 style={{ color: '#f8f4ff' }} className="text-base font-bold">Recent Activity</h2>
                <p style={{ color: '#6b7280' }} className="text-xs mt-0.5">Latest actions logged across all agents</p>
              </div>
              <span
                style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
              >
                {activity.length} events
              </span>
            </div>
            <ActivityFeed items={activity} />
            {activity.length === 0 && (
              <div style={{ color: '#374151' }} className="text-sm text-center py-4">
                No activity log data — make sure the <code className="font-mono">activity_log</code> table has rows.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
