import { KanbanColumnSkeleton } from '@/components/Skeletons'

export default function TasksLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="skeleton-shimmer" style={{ width: 170, height: 36, borderRadius: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 280, height: 14, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 120, height: 42, borderRadius: 12 }} />
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {[90, 105, 100, 95].map((w, i) => (
          <div key={i} className="skeleton-shimmer" style={{ width: w, height: 36, borderRadius: 12 }} />
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KanbanColumnSkeleton count={3} />
        <KanbanColumnSkeleton count={2} />
        <KanbanColumnSkeleton count={4} />
        <KanbanColumnSkeleton count={1} />
      </div>
    </div>
  )
}
