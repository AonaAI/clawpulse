import { CronJobRowSkeleton } from '@/components/Skeletons'

export default function CommsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer" style={{ width: 230, height: 36, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 320, height: 14, borderRadius: 6 }} />
      </div>

      {/* Agent communication graph */}
      <div
        style={{
          background: 'var(--cp-page-gradient)',
          border: '1px solid rgba(100, 18, 166, 0.2)',
          backdropFilter: 'blur(12px)',
          height: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="rounded-2xl mb-8 overflow-hidden"
      >
        <div className="text-center space-y-3">
          <div className="skeleton-shimmer mx-auto" style={{ width: 64, height: 64, borderRadius: 99 }} />
          <div className="skeleton-shimmer mx-auto" style={{ width: 160, height: 14, borderRadius: 6 }} />
          <div className="flex justify-center gap-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 99 }} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cron jobs */}
        <div className="xl:col-span-2">
          <div
            style={{
              background: 'rgba(17, 2, 29, 0.6)',
              border: '1px solid rgba(109, 40, 217, 0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl overflow-hidden"
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="skeleton-shimmer" style={{ width: 130, height: 16, borderRadius: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 80, height: 24, borderRadius: 99 }} />
            </div>
            {[...Array(5)].map((_, i) => (
              <CronJobRowSkeleton key={i} isLast={i === 4} />
            ))}
          </div>
        </div>

        {/* Slack channels */}
        <div>
          <div
            style={{
              background: 'rgba(17, 2, 29, 0.6)',
              border: '1px solid rgba(109, 40, 217, 0.14)',
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl p-5"
          >
            <div className="skeleton-shimmer mb-5" style={{ width: 140, height: 16, borderRadius: 6 }} />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="skeleton-shimmer" style={{ width: 100, height: 12, borderRadius: 6 }} />
                  <div className="skeleton-shimmer" style={{ width: 30, height: 18, borderRadius: 99 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
