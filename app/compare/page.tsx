'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchTasks, fetchTokenStatsByAgent, fetchActivityLog, fetchSessions } from '@/lib/supabase-client'
import type { Task, ActivityLog } from '@/lib/types'
import ExportButton, { exportToCSV } from '@/components/ExportButton'

// ── Color palette for dark purple theme ──────────────────────────────────
const PALETTE = [
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#fb923c', // orange
]

function agentColor(idx: number) {
  return PALETTE[idx % PALETTE.length]
}

// ── Card wrapper ─────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-5"
    >
      <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── SVG Bar Chart ────────────────────────────────────────────────────────
function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1)
  const barW = Math.min(40, Math.floor(220 / Math.max(items.length, 1)))
  const chartW = items.length * (barW + 12) + 20
  const h = 140
  return (
    <svg width="100%" height={h + 30} viewBox={`0 0 ${Math.max(chartW, 200)} ${h + 30}`}>
      {items.map((item, i) => {
        const barH = max > 0 ? (item.value / max) * (h - 10) : 0
        const x = 10 + i * (barW + 12)
        return (
          <g key={item.label}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={4} fill={item.color} opacity={0.85} />
            <text x={x + barW / 2} y={h - barH - 6} textAnchor="middle" fill={item.color} fontSize={11} fontWeight={700}>
              {item.value >= 1000 ? `${(item.value / 1000).toFixed(0)}k` : item.value}
            </text>
            <text x={x + barW / 2} y={h + 16} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10}>
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── SVG Line Chart (7-day activity) ──────────────────────────────────────
function LineChart({ series }: { series: { label: string; color: string; data: number[] }[] }) {
  const allVals = series.flatMap(s => s.data)
  const max = Math.max(...allVals, 1)
  const w = 320
  const h = 140
  const padX = 10
  const padY = 10
  const days = 7

  return (
    <svg width="100%" height={h + 30} viewBox={`0 0 ${w} ${h + 30}`}>
      {/* Day labels */}
      {Array.from({ length: days }).map((_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000)
        const label = d.toLocaleDateString('en', { weekday: 'short' })
        const x = padX + (i / (days - 1)) * (w - 2 * padX)
        return (
          <text key={i} x={x} y={h + 20} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10}>
            {label}
          </text>
        )
      })}
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => (
        <line
          key={frac}
          x1={padX}
          x2={w - padX}
          y1={padY + (1 - frac) * (h - 2 * padY)}
          y2={padY + (1 - frac) * (h - 2 * padY)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      {/* Lines */}
      {series.map(s => {
        const points = s.data.map((v, i) => {
          const x = padX + (i / (days - 1)) * (w - 2 * padX)
          const y = padY + (1 - v / max) * (h - 2 * padY)
          return `${x},${y}`
        })
        return (
          <g key={s.label}>
            <polyline points={points.join(' ')} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            {s.data.map((v, i) => {
              const x = padX + (i / (days - 1)) * (w - 2 * padX)
              const y = padY + (1 - v / max) * (h - 2 * padY)
              return <circle key={i} cx={x} cy={y} r={3} fill={s.color} />
            })}
          </g>
        )
      })}
    </svg>
  )
}

// ── Donut / Ring ─────────────────────────────────────────────────────────
function CompletionRings({ items }: { items: { label: string; done: number; total: number; color: string }[] }) {
  const size = 80
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  return (
    <div className="flex flex-wrap gap-6 justify-center">
      {items.map(item => {
        const pct = item.total > 0 ? item.done / item.total : 0
        return (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <svg width={size} height={size}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={item.color}
                strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                opacity={item.total > 0 ? 0.85 : 0.2}
              />
              <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={item.color} fontSize={14} fontWeight={700}>
                {item.total > 0 ? `${Math.round(pct * 100)}%` : '—'}
              </text>
            </svg>
            <span style={{ color: item.color, fontSize: 12, fontWeight: 600 }}>{item.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{item.total > 0 ? `${item.done}/${item.total} done` : 'no tasks assigned'}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Stat boxes ───────────────────────────────────────────────────────────
function StatBoxes({ items }: { items: { label: string; value: string | number; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      {items.map(item => (
        <div
          key={item.label}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${item.color}22`,
            borderRadius: 12,
            padding: '16px 24px',
            minWidth: 100,
            textAlign: 'center',
          }}
        >
          <div style={{ color: item.color, fontSize: 24, fontWeight: 700 }}>{item.value}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Agent multi-select ───────────────────────────────────────────────────
function AgentPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else if (selected.length < 3) {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {AGENTS.map((a, i) => {
        const isSelected = selected.includes(a.id)
        const color = isSelected ? agentColor(selected.indexOf(a.id)) : 'rgba(255,255,255,0.3)'
        return (
          <button
            key={a.id}
            onClick={() => toggle(a.id)}
            style={{
              background: isSelected ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
              color: isSelected ? color : 'rgba(255,255,255,0.5)',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: isSelected ? 700 : 500,
              cursor: selected.length >= 3 && !isSelected ? 'not-allowed' : 'pointer',
              opacity: selected.length >= 3 && !isSelected ? 0.4 : 1,
              transition: 'all 0.2s',
            }}
          >
            {a.name}
            {isSelected && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>✕</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [tokenStats, setTokenStats] = useState<{ agent_id: string; total_tokens: number }[]>([])
  const [activityByAgent, setActivityByAgent] = useState<Record<string, number[]>>({})
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Default: pick 2 most active agents
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [taskData, tokenData, actData] = await Promise.all([
          fetchTasks(),
          fetchTokenStatsByAgent(),
          fetchActivityLog(500),
        ])
        setTasks(taskData)
        setTokenStats(tokenData)

        // Build 7-day activity per agent
        const now = Date.now()
        const actMap: Record<string, number[]> = {}
        for (const a of AGENTS) {
          actMap[a.id] = Array(7).fill(0)
        }
        for (const log of actData as unknown as ActivityLog[]) {
          const dayIdx = 6 - Math.floor((now - new Date(log.created_at).getTime()) / 86400000)
          if (dayIdx >= 0 && dayIdx < 7 && actMap[log.agent_id]) {
            actMap[log.agent_id][dayIdx]++
          }
        }
        setActivityByAgent(actMap)

        // Session counts
        const sessCounts: Record<string, number> = {}
        await Promise.all(
          AGENTS.map(async (a) => {
            const sessions = await fetchSessions(a.id, 100)
            sessCounts[a.id] = sessions.length
          })
        )
        setSessionCounts(sessCounts)

        // Default: 2 most active (by total tokens)
        const sorted = [...tokenData].sort((a, b) => b.total_tokens - a.total_tokens)
        const top2 = sorted.slice(0, 2).map(s => s.agent_id)
        if (top2.length >= 2) {
          setSelected(top2)
        } else {
          setSelected(AGENTS.slice(0, 2).map(a => a.id))
        }
      } catch (err) {
        console.error('Compare page init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const selectedAgents = useMemo(() =>
    selected.map(id => AGENTS.find(a => a.id === id)!).filter(Boolean),
    [selected]
  )

  const tokenItems = useMemo(() =>
    selected.map((id, i) => {
      const stat = tokenStats.find(s => s.agent_id === id)
      const agent = AGENTS.find(a => a.id === id)
      return { label: agent?.name || id, value: stat?.total_tokens || 0, color: agentColor(i) }
    }),
    [selected, tokenStats]
  )

  const completionItems = useMemo(() =>
    selected.map((id, i) => {
      const agentTasks = tasks.filter(t => t.assigned_agent === id)
      const done = agentTasks.filter(t => t.status === 'done').length
      const agent = AGENTS.find(a => a.id === id)
      return { label: agent?.name || id, done, total: agentTasks.length, color: agentColor(i) }
    }),
    [selected, tasks]
  )

  const activitySeries = useMemo(() =>
    selected.map((id, i) => {
      const agent = AGENTS.find(a => a.id === id)
      return { label: agent?.name || id, color: agentColor(i), data: activityByAgent[id] || Array(7).fill(0) }
    }),
    [selected, activityByAgent]
  )

  const sessionItems = useMemo(() =>
    selected.map((id, i) => {
      const agent = AGENTS.find(a => a.id === id)
      return { label: agent?.name || id, value: sessionCounts[id] || 0, color: agentColor(i) }
    }),
    [selected, sessionCounts]
  )

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="skeleton-shimmer" style={{ width: 280, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer mt-3" style={{ width: 360, height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer mt-6" style={{ width: '100%', height: 48, borderRadius: 12 }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: 'rgba(17,2,29,0.6)', border: '1px solid rgba(109,40,217,0.14)' }} className="rounded-xl p-5">
              <div className="skeleton-shimmer mb-4" style={{ width: 160, height: 18, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '100%', height: 180, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
            Agent Comparison
          </h1>
          <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm mt-1">
            Select 2–3 agents to compare metrics side by side
          </p>
        </div>
        <ExportButton onExportCSV={() => {
          const agentNames = selected.map(id => AGENTS.find(a => a.id === id)?.name || id)
          const rows = selected.map(id => {
            const a = AGENTS.find(x => x.id === id)
            const ts = tokenStats.find(t => t.agent_id === id)
            const taskCount = tasks.filter(t => t.assigned_agent === id).length
            return [a?.name || id, taskCount, ts?.total_tokens || 0, sessionCounts[id] || 0]
          })
          exportToCSV('clawpulse-compare', ['Agent', 'Tasks', 'Total Tokens', 'Sessions'], rows)
        }} />
      </div>

      {/* Agent picker */}
      <div
        style={{
          background: 'rgba(17, 2, 29, 0.6)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl p-4 mb-6"
      >
        <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          SELECT AGENTS (max 3)
        </div>
        <AgentPicker selected={selected} onChange={setSelected} />
      </div>

      {/* Prompt if < 2 */}
      {selected.length < 2 && (
        <div
          style={{
            background: 'rgba(109, 40, 217, 0.08)',
            border: '1px solid rgba(109, 40, 217, 0.2)',
            color: 'var(--cp-text-secondary)',
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <circle cx="9" cy="7" r="4" />
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Select at least 2 agents to compare</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Pick from the agent chips above</div>
        </div>
      )}

      {/* Comparison grid */}
      {selected.length >= 2 && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-5">
            {selectedAgents.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: agentColor(i) }} />
                <span style={{ color: agentColor(i), fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{a.role}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Token usage */}
            <Card title="Token Usage">
              <BarChart items={tokenItems} />
            </Card>

            {/* Task completion */}
            <Card title="Task Completion Rate">
              <CompletionRings items={completionItems} />
            </Card>

            {/* Activity volume 7d */}
            <Card title="Activity Volume (7 days)">
              <LineChart series={activitySeries} />
            </Card>

            {/* Session count */}
            <Card title="Session Count">
              <StatBoxes items={sessionItems} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
