'use client'

// ── Primitives ────────────────────────────────────────────────────────────

function Bone({ width = '100%', height = 16, radius = 6, className = '' }: {
  width?: string | number
  height?: number
  radius?: number
  className?: string
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: radius, flexShrink: 0 }}
    />
  )
}

// ── Stat / Summary card ────────────────────────────────────────────────────

export function StatCardSkeleton({ accent }: { accent?: string }) {
  const borderColor = accent ?? 'rgba(109, 40, 217, 0.15)'
  return (
    <div
      style={{
        background: 'var(--cp-page-gradient)',
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <Bone width={80} height={10} />
        <Bone width={20} height={20} radius={8} />
      </div>
      <Bone width={60} height={36} radius={8} className="mb-2" />
      <Bone width={100} height={10} />
    </div>
  )
}

export function StatBarSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Agent card ─────────────────────────────────────────────────────────────

export function AgentCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        style={{
          background: 'var(--cp-deep-bg)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
        }}
        className="rounded-lg p-2.5 flex items-center gap-2"
      >
        <Bone width={28} height={28} radius={8} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Bone width="60%" height={11} />
        </div>
        <Bone width={60} height={20} radius={99} />
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--cp-page-gradient)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Card header */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid rgba(109, 40, 217, 0.1)',
        }}
        className="p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Bone width={48} height={48} radius={12} />
            <div className="min-w-0 space-y-2">
              <Bone width={100} height={14} />
              <Bone width={70} height={11} />
            </div>
          </div>
          <Bone width={65} height={22} radius={99} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Bone width={45} height={10} />
          <Bone width={65} height={20} radius={99} />
        </div>
        <div className="space-y-1.5">
          <Bone width={70} height={10} />
          <Bone width="100%" height={28} radius={8} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Bone width={80} height={12} />
          <Bone width={90} height={12} />
        </div>
      </div>
    </div>
  )
}

export function AgentGridSkeleton({ count = 6, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div
      className={`grid ${
        compact
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
      }`}
    >
      {[...Array(count)].map((_, i) => (
        <AgentCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  )
}

// ── Activity feed item ─────────────────────────────────────────────────────

export function ActivityItemSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      className="flex items-start gap-3 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}
    >
      <Bone width={26} height={26} radius={8} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Bone width={80} height={11} />
          <Bone width={40} height={10} />
        </div>
        <Bone width="50%" height={11} />
        <Bone width="75%" height={10} />
      </div>
    </div>
  )
}

export function ActivityFeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl px-4 overflow-hidden"
    >
      {[...Array(count)].map((_, i) => (
        <ActivityItemSkeleton key={i} isLast={i === count - 1} />
      ))}
    </div>
  )
}

// ── Cost / token card ──────────────────────────────────────────────────────

export function CostCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--cp-page-gradient)',
        border: '1px solid rgba(109, 40, 217, 0.18)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-5"
    >
      <Bone width={70} height={10} className="mb-3" />
      <Bone width={80} height={32} radius={8} className="mb-1" />
      <Bone width={50} height={10} className="mb-4" />
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 12 }}>
        <Bone width={60} height={20} radius={6} />
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────

export function TaskCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--cp-deep-bg)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        borderLeft: '2px solid rgba(100, 18, 166, 0.4)',
      }}
      className="rounded-lg p-3.5 space-y-2.5"
    >
      <Bone width="80%" height={13} />
      <Bone width="55%" height={11} />
      <div className="flex items-center justify-between pt-0.5">
        <Bone width={65} height={20} radius={99} />
        <Bone width={80} height={20} radius={6} />
      </div>
      <div
        className="flex items-center gap-2 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <Bone width={20} height={20} radius={4} />
        <Bone width={70} height={11} />
      </div>
    </div>
  )
}

