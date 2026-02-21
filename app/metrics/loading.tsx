import { StatBarSkeleton, BarChartSkeleton, ActivityFeedSkeleton } from '@/components/Skeletons'

export default function MetricsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 130, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 340, height: 14, borderRadius: 6 }} />
      </div>

      {/* Stat cards */}
      <div className="mb-8">
        <StatBarSkeleton />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartSkeleton rows={4} />
        <BarChartSkeleton rows={4} />
        <BarChartSkeleton rows={5} />
        <BarChartSkeleton rows={4} />
      </div>

      {/* Activity feed */}
      <div
        style={{
          background: 'rgba(17, 2, 29, 0.6)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="skeleton-shimmer" style={{ width: 150, height: 16, borderRadius: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 220, height: 11, borderRadius: 6 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: 70, height: 24, borderRadius: 99 }} />
        </div>
        <ActivityFeedSkeleton count={6} />
      </div>
    </div>
  )
}
