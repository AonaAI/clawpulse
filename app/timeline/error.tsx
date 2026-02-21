'use client'

export default function TimelineError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 max-w-4xl mx-auto text-center">
      <h2 style={{ color: '#f87171' }} className="text-xl font-bold mb-2">Timeline Error</h2>
      <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-4">{error.message}</p>
      <button
        onClick={reset}
        style={{ background: 'rgba(109, 40, 217, 0.2)', border: '1px solid rgba(109, 40, 217, 0.3)', color: '#c4b5fd' }}
        className="px-4 py-2 rounded-lg text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
