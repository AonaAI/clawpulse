'use client'

import { useState, useCallback, useRef } from 'react'
import { fetchTokenSummary, fetchTokenStatsByAgent, fetchDailyTokenStats, fetchTokenUsage } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import { DateRangePicker, type DateRange, getPresetDates } from '@/components/DateRangePicker'
import ExportButton, { exportToCSV } from '@/components/ExportButton'

interface AgentStat { agent_id: string; agent_name: string; total_tokens: number; total_cost: number; model: string }
interface DailyStat { date: string; total_tokens: number; total_cost: number }
interface UsageRecord { id: string; agent_id: string; agent_name: string; input_tokens: number; output_tokens: number; total_tokens: number; cost_usd: number; model: string; recorded_at: string }

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ModelBadge({ model }: { model: string }) {
  const isOpus = model.includes('opus')
  const isSonnet = model.includes('sonnet')
  const color = isOpus ? '#a78bfa' : isSonnet ? '#60a5fa' : '#34d399'
  const bg = isOpus ? 'rgba(167,139,250,0.1)' : isSonnet ? 'rgba(96,165,250,0.1)' : 'rgba(52,211,153,0.1)'
  const border = isOpus ? 'rgba(167,139,250,0.25)' : isSonnet ? 'rgba(96,165,250,0.25)' : 'rgba(52,211,153,0.25)'
  const label = isOpus ? 'Opus' : isSonnet ? 'Sonnet' : 'Haiku'
  return (
    <span style={{ color, background: bg, border: `1px solid ${border}` }} className="text-xs px-2 py-0.5 rounded-full font-semibold">
      {label}
    </span>
  )
}

