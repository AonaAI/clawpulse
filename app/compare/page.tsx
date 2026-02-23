'use client'

import dynamic from 'next/dynamic'

const ComparePage = dynamic(() => import('./PageClient'), {
  loading: () => (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--cp-card-bg)' }} />
      <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--cp-card-bg)' }} />
    </div>
  ),
})

export default function Page() {
  return <ComparePage />
}
