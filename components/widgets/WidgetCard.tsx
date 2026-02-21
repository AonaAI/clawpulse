'use client'

import { ReactNode } from 'react'

interface WidgetCardProps {
  title: string
  badge?: ReactNode
  children: ReactNode
  compact?: boolean
  noPadding?: boolean
}

export default function WidgetCard({ title, badge, children, compact, noPadding }: WidgetCardProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">{title}</h2>
        {badge}
      </div>
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border)',
          backdropFilter: 'blur(12px)',
        }}
        className={`rounded-xl overflow-hidden ${noPadding ? '' : compact ? 'p-3' : 'p-4'}`}
      >
        {children}
      </div>
    </div>
  )
}
