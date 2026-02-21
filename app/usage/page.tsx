'use client'

import { useEffect, useState } from 'react'
import { fetchTokenSummary, fetchTokenStatsByAgent, fetchDailyTokenStats, fetchTokenUsage } from '@/lib/supabase-client'

interface AgentStat { agent_id: string; agent_name: string; total_tokens: number; total_cost: number; model: string }
interface DailyStat { date: string; total_tokens: number; total_cost: number }
interface UsageRecord { id: string; agent_id: string; agent_name: string; input_tokens: number; output_tokens: number; total_tokens: number; cost_usd: number; model: string; recorded_at: string }

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
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
  const label = isOpus ? 'Opus' : isSonnet ? 'Sonnet' : 'GPT-4o'
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

  useEffect(() => {
    Promise.all([
      fetchTokenSummary(),
      fetchTokenStatsByAgent(),
      fetchDailyTokenStats(),
      fetchTokenUsage(50),
    ]).then(([s, a, d, r]) => {
      setSummary(s as typeof summary)
      setAgentStats(a as AgentStat[])
      setDailyStats(d as DailyStat[])
      setRecords(r as UsageRecord[])
      setLoading(false)
    })
  }, [])

  const maxAgentTokens = Math.max(...agentStats.map(a => a.total_tokens), 1)
  const maxDailyTokens = Math.max(...dailyStats.map(d => d.total_tokens), 1)

  const sortedRecords = [...records].sort((a, b) => {
    if (sortBy === 'tokens') return b.total_tokens - a.total_tokens
    if (sortBy === 'cost') return Number(b.cost_usd) - Number(a.cost_usd)
    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  })

  const summaryCards = [
    {
      label: 'Today',
      tokens: summary.today.tokens,
      cost: summary.today.cost,
      color: '#8b5cf6',
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
      <div className="mb-8">
        <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Token Usage & Cost</h1>
        <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">Track token consumption and API costs across all agents</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {summaryCards.map(card => (
          <div
            key={card.label}
            style={{ background: card.gradient, border: `1px solid ${card.border}`, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.35)' }}
            className="rounded-xl p-5"
          >
            <div style={{ color: '#6b7280' }} className="text-xs font-semibold uppercase tracking-wider mb-3">{card.label}</div>
            <div style={{ color: card.color }} className="text-3xl font-bold tracking-tight mb-1">
              {loading ? '—' : formatTokens(card.tokens)}
            </div>
            <div style={{ color: '#6b7280' }} className="text-xs font-medium">tokens</div>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: card.color }} className="text-lg font-bold">
                {loading ? '—' : formatCost(card.cost)}
              </span>
              <span style={{ color: '#4b5563' }} className="text-xs ml-1 font-medium">USD</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Per-agent breakdown */}
        <div className="xl:col-span-2">
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-5"
          >
            <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base mb-5">Per-Agent Token Usage</h2>
            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">Loading…</div>
            ) : agentStats.length === 0 ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">No usage data yet</div>
            ) : (
              <div className="space-y-4">
                {agentStats.map(agent => {
                  const pct = (agent.total_tokens / maxAgentTokens) * 100
                  return (
                    <div key={agent.agent_id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6' }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                          >
                            {agent.agent_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ color: '#e9e2ff' }} className="text-sm font-semibold">{agent.agent_name}</span>
                          </div>
                          <ModelBadge model={agent.model} />
                        </div>
                        <div className="text-right">
                          <span style={{ color: '#f8f4ff' }} className="text-sm font-bold">{formatTokens(agent.total_tokens)}</span>
                          <span style={{ color: '#6b7280' }} className="text-xs ml-1">tokens</span>
                          <div style={{ color: '#4b5563' }} className="text-xs">{formatCost(agent.total_cost)}</div>
                        </div>
                      </div>
                      <div
                        style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '999px', overflow: 'hidden' }}
                      >
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
        </div>

        {/* Daily trend */}
        <div>
          <div
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-5"
          >
            <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base mb-5">7-Day Trend</h2>
            {loading ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">Loading…</div>
            ) : dailyStats.length === 0 ? (
              <div style={{ color: '#4b5563' }} className="text-sm text-center py-8">No data</div>
            ) : (
              <div className="space-y-3">
                {dailyStats.map(day => {
                  const pct = (day.total_tokens / maxDailyTokens) * 100
                  return (
                    <div key={day.date}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#6b7280' }} className="text-xs font-medium">{formatDate(day.date)}</span>
                        <span style={{ color: '#e9e2ff' }} className="text-xs font-bold">{formatTokens(day.total_tokens)}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', height: '4px', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                            borderRadius: '999px',
                          }}
                        />
                      </div>
                      <div style={{ color: '#4b5563' }} className="text-xs mt-0.5 text-right">{formatCost(day.total_cost)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed records table */}
      <div
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid rgba(109,40,217,0.12)' }}>
          <h2 style={{ color: '#f0ebff' }} className="font-semibold text-base">Recent Sessions</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: '#4b5563' }} className="text-xs font-medium">Sort by:</span>
            {(['date', 'tokens', 'cost'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                style={{
                  background: sortBy === opt ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                  border: sortBy === opt ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.07)',
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
          <div style={{ color: '#4b5563' }} className="text-sm text-center py-12">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: '560px' }}>
            {/* Table header */}
            <div
              className="grid px-5 py-2.5"
              style={{
                gridTemplateColumns: '1fr 1fr 80px 80px 80px 90px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              {['Agent', 'Model', 'Input', 'Output', 'Total', 'Cost'].map(h => (
                <span key={h} style={{ color: '#4b5563' }} className="text-xs font-bold uppercase tracking-wider">{h}</span>
              ))}
            </div>
            {sortedRecords.map((r, i) => (
              <div
                key={r.id}
                className="grid px-5 py-3.5 items-center"
                style={{
                  gridTemplateColumns: '1fr 1fr 80px 80px 80px 90px',
                  borderBottom: i < sortedRecords.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div>
                  <div style={{ color: '#e9e2ff' }} className="text-sm font-semibold">{r.agent_name}</div>
                  <div style={{ color: '#4b5563' }} className="text-xs">{formatTimestamp(r.recorded_at)}</div>
                </div>
                <div><ModelBadge model={r.model} /></div>
                <div style={{ color: '#6b7280' }} className="text-sm font-medium">{formatTokens(r.input_tokens)}</div>
                <div style={{ color: '#6b7280' }} className="text-sm font-medium">{formatTokens(r.output_tokens)}</div>
                <div style={{ color: '#f8f4ff' }} className="text-sm font-bold">{formatTokens(r.total_tokens)}</div>
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
