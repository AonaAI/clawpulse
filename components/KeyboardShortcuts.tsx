'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const shortcuts = [
  { keys: ['⌘', 'K'], desc: 'Search' },
  { keys: ['?'], desc: 'This panel' },
  { keys: ['Esc'], desc: 'Close modals' },
  { keys: ['g', 'a'], desc: 'Go to Agents' },
  { keys: ['g', 't'], desc: 'Go to Tasks' },
  { keys: ['g', 'h'], desc: 'Go to Overview' },
  { keys: ['g', 'm'], desc: 'Go to Metrics' },
  { keys: ['g', 'c'], desc: 'Go to Comms' },
]

const navMap: Record<string, string> = {
  a: '/agents',
  t: '/tasks',
  h: '/',
  m: '/metrics',
  c: '/comms',
}

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const [gPressed, setGPressed] = useState(false)
  const router = useRouter()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if ((e.target as HTMLElement)?.isContentEditable) return

    if (e.key === 'Escape') {
      setOpen(false)
      setGPressed(false)
      return
    }

    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      setOpen(o => !o)
      return
    }

    if (gPressed) {
      setGPressed(false)
      const path = navMap[e.key]
      if (path) {
        e.preventDefault()
        router.push(path)
      }
      return
    }

    if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
      setGPressed(true)
      setTimeout(() => setGPressed(false), 1000)
    }
  }, [gPressed, router])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md shadow-2xl page-transition"
        style={{
          background: 'var(--cp-card-bg, #1a1030)',
          border: '1px solid var(--cp-border, rgba(255,255,255,0.08))',
          color: 'var(--foreground)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--cp-text-muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          {shortcuts.map(s => (
            <div key={s.desc} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--cp-text-muted)' }}>{s.desc}</span>
              <div className="flex gap-1.5">
                {s.keys.map(k => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-5 text-center" style={{ color: 'var(--cp-text-muted)' }}>
          Press <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>?</kbd> to toggle
        </p>
      </div>
    </div>
  )
}
