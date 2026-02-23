'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 text-center">
      <p style={{ color: '#f87171' }} className="text-sm mb-4">{error.message}</p>
      <button onClick={reset} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }} className="px-4 py-2 rounded-lg text-sm">
        Retry
      </button>
    </div>
  )
}
