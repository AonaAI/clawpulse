import { AgentGridSkeleton } from '@/components/Skeletons'

export default function AgentsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 200, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 260, height: 14, borderRadius: 6 }} />
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {[80, 95, 80, 90].map((w, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{ width: w, height: 36, borderRadius: 12 }}
          />
        ))}
      </div>

      {/* Agent cards */}
      <AgentGridSkeleton count={9} />
    </div>
  )
}
