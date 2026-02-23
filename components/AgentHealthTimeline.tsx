'use client'

import { useState } from 'react'
import type { Session } from '@/lib/types'

interface Segment {
  leftPct: number
  widthPct: number
  color: string
  label: string
  startTime: Date
  endTime: Date
}

function buildSegments(sessions: Session[], windowStart: Date, windowEnd: Date): Segment[] {
  const totalMs = windowEnd.getTime() - windowStart.getTime()

  return sessions
    .filter(s => {
      const start = new Date(s.started_at)
      const end =
        s.status === 'active'
          ? windowEnd
          : s.last_active
          ? new Date(s.last_active)
          : start
      return end > windowStart && start < windowEnd
    })
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .flatMap(s => {
      const rawStart = Math.max(new Date(s.started_at).getTime(), windowStart.getTime())
      const rawEnd =
        s.status === 'active'
          ? windowEnd.getTime()
          : s.last_active
          ? Math.min(new Date(s.last_active).getTime(), windowEnd.getTime())
          : rawStart

      if (rawEnd <= rawStart) return []

      const color =
        s.status === 'active' ? '#34d399' : s.status === 'failed' ? '#f87171' : '#8b5cf6'
      const label =
        s.status === 'active' ? 'Active' : s.status === 'failed' ? 'Failed' : 'Working'

      return [
        {
          leftPct: ((rawStart - windowStart.getTime()) / totalMs) * 100,
          widthPct: ((rawEnd - rawStart) / totalMs) * 100,
          color,
          label,
          startTime: new Date(rawStart),
          endTime: new Date(rawEnd),
        },
      ]
    })
    .filter(s => s.widthPct > 0.05)
}

function fmt(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const LEGEND = [
  { color: '#34d399', label: 'Active' },
  { color: '#8b5cf6', label: 'Working' },
  { color: '#f87171', label: 'Failed' },
]

export default function AgentHealthTimeline({
  sessions,
  loading,
}: {
  sessions: Session[]
  loading: boolean
}) {
  const [tooltip, setTooltip] = useState<{ leftPct: number; content: string } | null>(null)

  const now = new Date()
  const windowStart = new Date(now.getTime() - 24 * 3600 * 1000)
  const segments = buildSegments(sessions, windowStart, now)

  const labels = [
    { label: fmt(windowStart), pct: 0 },
    { label: fmt(new Date(windowStart.getTime() + 6 * 3600 * 1000)), pct: 25 },
    { label: fmt(new Date(windowStart.getTime() + 12 * 3600 * 1000)), pct: 50 },
    { label: fmt(new Date(windowStart.getTime() + 18 * 3600 * 1000)), pct: 75 },
    { label: 'Now', pct: 100 },
  ]

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">
            Status Timeline
          </h2>
          <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-0.5">
            Last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-4">
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                style={{ background: color, width: 8, height: 8, borderRadius: 2, flexShrink: 0 }}
              />
              <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-6">
          Loading…
        </div>
      ) : (
        <>
          {/* Bar + tooltip wrapper — relative so tooltip can escape the overflow:hidden bar */}
          <div className="relative mb-1">
            {/* Track bar */}
            <div
              className="relative overflow-hidden rounded-lg"
              style={{
                height: 28,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {segments.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                    No session data in last 24h
                  </span>
                </div>
              ) : (
                segments.map((seg, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 transition-opacity hover:opacity-100"
                    style={{
                      left: `${seg.leftPct}%`,
                      width: `${Math.max(seg.widthPct, 0.3)}%`,
                      background: seg.color,
                      opacity: 0.82,
                      cursor: 'default',
                    }}
                    onMouseEnter={() =>
                      setTooltip({
                        leftPct: Math.min(Math.max(seg.leftPct + seg.widthPct / 2, 5), 95),
                        content: `${seg.label} · ${fmt(seg.startTime)} – ${fmt(seg.endTime)}`,
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))
              )}
            </div>

            {/* Tooltip — positioned above the bar, outside overflow:hidden */}
            {tooltip && (
              <div
                className="absolute z-10 pointer-events-none px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap"
                style={{
                  left: `${tooltip.leftPct}%`,
                  bottom: 'calc(100% + 6px)',
                  transform: 'translateX(-50%)',
                  background: 'rgba(10,1,24,0.96)',
                  border: '1px solid rgba(139,92,246,0.35)',
                  color: '#f8f4ff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {tooltip.content}
              </div>
            )}
          </div>

          {/* Time labels */}
          <div className="relative" style={{ height: 16 }}>
            {labels.map(({ label, pct }) => (
              <span
                key={pct}
                className="absolute"
                style={{
                  ...(pct === 0
                    ? { left: 0 }
                    : pct === 100
                    ? { right: 0 }
                    : { left: `${pct}%`, transform: 'translateX(-50%)' }),
                  color: 'var(--cp-text-dimmer)',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  lineHeight: '16px',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
