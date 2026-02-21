'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8 text-center">
      <h2 style={{ color: '#f87171' }} className="text-xl font-bold mb-2">Something went wrong</h2>
      <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-4">{error.message}</p>
      <button onClick={reset} style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }} className="px-4 py-2 rounded-lg text-sm font-semibold">Try again</button>
    </div>
  )
}
