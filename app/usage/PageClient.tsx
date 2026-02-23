'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchTokenSummary, fetchTokenStatsByAgent, fetchDailyTokenStats, fetchTokenUsage, fetchTokenStatsByModel } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import { DateRangePicker, type DateRange, getPresetDates } from '@/components/DateRangePicker'
import ExportButton, { exportToCSV } from '@/components/ExportButton'

interface AgentStat { agent_id: string; agent_name: string; total_tokens: number; total_cost: number; model: string }
interface DailyStat { date: string; total_tokens: number; total_cost: number }
interface ModelStat { model: string; total_tokens: number; total_cost: number; input_tokens: number; output_tokens: number }
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

// Model colors for pie chart
const MODEL_COLORS: Record<string, string> = {
  opus: '#a78bfa',
  sonnet: '#60a5fa',
  haiku: '#34d399',
  unknown: '#6b7280',
}

function getModelColor(model: string): string {
  if (model.includes('opus')) return MODEL_COLORS.opus
  if (model.includes('sonnet')) return MODEL_COLORS.sonnet
  if (model.includes('haiku')) return MODEL_COLORS.haiku
  return MODEL_COLORS.unknown
}

function getModelLabel(model: string): string {
  if (model.includes('opus')) return 'Opus'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('haiku')) return 'Haiku'
  return model
}

// Budget helpers
function getBudget(): number {
  if (typeof window === 'undefined') return 1000
  return Number(localStorage.getItem('cp_monthly_budget') || '1000')
}

function setBudgetStorage(val: number) {
  if (typeof window !== 'undefined') localStorage.setItem('cp_monthly_budget', String(val))
}

