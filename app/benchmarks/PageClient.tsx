'use client'

import { useState, useEffect, useMemo, memo } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchAllSessions } from '@/lib/supabase-client'

// ── Types ────────────────────────────────────────────────────────────────
interface SessionRow {
  id: string
  agent_id: string
  agent_name: string
  status: string
  token_count: number
  duration_minutes: number | null
  cost_usd: number
  started_at: string
}

interface AgentMetrics {
  agentId: string
  agentName: string
  avgDuration: number
  avgTokens: number
  successRate: number
  completionSpeed: number
  costEfficiency: number
  totalSessions: number
  prevAvgDuration: number
  prevAvgTokens: number
  prevSuccessRate: number
  prevCompletionSpeed: number
  prevCostEfficiency: number
}

type SortKey = 'agentName' | 'avgDuration' | 'avgTokens' | 'successRate' | 'completionSpeed' | 'costEfficiency' | 'totalSessions'

// ── Helpers ──────────────────────────────────────────────────────────────
const PALETTE = ['#22d3ee', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#fb923c', '#818cf8', '#f87171', '#4ade80', '#e879f9']
const MEDALS = ['🥇', '🥈', '🥉']

function computeMetrics(sessions: SessionRow[], periodStart: Date, periodEnd: Date): Map<string, Omit<AgentMetrics, 'prevAvgDuration' | 'prevAvgTokens' | 'prevSuccessRate' | 'prevCompletionSpeed' | 'prevCostEfficiency'>> {
  const map = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    const d = new Date(s.started_at)
    if (d < periodStart || d > periodEnd) continue
    if (!map.has(s.agent_id)) map.set(s.agent_id, [])
    map.get(s.agent_id)!.push(s)
  }

  const result = new Map<string, Omit<AgentMetrics, 'prevAvgDuration' | 'prevAvgTokens' | 'prevSuccessRate' | 'prevCompletionSpeed' | 'prevCostEfficiency'>>()
  for (const [agentId, rows] of map) {
    const total = rows.length
    const completed = rows.filter(r => r.status === 'completed' || r.status === 'success')
    const errored = rows.filter(r => r.status === 'error' || r.status === 'errored' || r.status === 'failed')
    
    // Fix: Calculate success rate based on total sessions, not just completed + errored
    // Sessions might have other statuses like 'running', 'pending', etc.
    const successRate = total > 0 ? (completed.length / total) * 100 : 0
    
    const durations = rows.map(r => r.duration_minutes).filter((d): d is number => d !== null && d > 0)
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const avgTokens = total > 0 ? rows.reduce((a, b) => a + b.token_count, 0) / total : 0
    const totalCost = rows.reduce((a, b) => a + (b.cost_usd || 0), 0)
    
    // Fix: Handle cost efficiency calculation better - avoid division by zero
    const costEfficiency = completed.length > 0 ? totalCost / completed.length : (total > 0 ? totalCost / total : 0)
    
    // Fix: Handle completion speed calculation better
    const completionSpeed = avgDuration > 0 && avgTokens > 0 ? avgTokens / avgDuration : 0

    result.set(agentId, {
      agentId,
      agentName: rows[0]?.agent_name || agentId,
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgTokens: Math.round(avgTokens),
      successRate: Math.round(successRate * 10) / 10,
      completionSpeed: Math.round(completionSpeed),
      costEfficiency: Math.round(costEfficiency * 10000) / 10000,
      totalSessions: total,
    })
  }
  return result
}

const TrendArrow = memo(function TrendArrow({ current, previous }: { current: number; previous: number }) {
  // Handle null/undefined/NaN cases
  const curr = Number.isFinite(current) ? current : 0
  const prev = Number.isFinite(previous) ? previous : 0
  
  // If both are zero or equal, show neutral indicator
  if ((prev === 0 && curr === 0) || curr === prev) return <span className="text-xs opacity-40">—</span>
  
  // If previous was zero but current isn't, it's an improvement
  if (prev === 0 && curr > 0) return <span className="text-xs font-bold text-emerald-400">▲</span>
  
  const better = curr >= prev
  return (
    <span className={`text-xs font-bold ${better ? 'text-emerald-400' : 'text-rose-400'}`}>
      {better ? '▲' : '▼'}
    </span>
  )
})

