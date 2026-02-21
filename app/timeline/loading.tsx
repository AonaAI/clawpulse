export default function TimelineLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 160, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 300, height: 14, borderRadius: 6 }} />
      </div>
      <div
        style={{ background: 'rgba(17, 2, 29, 0.6)', border: '1px solid rgba(109, 40, 217, 0.14)' }}
        className="rounded-xl p-4 mb-6 space-y-3"
      >
        <div className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
        <div className="flex flex-wrap gap-2">
          {[60, 50, 55, 70, 65, 55, 60, 50].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ width: w, height: 28, borderRadius: 8 }} />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton-shimmer" style={{ width: 60, height: 14, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: 12, height: 12, borderRadius: '50%' }} />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer" style={{ width: '50%', height: 16, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '80%', height: 12, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
