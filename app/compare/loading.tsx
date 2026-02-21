export default function CompareLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 280, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 360, height: 14, borderRadius: 6 }} />
      </div>
      <div className="skeleton-shimmer mb-6" style={{ width: '100%', height: 48, borderRadius: 12 }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(17, 2, 29, 0.6)',
              border: '1px solid rgba(109, 40, 217, 0.14)',
            }}
            className="rounded-xl p-5"
          >
            <div className="skeleton-shimmer mb-4" style={{ width: 160, height: 18, borderRadius: 6 }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: 180, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
