'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchTasks, fetchTokenStatsByAgent, fetchActivityLog, fetchSessions } from '@/lib/supabase-client'
import type { Task, ActivityLog, Session } from '@/lib/types'
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

// ── Delta indicator ──────────────────────────────────────────────────────
function Delta({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (value === 0) return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>—</span>
  const positive = invert ? value < 0 : value > 0
  const color = positive ? '#34d399' : '#f87171'
  const arrow = value > 0 ? '▲' : '▼'
  const display = Math.abs(value)
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600 }}>
      {arrow} {display >= 1000 ? `${(display / 1000).toFixed(1)}k` : display.toFixed(suffix === '$' ? 2 : 1)}{suffix}
    </span>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
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
      {[0, 0.25, 0.5, 0.75, 1].map(frac => (
        <line
          key={frac}
          x1={padX}
          x2={w - padX}
          y1={padY + (1 - frac) * (h - 2 * padY)}
          y2={padY + (1 - frac) * (h - 2 * padY)}
          stroke="var(--cp-border-subtle)"
          strokeWidth={1}
        />
      ))}
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
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cp-border-subtle)" strokeWidth={stroke} />
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
            background: 'var(--cp-card-bg)',
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

// ── Session Timeline ─────────────────────────────────────────────────────
function SessionTimeline({ sessions, color, label }: { sessions: Session[]; color: string; label: string }) {
  if (!sessions.length) {
    return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '12px 0' }}>No sessions</div>
  }
  const latest = sessions.slice(0, 8)
  const maxTokens = Math.max(...latest.map(s => s.token_count || 0), 1)

  return (
    <div>
      <div style={{ color, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div className="flex flex-col gap-1">
        {latest.map((s, i) => {
          const pct = maxTokens > 0 ? ((s.token_count || 0) / maxTokens) * 100 : 0
          const duration = s.duration_minutes != null ? `${s.duration_minutes}m` : '—'
          const time = s.started_at ? new Date(s.started_at).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div key={s.id || i} className="flex items-center gap-2" style={{ fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', width: 90, flexShrink: 0 }}>{time}</span>
              <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: color, opacity: 0.7, borderRadius: 4 }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', width: 50, textAlign: 'right', flexShrink: 0 }}>{duration}</span>
              <span style={{ color, width: 55, textAlign: 'right', flexShrink: 0 }}>
                {(s.token_count || 0) >= 1000 ? `${((s.token_count || 0) / 1000).toFixed(1)}k` : s.token_count || 0} tok
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Cost Diff Row ────────────────────────────────────────────────────────
function CostDiffRow({ label, values, colors }: { label: string; values: number[]; colors: string[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const diff = max - min
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 120, flexShrink: 0 }}>{label}</span>
      {values.map((v, i) => (
        <span key={i} style={{ color: colors[i], fontSize: 14, fontWeight: 700, width: 80, textAlign: 'right' }}>
          ${v.toFixed(2)}
        </span>
      ))}
      <span style={{ width: 80, textAlign: 'right' }}>
        <Delta value={diff} suffix="$" invert />
      </span>
    </div>
  )
}

// ── Model Badge ──────────────────────────────────────────────────────────
function ModelBadge({ model, color }: { model: string; color: string }) {
  return (
    <span style={{
      background: `${color}15`,
      border: `1px solid ${color}30`,
      color,
      borderRadius: 6,
      padding: '3px 10px',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {model}
    </span>
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
              background: isSelected ? `${color}18` : 'var(--cp-card-bg)',
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
  const [tokenStats, setTokenStats] = useState<{ agent_id: string; total_tokens: number; total_cost: number; model: string }[]>([])
  const [activityByAgent, setActivityByAgent] = useState<Record<string, number[]>>({})
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({})
  const [sessionsByAgent, setSessionsByAgent] = useState<Record<string, Session[]>>({})
  const [loading, setLoading] = useState(true)

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
        setTokenStats(tokenData as { agent_id: string; total_tokens: number; total_cost: number; model: string }[])

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

        // Session counts + session data
        const sessCounts: Record<string, number> = {}
        const sessData: Record<string, Session[]> = {}
        await Promise.all(
          AGENTS.map(async (a) => {
            const sessions = await fetchSessions(a.id, 100)
            sessCounts[a.id] = sessions.length
            sessData[a.id] = sessions as Session[]
          })
        )
        setSessionCounts(sessCounts)
        setSessionsByAgent(sessData)

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

  // Efficiency metrics: tokens/min, cost/min per agent
  const efficiencyMetrics = useMemo(() => {
    return selected.map((id, i) => {
      const sessions = sessionsByAgent[id] || []
      const stat = tokenStats.find(s => s.agent_id === id)
      const totalTokens = stat?.total_tokens || 0
      const totalCost = stat?.total_cost || 0
      const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
      const agent = AGENTS.find(a => a.id === id)
      return {
        label: agent?.name || id,
        color: agentColor(i),
        tokensPerMin: totalMinutes > 0 ? Math.round(totalTokens / totalMinutes) : 0,
        costPerMin: totalMinutes > 0 ? totalCost / totalMinutes : 0,
        totalMinutes,
      }
    })
  }, [selected, sessionsByAgent, tokenStats])

  // Cost data for diff panel
  const costData = useMemo(() => {
    return selected.map((id, i) => {
      const stat = tokenStats.find(s => s.agent_id === id)
      const sessions = sessionsByAgent[id] || []
      const totalCost = stat?.total_cost || 0
      const avgCostPerSession = sessions.length > 0 ? totalCost / sessions.length : 0
      const agent = AGENTS.find(a => a.id === id)
      return {
        label: agent?.name || id,
        color: agentColor(i),
        totalCost,
        avgCostPerSession,
      }
    })
  }, [selected, tokenStats, sessionsByAgent])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="skeleton-shimmer" style={{ width: 280, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer mt-3" style={{ width: 360, height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer mt-6" style={{ width: '100%', height: 48, borderRadius: 12 }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-5">
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
          const rows = selected.map(id => {
            const a = AGENTS.find(x => x.id === id)
            const ts = tokenStats.find(t => t.agent_id === id)
            const taskCount = tasks.filter(t => t.assigned_agent === id).length
            return [a?.name || id, taskCount, ts?.total_tokens || 0, sessionCounts[id] || 0, (ts?.total_cost || 0).toFixed(2)]
          })
          exportToCSV('clawpulse-compare', ['Agent', 'Tasks', 'Total Tokens', 'Sessions', 'Cost USD'], rows)
        }} />
      </div>

      {/* Agent picker */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border)',
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

          {/* Model Comparison */}
          <Card title="Model Comparison">
            <div className="flex flex-wrap gap-6">
              {selectedAgents.map((a, i) => {
                const color = agentColor(i)
                const sessionModels = (sessionsByAgent[a.id] || [])
                  .map(s => s.model)
                  .filter(Boolean) as string[]
                const uniqueModels = [...new Set(sessionModels)]
                return (
                  <div key={a.id} className="flex flex-col gap-2">
                    <span style={{ color, fontSize: 13, fontWeight: 700 }}>{a.name}</span>
                    <div className="flex items-center gap-2">
                      <ModelBadge model={a.model} color={color} />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>primary</span>
                    </div>
                    {uniqueModels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {uniqueModels.slice(0, 3).map(m => (
                          <span key={m} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px' }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedAgents.length === 2 && i === 0 && (
                      <div style={{ marginTop: 4 }}>
                        {a.model !== selectedAgents[1].model ? (
                          <span style={{ color: '#fbbf24', fontSize: 10 }}>⚡ Different model</span>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: 10 }}>✓ Same model</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Token usage */}
            <Card title="Token Usage">
              <BarChart items={tokenItems} />
              {selected.length === 2 && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Delta value={tokenItems[0].value - tokenItems[1].value} suffix=" tokens" />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 4 }}>difference</span>
                </div>
              )}
            </Card>

            {/* Task completion */}
            <Card title="Task Completion Rate">
              <CompletionRings items={completionItems} />
            </Card>

            {/* Cost Diff Panel */}
            <Card title="Cost Comparison">
              <div className="flex flex-col gap-0">
                <div className="flex items-center gap-3 pb-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, width: 120, flexShrink: 0 }}>Metric</span>
                  {costData.map((c, i) => (
                    <span key={i} style={{ color: c.color, fontSize: 11, fontWeight: 700, width: 80, textAlign: 'right' }}>{c.label}</span>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, width: 80, textAlign: 'right' }}>Diff</span>
                </div>
                <CostDiffRow
                  label="Total Cost"
                  values={costData.map(c => c.totalCost)}
                  colors={costData.map(c => c.color)}
                />
                <CostDiffRow
                  label="Cost / Session"
                  values={costData.map(c => c.avgCostPerSession)}
                  colors={costData.map(c => c.color)}
                />
              </div>
            </Card>

            {/* Efficiency Metrics */}
            <Card title="Efficiency Metrics">
              <div className="flex flex-col gap-3">
                {efficiencyMetrics.map((m, i) => (
                  <div key={m.label} className="flex items-center gap-4">
                    <span style={{ color: m.color, fontSize: 13, fontWeight: 700, width: 80, flexShrink: 0 }}>{m.label}</span>
                    <div className="flex gap-4">
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: m.color, fontSize: 18, fontWeight: 700 }}>
                          {m.tokensPerMin >= 1000 ? `${(m.tokensPerMin / 1000).toFixed(1)}k` : m.tokensPerMin}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>tok/min</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: m.color, fontSize: 18, fontWeight: 700 }}>
                          ${m.costPerMin.toFixed(3)}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>$/min</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 700 }}>
                          {m.totalMinutes >= 60 ? `${(m.totalMinutes / 60).toFixed(1)}h` : `${m.totalMinutes}m`}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>total time</div>
                      </div>
                    </div>
                  </div>
                ))}
                {selected.length === 2 && efficiencyMetrics[0].tokensPerMin > 0 && efficiencyMetrics[1].tokensPerMin > 0 && (
                  <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Delta value={efficiencyMetrics[0].tokensPerMin - efficiencyMetrics[1].tokensPerMin} suffix=" tok/min" />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 4 }}>throughput diff</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Activity volume 7d */}
            <Card title="Activity Volume (7 days)">
              <LineChart series={activitySeries} />
            </Card>

            {/* Session count */}
            <Card title="Session Count">
              <StatBoxes items={sessionItems} />
              {selected.length === 2 && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Delta value={sessionItems[0].value as number - (sessionItems[1].value as number)} suffix=" sessions" />
                </div>
              )}
            </Card>
          </div>

          {/* Session Timeline Comparison - full width */}
          <div className="mt-6">
            <Card title="Session Timeline Comparison">
              <div className={`grid gap-6 ${selected.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
                {selected.map((id, i) => {
                  const agent = AGENTS.find(a => a.id === id)
                  const sessions = sessionsByAgent[id] || []
                  return (
                    <SessionTimeline
                      key={id}
                      sessions={sessions}
                      color={agentColor(i)}
                      label={agent?.name || id}
                    />
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
