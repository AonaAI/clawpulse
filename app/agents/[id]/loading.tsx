export default function AgentDetailLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <div className="skeleton-shimmer" style={{ width: 60, height: 14, borderRadius: 6 }} />
        <div style={{ color: 'rgba(109,40,217,0.4)' }}>/</div>
        <div className="skeleton-shimmer" style={{ width: 100, height: 14, borderRadius: 6 }} />
      </div>

      {/* Agent header card */}
      <div
        style={{
          background: 'var(--cp-page-gradient)',
          border: '1px solid rgba(109, 40, 217, 0.18)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6 mb-6"
      >
        <div className="flex items-start gap-4">
          <div className="skeleton-shimmer" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton-shimmer" style={{ width: 180, height: 24, borderRadius: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 120, height: 14, borderRadius: 6 }} />
            <div className="flex gap-2 mt-2">
              <div className="skeleton-shimmer" style={{ width: 80, height: 22, borderRadius: 99 }} />
              <div className="skeleton-shimmer" style={{ width: 70, height: 22, borderRadius: 99 }} />
            </div>
          </div>
          <div className="skeleton-shimmer" style={{ width: 80, height: 28, borderRadius: 99 }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mission */}
          <div
            style={{
              background: 'rgba(17,2,29,0.6)',
              border: '1px solid rgba(109,40,217,0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-5"
          >
            <div className="skeleton-shimmer mb-4" style={{ width: 80, height: 14, borderRadius: 6 }} />
            <div className="space-y-1.5">
              <div className="skeleton-shimmer" style={{ width: '100%', height: 13, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '85%', height: 13, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '60%', height: 13, borderRadius: 6 }} />
            </div>
          </div>

          {/* Activity */}
          <div
            style={{
              background: 'rgba(17,2,29,0.6)',
              border: '1px solid rgba(109,40,217,0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl overflow-hidden"
          >
            <div
              className="px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="skeleton-shimmer" style={{ width: 130, height: 16, borderRadius: 6 }} />
            </div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="px-5 py-3.5 flex items-start gap-3"
                style={{ borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <div className="skeleton-shimmer" style={{ width: 28, height: 28, borderRadius: 8 }} />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton-shimmer" style={{ width: '50%', height: 12, borderRadius: 6 }} />
                  <div className="skeleton-shimmer" style={{ width: '75%', height: 11, borderRadius: 6 }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: 45, height: 10, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(17,2,29,0.6)',
                border: '1px solid rgba(109,40,217,0.14)',
                backdropFilter: 'blur(12px)',
              }}
              className="rounded-xl p-4 space-y-2"
            >
              <div className="skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '100%', height: 30, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
