import {
  PageHeaderSkeleton,
  StatBarSkeleton,
  AgentGridSkeleton,
  ActivityFeedSkeleton,
} from '@/components/Skeletons'

export default function OverviewLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer" style={{ width: 180, height: 36, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 280, height: 14, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 120, height: 38, borderRadius: 12 }} />
      </div>

      <div className="space-y-8">
        {/* Stats bar */}
        <StatBarSkeleton />

        {/* Agent grid */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="skeleton-shimmer" style={{ width: 120, height: 18, borderRadius: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 70, height: 22, borderRadius: 99 }} />
          </div>
          <AgentGridSkeleton count={6} />
        </div>

        {/* Activity feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="skeleton-shimmer" style={{ width: 110, height: 18, borderRadius: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 60, height: 24, borderRadius: 99 }} />
          </div>
          <ActivityFeedSkeleton count={6} />
        </div>
      </div>
    </div>
  )
}