export default function UsagePage() {
  const [summary, setSummary] = useState({ today: { tokens: 0, cost: 0 }, week: { tokens: 0, cost: 0 }, month: { tokens: 0, cost: 0 } })
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [modelStats, setModelStats] = useState<ModelStat[]>([])
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [sortBy, setSortBy] = useState<'tokens' | 'cost' | 'date'>('date')
  const [loading, setLoading] = useState(true)
  const [budget, setBudgetState] = useState(1000)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const dateRangeRef = useRef<DateRange>({ preset: '7d', ...getPresetDates('7d') })

  useEffect(() => {
    setBudgetState(getBudget())
  }, [])

  const loadAllData = useCallback(async () => {
    const { from, to } = dateRangeRef.current
    const [s, a, d, r, m] = await Promise.all([
      fetchTokenSummary(from, to),
      fetchTokenStatsByAgent(from, to),
      fetchDailyTokenStats(from, to),
      fetchTokenUsage(50, from, to),
      fetchTokenStatsByModel(from, to),
    ])
    setSummary(s as typeof summary)
    setAgentStats(a as AgentStat[])
    setDailyStats(d as DailyStat[])
    setRecords(r as UsageRecord[])
    setModelStats(m as ModelStat[])
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
  const maxDailyCost = Math.max(...dailyStats.map(d => d.total_cost), 0.01)

  const sortedRecords = [...records].sort((a, b) => {
    if (sortBy === 'tokens') return b.total_tokens - a.total_tokens
    if (sortBy === 'cost') return Number(b.cost_usd) - Number(a.cost_usd)
    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  })

  // Derived stats
  const totalTokens = agentStats.reduce((s, a) => s + a.total_tokens, 0)
  const totalCost = agentStats.reduce((s, a) => s + a.total_cost, 0)
  const avgDailyTokens = totalTokens / Math.max(dailyStats.length, 1)
  const mostActiveAgent = agentStats[0]?.agent_name ?? '—'
  const costPer1M = totalTokens > 0 ? (totalCost / totalTokens) * 1_000_000 : 0
  const totalAgentCost = Math.max(totalCost, 0.000001)

  // Cost projection: based on monthly cost and days elapsed
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthlyCost = summary.month.cost
  const dailyBurnRate = dayOfMonth > 0 ? monthlyCost / dayOfMonth : 0
  const projectedMonthlyCost = dailyBurnRate * daysInMonth

  // Budget calculations
  const budgetUsedPct = budget > 0 ? (monthlyCost / budget) * 100 : 0
  const budgetWarning = budgetUsedPct >= 80 && budgetUsedPct < 100
  const budgetCritical = budgetUsedPct >= 100

  // Model pie chart data
  const totalModelCost = modelStats.reduce((s, m) => s + m.total_cost, 0) || 0.000001
  const pieSegments = modelStats.map(m => ({
    label: getModelLabel(m.model),
    color: getModelColor(m.model),
    pct: (m.total_cost / totalModelCost) * 100,
    cost: m.total_cost,
  }))
  // Build conic gradient
  let conicStops = ''
  let cumPct = 0
  for (const seg of pieSegments) {
    conicStops += `${seg.color} ${cumPct}% ${cumPct + seg.pct}%, `
    cumPct += seg.pct
  }
  if (!conicStops) conicStops = '#374151 0% 100%, '
  const conicGradient = `conic-gradient(${conicStops.slice(0, -2)})`

  const handleBudgetSave = () => {
    const val = parseFloat(budgetInput)
    if (!isNaN(val) && val > 0) {
      setBudgetStorage(val)
      setBudgetState(val)
    }
    setEditingBudget(false)
  }

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
        <ExportButton onExportCSV={() => exportToCSV('clawpulse-cost-report',
          ['Agent', 'Model', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost USD', 'Date'],
          records.map(r => [r.agent_name, r.model, r.input_tokens, r.output_tokens, r.total_tokens, r.cost_usd, r.recorded_at])
        )} />
      </div>

      {/* Budget Alert Banners */}
      {!loading && budgetCritical && (
        <div
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
        >
          <span className="text-2xl">🚨</span>
          <div>
            <div style={{ color: '#f87171' }} className="text-sm font-bold">Budget Exceeded!</div>
            <div style={{ color: '#fca5a5' }} className="text-xs">
              Monthly spending ({formatCost(monthlyCost)}) has exceeded your budget of {formatCost(budget)}. 
              Projected total: {formatCost(projectedMonthlyCost)}.
            </div>
          </div>
        </div>
      )}
      {!loading && budgetWarning && !budgetCritical && (
        <div
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)' }}
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
        >
          <span className="text-2xl">⚠️</span>
          <div>
            <div style={{ color: '#fbbf24' }} className="text-sm font-bold">Approaching Budget Limit</div>
            <div style={{ color: '#fcd34d' }} className="text-xs">
              Monthly spending ({formatCost(monthlyCost)}) is at {budgetUsedPct.toFixed(0)}% of your {formatCost(budget)} budget.
              Projected: {formatCost(projectedMonthlyCost)}.
            </div>
          </div>
        </div>
      )}

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

      {/* Budget & Projections Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Budget Progress */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Monthly Budget</h2>
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">$</span>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBudgetSave()}
                  style={{ background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)', color: 'var(--cp-text-primary)' }}
                  className="w-24 px-2 py-1 rounded-lg text-sm"
                  autoFocus
                />
                <button
                  onClick={handleBudgetSave}
                  style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingBudget(false)}
                  style={{ color: 'var(--cp-text-dim)' }}
                  className="text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setBudgetInput(String(budget)); setEditingBudget(true) }}
                style={{ color: 'var(--cp-text-muted)' }}
                className="text-xs hover:underline"
              >
                Edit Budget
              </button>
            )}
          </div>
          <div className="mb-2">
            <span style={{ color: budgetCritical ? '#f87171' : budgetWarning ? '#fbbf24' : '#34d399' }} className="text-2xl font-bold">
              {loading ? '—' : formatCost(monthlyCost)}
            </span>
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-sm ml-1">of {formatCost(budget)} used</span>
          </div>
          {/* Progress bar */}
          <div style={{ background: 'var(--cp-separator-bg)', height: '10px', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(budgetUsedPct, 100)}%`,
                height: '100%',
                background: budgetCritical
                  ? 'linear-gradient(90deg, #ef4444, #f87171)'
                  : budgetWarning
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #059669, #34d399)',
                borderRadius: '999px',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{loading ? '—' : `${budgetUsedPct.toFixed(1)}%`}</span>
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{formatCost(budget)}</span>
          </div>
        </div>

        {/* Cost Projections */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5"
        >
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-3">Cost Projections</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-bold uppercase tracking-wider mb-1">Daily Burn Rate</div>
              <div style={{ color: '#22d3ee' }} className="text-xl font-bold">{loading ? '—' : formatCost(dailyBurnRate)}</div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">per day</div>
            </div>
            <div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-bold uppercase tracking-wider mb-1">Projected Monthly</div>
              <div style={{ color: projectedMonthlyCost > budget ? '#f87171' : '#34d399' }} className="text-xl font-bold">
                {loading ? '—' : formatCost(projectedMonthlyCost)}
              </div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">
                {projectedMonthlyCost > budget ? 'over budget' : 'within budget'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-bold uppercase tracking-wider mb-1">Days Remaining</div>
              <div style={{ color: 'var(--cp-text-primary)' }} className="text-xl font-bold">{daysInMonth - dayOfMonth}</div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">in this month</div>
            </div>
            <div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-bold uppercase tracking-wider mb-1">Budget Remaining</div>
              <div style={{ color: budget - monthlyCost > 0 ? '#34d399' : '#f87171' }} className="text-xl font-bold">
                {loading ? '—' : formatCost(Math.max(budget - monthlyCost, 0))}
              </div>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">
                {budget - monthlyCost > 0 ? 'left to spend' : 'exceeded'}
              </div>
            </div>
          </div>
        </div>
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

      {/* Daily Cost Trend + Model Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Daily cost bar chart */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5 xl:col-span-2"
        >
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-4">Daily Cost Trend</h2>
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
                    const pct = (day.total_cost / maxDailyCost) * 100
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
                            border: '1px solid rgba(52,211,153,0.35)',
                            borderRadius: 8,
                            padding: '6px 10px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                          }}
                        >
                          <div style={{ color: 'var(--cp-text-primary)' }} className="text-xs font-bold">{formatDate(day.date)}</div>
                          <div style={{ color: '#34d399' }} className="text-xs font-bold">{formatCost(day.total_cost)}</div>
                          <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{formatTokens(day.total_tokens)} tokens</div>
                        </div>
                        {/* Bar */}
                        <div
                          style={{
                            width: '100%',
                            height: pct > 0 ? `${Math.max(pct, 1.5)}%` : 0,
                            background: 'linear-gradient(180deg, #34d399 0%, #059669 100%)',
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

        {/* Model Breakdown Pie Chart */}
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
          className="rounded-xl p-5"
        >
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base mb-4">Model Breakdown</h2>
          {loading ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">Loading…</div>
          ) : modelStats.length === 0 ? (
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">No data</div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* CSS Pie Chart */}
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: conicGradient,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  position: 'relative',
                }}
              >
                {/* Center hole for donut effect */}
                <div
                  style={{
                    position: 'absolute',
                    top: '25%',
                    left: '25%',
                    width: '50%',
                    height: '50%',
                    borderRadius: '50%',
                    background: 'var(--cp-card-bg)',
                  }}
                />
              </div>
              {/* Legend */}
              <div className="space-y-2 w-full">
                {pieSegments.map(seg => (
                  <div key={seg.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div style={{ background: seg.color, width: 10, height: 10, borderRadius: 3 }} />
                      <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-medium">{seg.label}</span>
                    </div>
                    <div className="text-right">
                      <span style={{ color: seg.color }} className="text-sm font-bold">{formatCost(seg.cost)}</span>
                      <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs ml-1">{seg.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-agent breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Cost breakdown by agent */}
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
