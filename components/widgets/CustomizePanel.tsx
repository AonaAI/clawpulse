'use client'

import { WidgetConfig, DEFAULT_WIDGETS } from '@/lib/widget-config'

interface Props {
  widgets: WidgetConfig[]
  onChange: (widgets: WidgetConfig[]) => void
  onClose: () => void
}

export default function CustomizePanel({ widgets, onChange, onClose }: Props) {
  const toggle = (id: string) => {
    onChange(widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w))
  }

  const toggleCompact = (id: string) => {
    onChange(widgets.map(w => w.id === id ? { ...w, compact: !w.compact } : w))
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = widgets.findIndex(w => w.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= widgets.length) return
    const copy = [...widgets]
    ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
    onChange(copy.map((w, i) => ({ ...w, order: i })))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--cp-overlay)' }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: '380px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--cp-panel-bg)',
          borderLeft: '1px solid var(--cp-border-strong)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          overflowY: 'auto',
        }}
        className="p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-lg font-bold">Customize Dashboard</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
          >
            ✕
          </button>
        </div>

        <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mb-4">
          Toggle widgets on/off, reorder them, and choose compact or expanded view. Drag widgets on the dashboard to reorder.
        </p>

        <button
          onClick={() => onChange(DEFAULT_WIDGETS.map(w => ({ ...w })))}
          style={{
            color: '#f87171',
            background: 'rgba(248, 113, 113, 0.08)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
          }}
          className="w-full mb-5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-500/15 transition-colors"
        >
          ↺ Reset Layout
        </button>

        <div className="space-y-2">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              style={{
                background: w.enabled ? 'rgba(124, 58, 237, 0.06)' : 'var(--cp-input-bg)',
                border: `1px solid ${w.enabled ? 'rgba(139, 92, 246, 0.2)' : 'var(--cp-border-subtle)'}`,
                opacity: w.enabled ? 1 : 0.6,
              }}
              className="rounded-xl p-3 flex items-center gap-3"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(w.id, -1)}
                  disabled={i === 0}
                  style={{ color: 'var(--cp-text-muted)', opacity: i === 0 ? 0.3 : 1 }}
                  className="text-xs leading-none hover:opacity-80"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(w.id, 1)}
                  disabled={i === widgets.length - 1}
                  style={{ color: 'var(--cp-text-muted)', opacity: i === widgets.length - 1 ? 0.3 : 1 }}
                  className="text-xs leading-none hover:opacity-80"
                >
                  ▼
                </button>
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold">{w.label}</div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => toggleCompact(w.id)}
                    style={{
                      color: w.compact ? '#22d3ee' : 'var(--cp-text-dim)',
                      background: w.compact ? 'rgba(34, 211, 238, 0.08)' : 'transparent',
                      border: `1px solid ${w.compact ? 'rgba(34, 211, 238, 0.2)' : 'var(--cp-border-subtle)'}`,
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  >
                    {w.compact ? 'Compact' : 'Expanded'}
                  </button>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(w.id)}
                style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: w.enabled ? '#7c3aed' : 'var(--cp-input-bg)',
                  border: `1px solid ${w.enabled ? 'rgba(139, 92, 246, 0.4)' : 'var(--cp-border-subtle)'}`,
                  position: 'relative',
                  transition: 'background 0.2s',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: w.enabled ? '20px' : '2px',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
