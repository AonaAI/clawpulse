import { KnowledgeCardSkeleton } from '@/components/Skeletons'

export default function KnowledgeLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="skeleton-shimmer" style={{ width: 200, height: 36, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 320, height: 14, borderRadius: 6 }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer" style={{ width: 100, height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 90, height: 42, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 42, borderRadius: 12 }} />
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[70, 90, 80, 100, 95].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: w, height: 34, borderRadius: 8 }} />
          ))}
        </div>
        <div className="ml-auto skeleton-shimmer" style={{ width: 200, height: 36, borderRadius: 10 }} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <KnowledgeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
