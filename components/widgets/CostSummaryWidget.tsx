'use client'

import { useEffect, useState } from 'react'
import { fetchTokenSummary } from '@/lib/supabase-client'

interface Props {
  compact?: boolean
}

export default function CostSummaryWidget({ compact }: Props) {
  const [summary, setSummary] = useState<{ today: { tokens: number; cost: number }; week: { tokens: number; cost: number }; month: { tokens: number; cost: number } } | null>(null)

  useEffect(() => {
    fetchTokenSummary().then(setSummary)
  }, [])

  if (!summary) {
    return <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm py-4 text-center">Loading...</div>
  }

  const items = [
    { label: 'Today', tokens: summary.today.tokens, cost: summary.today.cost, color: '#34d399' },
    { label: 'This Week', tokens: summary.week.tokens, cost: summary.week.cost, color: '#3b82f6' },
    { label: 'This Month', tokens: summary.month.tokens, cost: summary.month.cost, color: '#a78bfa' },
  ]

  const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${n}`

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4">
        {items.map(i => (
          <div key={i.label} className="text-center flex-1">
            <div style={{ color: i.color }} className="text-lg font-bold">${i.cost.toFixed(2)}</div>
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-[10px] font-semibold uppercase tracking-wider">{i.label}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(i => (
        <div
          key={i.label}
          style={{
            background: `${i.color}08`,
            border: `1px solid ${i.color}30`,
          }}
          className="rounded-lg p-3 text-center"
        >
          <div style={{ color: i.color }} className="text-2xl font-bold">${i.cost.toFixed(2)}</div>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold mt-1">{formatTokens(i.tokens)} tokens</div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-[10px] font-semibold uppercase tracking-wider mt-1">{i.label}</div>
        </div>
      ))}
    </div>
  )
}
