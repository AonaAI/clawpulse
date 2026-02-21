import { MissionCardSkeleton, AgentMissionCardSkeleton } from '@/components/Skeletons'

export default function MissionLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 220, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 300, height: 14, borderRadius: 6 }} />
      </div>

      {/* Company statements */}
      <div className="space-y-5 mb-12">
        <MissionCardSkeleton />
        <MissionCardSkeleton />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div style={{ flex: 1, height: 1, background: 'rgba(109,40,217,0.14)' }} />
        <div className="skeleton-shimmer" style={{ width: 130, height: 12, borderRadius: 6 }} />
        <div style={{ flex: 1, height: 1, background: 'rgba(109,40,217,0.14)' }} />
      </div>

      {/* Agent missions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <AgentMissionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