export default function UsagePage() {
  const [summary, setSummary] = useState({ today: { tokens: 0, cost: 0 }, week: { tokens: 0, cost: 0 }, month: { tokens: 0, cost: 0 } })
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [sortBy, setSortBy] = useState<'tokens' | 'cost' | 'date'>('date')
  const [loading, setLoading] = useState(true)
  const dateRangeRef = useRef<DateRange>({ preset: '7d', ...getPresetDates('7d') })

  const loadAllData = useCallback(async () => {
    const { from, to } = dateRangeRef.current
    const [s, a, d, r] = await Promise.all([
      fetchTokenSummary(from, to),
      fetchTokenStatsByAgent(from, to),
      fetchDailyTokenStats(from, to),
      fetchTokenUsage(50, from, to),
    ])
    setSummary(s as typeof summary)
    setAgentStats(a as AgentStat[])
    setDailyStats(d as DailyStat[])
    setRecords(r as UsageRecord[])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateRangeChange = useCallback((range: DateRange) => {
    dateRangeRef.current = range
    setLoading(true)
    loadAllData()
  }, [loadAllData])

  useRealtimeSubscription([
    { table: 'token_usage', event: 'INSERT', onInsert: loadAllData },
  ], { onFallbackRefresh: loadAllData })

  const maxAgentTokens = Math.max(...agentStats.map(a => a.total_tokens), 1)
  const maxDailyTokens = Math.max(...dailyStats.map(d => d.total_tokens), 1)

  const sortedRecords = [...records].sort((a, b) => {
    if (sortBy === 'tokens') return b.total_tokens - a.total_tokens
    if (sortBy === 'cost') return Number(b.cost_usd) - Number(a.cost_usd)
    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  })

  // Derived summary stats
  const totalTokens = agentStats.reduce((s, a) => s + a.total_tokens, 0)
  const totalCost = agentStats.reduce((s, a) => s + a.total_cost, 0)
  const avgDailyTokens = totalTokens / Math.max(dailyStats.length, 1)
  const mostActiveAgent = agentStats[0]?.agent_name ?? '—'
  const costPer1M = totalTokens > 0 ? (totalCost / totalTokens) * 1_000_000 : 0
  const totalAgentCost = Math.max(totalCost, 0.000001)

  const summaryCards = [
    {
      label: 'Today',
      tokens: summary.today.tokens,
      cost: summary.today.cost,
      color: 'var(--cp-text-accent-light)',
      gradient: 'linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(109,40,217,0.04) 100%)',
      border: 'rgba(139,92,246,0.2)',
    },
    {
      label: 'This Week',
      tokens: summary.week.tokens,
      cost: summary.week.cost,
      color: '#22d3ee',
      gradient: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(8,145,178,0.04) 100%)',
      border: 'rgba(34,211,238,0.2)',
    },
    {
      label: 'This Month',
      tokens: summary.month.tokens,
      cost: summary.month.cost,
      color: '#34d399',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.04) 100%)',
      border: 'rgba(52,211,153,0.2)',
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">Token Usage & Cost</h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Track token consumption and API costs across all agents</p>
        </div>
        <ExportButton onExportCSV={() => exportToCSV('clawpulse-usage',
          ['Agent', 'Model', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost USD', 'Date'],
          records.map(r => [r.agent_name, r.model, r.input_tokens, r.output_tokens, r.total_tokens, r.cost_usd, r.recorded_at])
        )} />
      </div>

      {/* Time period selector */}
      <div className="mb-6">
        <DateRangePicker onChange={handleDateRangeChange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {summaryCards.map(card => (
          <div
            key={card.label}
            style={{ background: card.gradient, border: `1px solid ${card.border}`, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.35)' }}
            className="rounded-xl p-5"
          >
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-3">{card.label}</div>
            <div style={{ color: card.color }} className="text-3xl font-bold tracking-tight mb-1">
              {loading ? '—' : formatTokens(card.tokens)}
            </div>
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium">tokens</div>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--cp-divider)' }}>
              <span style={{ color: card.color }} className="text-lg font-bold">
                {loading ? '—' : formatCost(card.cost)}
              </span>
              <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs ml-1 font-medium">USD</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats row */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl px-5 py-4 mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4"
      >
        {[
          { label: 'Total Tokens', value: loading ? '—' : formatTokens(totalTokens), sub: 'in selected period' },
          { label: 'Total Cost', value: loading ? '—' : formatCost(totalCost), sub: 'USD in period' },
          { label: 'Avg Daily Tokens', value: loading ? '—' : formatTokens(avgDailyTokens), sub: 'per day' },
          { label: 'Most Active Agent', value: loading ? '—' : mostActiveAgent, sub: 'by tokens', truncate: true },
          { label: 'Cost / 1M Tokens', value: loading ? '—' : formatCost(costPer1M), sub: 'blended rate' },
        ].map((stat, i) => (
          <div key={stat.label} className={`flex flex-col ${i < 4 ? 'border-r-0 lg:border-r' : ''}`} style={{ borderColor: 'var(--cp-divider)' }}>
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-bold uppercase tracking-wider mb-1">{stat.label}</span>
            <span style={{ color: 'var(--cp-text-primary)' }} className={`text-lg font-bold tracking-tight ${stat.truncate ? 'truncate' : ''}`}>{stat.value}</span>
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-medium mt-0.5">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Daily token bar chart */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl p-5 mb-6"
      >
        <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-4">Daily Token Usage</h2>
        {loading ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">Loading…</div>
        ) : dailyStats.length === 0 ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">No data for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(dailyStats.length * 30, 300) }}>
              {/* Bars */}
              <div className="flex items-end gap-1" style={{ height: 128 }}>
                {dailyStats.map(day => {
                  const pct = (day.total_tokens / maxDailyTokens) * 100
                  return (
                    <div
                      key={day.date}
                      className="flex-1 relative group flex flex-col justify-end"
                      style={{ height: '100%' }}
                    >
                      {/* Hover tooltip */}
                      <div
                        className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity duration-150"
                        style={{
                          background: 'var(--cp-card-solid-bg)',
                          border: '1px solid rgba(139,92,246,0.35)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                        }}
                      >
                        <div style={{ color: 'var(--cp-text-primary)' }} className="text-xs font-bold">{formatDate(day.date)}</div>
                        <div style={{ color: 'var(--cp-text-accent-light)' }} className="text-xs">{formatTokens(day.total_tokens)} tokens</div>
                        <div style={{ color: '#34d399' }} className="text-xs">{formatCost(day.total_cost)}</div>
                      </div>
                      {/* Bar */}
                      <div
                        style={{
                          width: '100%',
                          height: pct > 0 ? `${Math.max(pct, 1.5)}%` : 0,
                          background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                          borderRadius: '3px 3px 2px 2px',
                          opacity: 0.8,
                          transition: 'opacity 0.15s, height 0.4s ease',
                          minHeight: pct > 0 ? 3 : 0,
                        }}
                        className="group-hover:opacity-100"
                      />
                    </div>
                  )
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex gap-1 mt-2">
                {dailyStats.map((day, i) => {
                  const step = Math.ceil(dailyStats.length / 8)
                  const showLabel = i % step === 0 || i === dailyStats.length - 1
                  return (
                    <div key={day.date} className="flex-1 text-center overflow-hidden">
                      {showLabel && (
                        <span style={{ color: 'var(--cp-text-dim)' }} className="text-[9px] font-medium whitespace-nowrap">
                          {formatDate(day.date)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-agent breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Token usage by agent */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5"
        >
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-5">Token Usage by Agent</h2>
          {loading ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-8">Loading…</div>
          ) : agentStats.length === 0 ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-8">No usage data yet</div>
          ) : (
            <div className="space-y-4">
              {agentStats.map(agent => {
                const pct = (agent.total_tokens / maxAgentTokens) * 100
                return (
                  <div key={agent.agent_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)' }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        >
                          {agent.agent_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold truncate">{agent.agent_name}</span>
                        <ModelBadge model={agent.model} />
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">{formatTokens(agent.total_tokens)}</span>
                        <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs ml-1">tok</span>
                      </div>
                    </div>
                    <div style={{ background: 'var(--cp-separator-bg)', height: '6px', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
                          borderRadius: '999px',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cost share by agent */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5"
        >
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-5">Cost Share by Agent</h2>
          {loading ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-8">Loading…</div>
          ) : agentStats.length === 0 ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-8">No cost data yet</div>
          ) : (
            <div className="space-y-4">
              {agentStats.map(agent => {
                const sharePct = (agent.total_cost / totalAgentCost) * 100
                return (
                  <div key={agent.agent_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                        >
                          {agent.agent_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold truncate">{agent.agent_name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span style={{ color: '#34d399' }} className="text-sm font-bold">{formatCost(agent.total_cost)}</span>
                        <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs ml-1.5">{sharePct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div style={{ background: 'var(--cp-separator-bg)', height: '6px', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${sharePct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #059669, #34d399)',
                          borderRadius: '999px',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detailed records table */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid var(--cp-divider-accent)' }}>
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Recent Sessions</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-medium">Sort by:</span>
            {(['date', 'tokens', 'cost'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                style={{
                  background: sortBy === opt ? 'rgba(124,58,237,0.18)' : 'var(--cp-input-bg)',
                  border: sortBy === opt ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--cp-border-subtle)',
                  color: sortBy === opt ? '#c4b5fd' : '#6b7280',
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-12">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: '560px' }}>
              <div
                className="grid px-5 py-2.5"
                style={{
                  gridTemplateColumns: '1fr 1fr 80px 80px 80px 90px',
                  borderBottom: '1px solid var(--cp-divider)',
                  background: 'var(--cp-table-header-bg)',
                }}
              >
                {['Agent', 'Model', 'Input', 'Output', 'Total', 'Cost'].map(h => (
                  <span key={h} style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-bold uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {sortedRecords.map((r, i) => (
                <div
                  key={r.id}
                  className="grid px-5 py-3.5 items-center"
                  style={{
                    gridTemplateColumns: '1fr 1fr 80px 80px 80px 90px',
                    borderBottom: i < sortedRecords.length - 1 ? '1px solid var(--cp-input-bg)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold">{r.agent_name}</div>
                    <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{formatTimestamp(r.recorded_at)}</div>
                  </div>
                  <div><ModelBadge model={r.model} /></div>
                  <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">{formatTokens(r.input_tokens)}</div>
                  <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">{formatTokens(r.output_tokens)}</div>
                  <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">{formatTokens(r.total_tokens)}</div>
                  <div style={{ color: '#34d399' }} className="text-sm font-bold">{formatCost(Number(r.cost_usd))}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