export function KanbanColumnSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        style={{
          background: 'var(--cp-deep-bg)',
          border: '1px solid rgba(109, 40, 217, 0.18)',
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
        }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Bone width={8} height={8} radius={99} />
          <Bone width={70} height={12} />
        </div>
        <Bone width={24} height={20} radius={99} />
      </div>
      {/* Drop zone */}
      <div
        style={{
          background: 'rgba(10, 1, 24, 0.55)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '0 0 12px 12px',
        }}
        className="flex-1 p-3 space-y-2.5 min-h-[400px]"
      >
        {[...Array(count)].map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  const widths = [120, 80, 70, 70, 70, 80]
  return (
    <div
      className="grid px-5 py-3.5 items-center"
      style={{
        gridTemplateColumns: widths.slice(0, cols).map(() => '1fr').join(' '),
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {[...Array(cols)].map((_, i) => (
        <Bone key={i} width={widths[i] || 80} height={13} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  const headers = ['Agent', 'Model', 'Input', 'Output', 'Total', 'Cost'].slice(0, cols)
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Table header */}
      <div
        className="grid px-5 py-2.5"
        style={{
          gridTemplateColumns: headers.map(() => '1fr').join(' '),
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        {headers.map(h => (
          <span key={h} style={{ color: '#4b5563' }} className="text-xs font-bold uppercase tracking-wider">
            {h}
          </span>
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </div>
  )
}

// ── Bar chart row (metrics) ────────────────────────────────────────────────

export function BarRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Bone width={80} height={11} />
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 4,
          height: 8,
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <div className="skeleton-shimmer" style={{ width: `${Math.random() * 60 + 20}%`, height: '100%' }} />
      </div>
      <Bone width={24} height={13} />
    </div>
  )
}

export function BarChartSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-6"
    >
      <div className="mb-5 space-y-1.5">
        <Bone width={160} height={14} />
        <Bone width={120} height={11} />
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <BarRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ── Knowledge card ────────────────────────────────────────────────────────

export function KnowledgeCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--cp-page-gradient)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        borderTop: '2px solid rgba(100, 18, 166, 0.35)',
      }}
      className="rounded-xl overflow-hidden"
    >
      <div className="p-5 space-y-3">
        <Bone width={80} height={20} radius={99} />
        <Bone width="85%" height={16} radius={6} />
        <div className="space-y-1.5">
          <Bone width="100%" height={11} />
          <Bone width="90%" height={11} />
          <Bone width="70%" height={11} />
        </div>
        <div className="flex gap-1.5">
          <Bone width={50} height={18} radius={4} />
          <Bone width={60} height={18} radius={4} />
        </div>
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2">
            <Bone width={20} height={20} radius={4} />
            <Bone width={60} height={11} />
          </div>
          <Bone width={70} height={11} />
        </div>
      </div>
    </div>
  )
}

// ── Mission/vision card ───────────────────────────────────────────────────

export function MissionCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--cp-page-gradient)',
        border: '1px solid rgba(100, 18, 166, 0.2)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-2xl p-7"
    >
      <div className="flex items-center justify-between mb-5">
        <Bone width={140} height={26} radius={99} />
        <Bone width={70} height={30} radius={8} />
      </div>
      <div className="space-y-2">
        <Bone width="100%" height={16} />
        <Bone width="90%" height={16} />
        <Bone width="70%" height={16} />
      </div>
    </div>
  )
}

// ── Agent mission card ────────────────────────────────────────────────────

export function AgentMissionCardSkeleton() {
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
      }}
      className="rounded-xl overflow-hidden"
    >
      <div
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        className="px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Bone width={36} height={36} radius={12} />
          <div className="space-y-1.5">
            <Bone width={80} height={13} />
            <Bone width={55} height={10} />
          </div>
        </div>
        <Bone width={55} height={20} radius={99} />
      </div>
      <div className="px-5 py-4 space-y-1.5">
        <Bone width="100%" height={11} />
        <Bone width="80%" height={11} />
        <Bone width="50%" height={11} />
      </div>
    </div>
  )
}

// ── Cron job row ──────────────────────────────────────────────────────────

export function CronJobRowSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      className="px-5 py-4 flex items-center justify-between"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <Bone width={50} height={20} radius={99} />
        <div className="min-w-0 space-y-1.5">
          <Bone width={130} height={13} />
          <Bone width={90} height={10} />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <Bone width={80} height={11} />
        <Bone width={70} height={11} />
        <Bone width={40} height={11} />
      </div>
    </div>
  )
}

// ── Page header skeleton ──────────────────────────────────────────────────

export function PageHeaderSkeleton({ hasSubtitle = true, hasAction = false }: {
  hasSubtitle?: boolean
  hasAction?: boolean
}) {
  return (
    <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
      <div className="space-y-2">
        <Bone width={220} height={32} radius={8} />
        {hasSubtitle && <Bone width={300} height={14} />}
      </div>
      {hasAction && <Bone width={130} height={38} radius={12} />}
    </div>
  )
}
