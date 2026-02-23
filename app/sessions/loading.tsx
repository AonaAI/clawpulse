export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="skeleton-shimmer mb-8" style={{ width: 160, height: 32, borderRadius: 8 }} />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 56, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