// ── CSS Radar Chart ──────────────────────────────────────────────────────
const RadarChart = memo(function RadarChart({ metrics, color, label }: { metrics: AgentMetrics; color: string; label: string }) {
  // Normalize each dimension to 0-100 scale with null/undefined guards
  const completionSpeed = Number.isFinite(metrics.completionSpeed) ? metrics.completionSpeed : 0
  const successRate = Number.isFinite(metrics.successRate) ? metrics.successRate : 0
  const costEfficiency = Number.isFinite(metrics.costEfficiency) ? metrics.costEfficiency : 0
  const avgTokens = Number.isFinite(metrics.avgTokens) ? metrics.avgTokens : 0
  const totalSessions = Number.isFinite(metrics.totalSessions) ? metrics.totalSessions : 0
  
  const dims = [
    { name: 'Speed', value: Math.min(completionSpeed / 50, 1) * 100 },
    { name: 'Success', value: successRate },
    { name: 'Efficiency', value: Math.max(0, 100 - costEfficiency * 1000) },
    { name: 'Throughput', value: Math.min(avgTokens / 5000, 1) * 100 },
    { name: 'Volume', value: Math.min(totalSessions / 20, 1) * 100 },
  ]

  const n = dims.length
  const cx = 80, cy = 80, r = 60
  const angles = dims.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2)

  const points = dims.map((d, i) => {
    const dist = (d.value / 100) * r
    return `${cx + dist * Math.cos(angles[i])},${cy + dist * Math.sin(angles[i])}`
  }).join(' ')

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* Grid */}
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={angles.map(a => `${cx + r * level * Math.cos(a)},${cy + r * level * Math.sin(a)}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {angles.map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}
        {/* Data polygon */}
        <polygon points={points} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
        {/* Data points */}
        {dims.map((d, i) => {
          const dist = (d.value / 100) * r
          return <circle key={i} cx={cx + dist * Math.cos(angles[i])} cy={cy + dist * Math.sin(angles[i])} r="3" fill={color} />
        })}
        {/* Labels */}
        {dims.map((d, i) => {
          const lx = cx + (r + 16) * Math.cos(angles[i])
          const ly = cy + (r + 16) * Math.sin(angles[i])
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="600">
              {d.name}
            </text>
          )
        })}
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  )
})

// ── Card ─────────────────────────────────────────────────────────────────
const Card = memo(function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
      className={`rounded-xl p-5 ${className}`}
    >
      <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
})

// ── Main Page ────────────────────────────────────────────────────────────
export default function BenchmarksPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('successRate')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch a large batch to have enough data
      const { items } = await fetchAllSessions({ limit: 1000, offset: 0 })
      setSessions(items)
      setLoading(false)
    }
    load()
  }, [])

  const agentMetrics = useMemo(() => {
    const now = new Date()
    const periodEnd = now
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const prevStart = new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000)

    const current = computeMetrics(sessions, periodStart, periodEnd)
    const previous = computeMetrics(sessions, prevStart, periodStart)

    const result: AgentMetrics[] = []
    for (const [agentId, m] of current) {
      const prev = previous.get(agentId)
      result.push({
        ...m,
        prevAvgDuration: prev?.avgDuration ?? 0,
        prevAvgTokens: prev?.avgTokens ?? 0,
        prevSuccessRate: prev?.successRate ?? 0,
        prevCompletionSpeed: prev?.completionSpeed ?? 0,
        prevCostEfficiency: prev?.costEfficiency ?? 0,
      })
    }
    return result
  }, [sessions])

  const sorted = useMemo(() => {
    const arr = [...agentMetrics]
    arr.sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return arr
  }, [agentMetrics, sortKey, sortAsc])

  const ranked = useMemo(() => {
    // Rank by composite score: successRate (40%) + completionSpeed (20%) + tokens (20%) + costEfficiency (20% inverse)
    const arr = [...agentMetrics]
    if (arr.length === 0) return []
    const maxSpeed = Math.max(...arr.map(a => a.completionSpeed), 1)
    const maxTokens = Math.max(...arr.map(a => a.avgTokens), 1)
    const maxCost = Math.max(...arr.map(a => a.costEfficiency), 0.001)

    return arr
      .map(a => ({
        ...a,
        score:
          a.successRate * 0.4 +
          (a.completionSpeed / maxSpeed) * 100 * 0.2 +
          (a.avgTokens / maxTokens) * 100 * 0.2 +
          (1 - a.costEfficiency / maxCost) * 100 * 0.2,
      }))
      .sort((a, b) => b.score - a.score)
  }, [agentMetrics])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-3 py-2 text-left text-xs font-semibold cursor-pointer select-none whitespace-nowrap"
        style={{ color: 'var(--cp-text-secondary)' }}
        onClick={() => handleSort(k)}
      >
        {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl font-bold">Agent Benchmarks</h1>
        <div className="flex items-center gap-2" style={{ color: 'var(--cp-text-secondary)' }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading benchmark data…
        </div>
      </div>
    )
  }

  // Show empty state if no data
  if (!loading && agentMetrics.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl font-bold">Agent Benchmarks</h1>
        <Card title="No Data Available">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-semibold mb-2">
              No session data found
            </p>
            <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm max-w-md">
              Agent sessions will appear here once agents start running tasks. Check back soon or verify that your agents are properly configured and active.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl font-bold">Agent Benchmarks</h1>
        <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm mt-1">
          Performance comparison across {agentMetrics.length} agents • Last 30 days vs previous period
        </p>
      </div>

      {/* Rankings */}
      {ranked.length > 0 && (
        <Card title="Rankings">
          <div className="flex flex-wrap gap-4">
            {ranked.map((a, i) => {
              const agentIndex = AGENTS.findIndex(ag => ag.id === a.agentId)
              const colorIndex = agentIndex >= 0 ? agentIndex : i
              const color = PALETTE[colorIndex % PALETTE.length]
              return (
                <div
                  key={a.agentId}
                  className="flex items-center gap-3 rounded-lg px-4 py-3"
                  style={{
                    background: i < 3 ? `${color}10` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i < 3 ? color + '40' : 'var(--cp-border)'}`,
                  }}
                >
                  <span className="text-xl">{i < 3 ? MEDALS[i] : <span className="text-sm opacity-40 font-mono">#{i + 1}</span>}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--cp-text-primary)' }}>
                      {a.agentName || 'Unknown Agent'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--cp-text-secondary)' }}>
                      {Math.round(a.successRate || 0)}% success • {a.totalSessions || 0} sessions
                    </div>
                  </div>
                  <span className="text-xs font-mono opacity-50 ml-2">{Math.round(a.score || 0)}pts</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Comparison Table */}
      <Card title="Performance Comparison">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--cp-border)' }}>
                <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--cp-text-secondary)' }}>Rank</th>
                <SortHeader label="Agent" k="agentName" />
                <SortHeader label="Sessions" k="totalSessions" />
                <SortHeader label="Avg Duration (min)" k="avgDuration" />
                <SortHeader label="Avg Tokens" k="avgTokens" />
                <SortHeader label="Success Rate" k="successRate" />
                <SortHeader label="Speed (tok/min)" k="completionSpeed" />
                <SortHeader label="Cost/Task ($)" k="costEfficiency" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => {
                const rankIdx = ranked.findIndex(r => r.agentId === a.agentId)
                const agentIndex = AGENTS.findIndex(ag => ag.id === a.agentId)
                const color = agentIndex >= 0 ? PALETTE[agentIndex % PALETTE.length] : PALETTE[i % PALETTE.length]
                return (
                  <tr key={a.agentId} style={{ borderBottom: '1px solid var(--cp-border)' }} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-center">
                      {rankIdx < 3 ? MEDALS[rankIdx] : <span className="text-xs opacity-40">#{rankIdx + 1}</span>}
                    </td>
                    <td className="px-3 py-2 font-semibold" style={{ color }}>
                      {a.agentName || 'Unknown'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--cp-text-primary)' }}>{a.totalSessions || 0}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--cp-text-primary)' }}>
                      {a.avgDuration || 0} <TrendArrow current={a.avgDuration || 0} previous={a.prevAvgDuration || 0} />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--cp-text-primary)' }}>
                      {(a.avgTokens || 0).toLocaleString()} <TrendArrow current={a.avgTokens || 0} previous={a.prevAvgTokens || 0} />
                    </td>
                    <td className="px-3 py-2">
                      <span className={a.successRate >= 80 ? 'text-emerald-400' : a.successRate >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                        {Math.round(a.successRate || 0)}%
                      </span>
                      {' '}<TrendArrow current={a.successRate || 0} previous={a.prevSuccessRate || 0} />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--cp-text-primary)' }}>
                      {(a.completionSpeed || 0).toLocaleString()} <TrendArrow current={a.completionSpeed || 0} previous={a.prevCompletionSpeed || 0} />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--cp-text-primary)' }}>
                      ${(a.costEfficiency || 0).toFixed(4)} <TrendArrow current={a.prevCostEfficiency || 0} previous={a.costEfficiency || 0} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--cp-text-secondary)' }}>No session data available</p>
          )}
        </div>
      </Card>

      {/* Performance Radar Charts */}
      {agentMetrics.length > 0 && (
        <Card title="Performance Radar">
          <div className="flex flex-wrap gap-6 justify-center">
            {ranked.slice(0, 6).map((a, i) => {
              const agentIndex = AGENTS.findIndex(ag => ag.id === a.agentId)
              const colorIndex = agentIndex >= 0 ? agentIndex : i
              return (
                <RadarChart
                  key={a.agentId}
                  metrics={a}
                  color={PALETTE[colorIndex % PALETTE.length]}
                  label={a.agentName || 'Unknown'}
                />
              )
            })}
          </div>
        </Card>
      )}

      {/* Scorecard per agent */}
      {ranked.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ranked.map((a) => {
            const idx = AGENTS.findIndex(ag => ag.id === a.agentId)
            const color = idx >= 0 ? PALETTE[idx % PALETTE.length] : PALETTE[0]
            const rankIdx = ranked.findIndex(r => r.agentId === a.agentId)
            return (
              <div
                key={a.agentId}
                className="rounded-xl p-4"
                style={{ background: 'var(--cp-card-bg)', border: `1px solid ${color}30` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {rankIdx < 3 && <span className="text-lg">{MEDALS[rankIdx]}</span>}
                    <span className="font-semibold text-sm" style={{ color }}>{a.agentName || 'Unknown'}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--cp-text-secondary)' }}>
                    {a.totalSessions || 0} sessions
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Avg Duration', value: `${a.avgDuration || 0} min`, trend: <TrendArrow current={a.avgDuration || 0} previous={a.prevAvgDuration || 0} /> },
                    { label: 'Avg Tokens', value: (a.avgTokens || 0).toLocaleString(), trend: <TrendArrow current={a.avgTokens || 0} previous={a.prevAvgTokens || 0} /> },
                    { label: 'Success Rate', value: `${a.successRate || 0}%`, trend: <TrendArrow current={a.successRate || 0} previous={a.prevSuccessRate || 0} /> },
                    { label: 'Speed', value: `${a.completionSpeed || 0} tok/min`, trend: <TrendArrow current={a.completionSpeed || 0} previous={a.prevCompletionSpeed || 0} /> },
                    { label: 'Cost/Task', value: `$${(a.costEfficiency || 0).toFixed(4)}`, trend: <TrendArrow current={a.prevCostEfficiency || 0} previous={a.costEfficiency || 0} /> },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ color: 'var(--cp-text-secondary)' }}>{item.label}</div>
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--cp-text-primary)' }}>
                        <span className="font-semibold">{item.value}</span>
                        {item.trend}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
