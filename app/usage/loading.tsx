import { CostCardSkeleton, TableSkeleton } from '@/components/Skeletons'

function AgentUsageRowSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 90, height: 13, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 55, height: 20, borderRadius: 99 }} />
        </div>
        <div className="text-right space-y-1">
          <div className="skeleton-shimmer" style={{ width: 50, height: 13, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 40, height: 11, borderRadius: 6 }} />
        </div>
      </div>
      <div className="skeleton-shimmer" style={{ width: '100%', height: 6, borderRadius: 999 }} />
    </div>
  )
}

function DailyTrendRowSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="skeleton-shimmer" style={{ width: 50, height: 11, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: 40, height: 11, borderRadius: 6 }} />
      </div>
      <div className="skeleton-shimmer" style={{ width: '100%', height: 4, borderRadius: 999 }} />
    </div>
  )
}

export default function UsageLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 260, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 340, height: 14, borderRadius: 6 }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <CostCardSkeleton />
        <CostCardSkeleton />
        <CostCardSkeleton />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Per-agent usage */}
        <div className="xl:col-span-2">
          <div
            style={{
              background: 'rgba(17, 2, 29, 0.6)',
              border: '1px solid rgba(109, 40, 217, 0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-5"
          >
            <div className="skeleton-shimmer mb-5" style={{ width: 190, height: 18, borderRadius: 6 }} />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <AgentUsageRowSkeleton key={i} isLast={i === 4} />
              ))}
            </div>
          </div>
        </div>

        {/* 7-day trend */}
        <div>
          <div
            style={{
              background: 'rgba(17, 2, 29, 0.6)',
              border: '1px solid rgba(109, 40, 217, 0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-5"
          >
            <div className="skeleton-shimmer mb-5" style={{ width: 120, height: 18, borderRadius: 6 }} />
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <DailyTrendRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Records table */}
      <TableSkeleton rows={6} cols={6} />
    </div>
  )
}
