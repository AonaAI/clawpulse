import { ActivityFeedSkeleton } from '@/components/Skeletons'

function FilterBarSkeleton() {
  return (
    <div
      style={{
        background: 'rgba(17, 2, 29, 0.6)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl p-4 mb-6 space-y-3"
    >
      <div className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
      <div className="flex flex-wrap gap-2">
        {[60, 80, 75, 80, 85, 75, 80, 65, 55].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: w, height: 28, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  )
}

export default function ActivityLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer" style={{ width: 180, height: 36, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 340, height: 14, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 80, height: 30, borderRadius: 99 }} />
      </div>

      {/* Toggle buttons */}
      <div className="flex gap-2 mb-4">
        {[80, 90, 100].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: w, height: 38, borderRadius: 8 }} />
        ))}
      </div>

      {/* Filter bar */}
      <FilterBarSkeleton />

      {/* Count */}
      <div className="skeleton-shimmer mb-4" style={{ width: 80, height: 12, borderRadius: 6 }} />

      {/* Feed */}
      <div className="space-y-6">
        {[0, 1].map(g => (
          <div key={g}>
            <div className="flex items-center gap-3 mb-3">
              <div className="skeleton-shimmer" style={{ width: 60, height: 24, borderRadius: 99 }} />
              <div style={{ flex: 1, height: 1, background: 'rgba(109,40,217,0.1)' }} />
            </div>
            <ActivityFeedSkeleton count={5} />
          </div>
        ))}
      </div>
    </div>
  )
}
