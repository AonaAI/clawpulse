'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { WidgetConfig, DEFAULT_WIDGETS } from '@/lib/widget-config'

interface Props {
  widgets: WidgetConfig[]
  onChange: (widgets: WidgetConfig[]) => void
  onClose: () => void
}

export default function CustomizePanel({ widgets, onChange, onClose }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  const sorted = [...widgets].sort((a, b) => a.order - b.order)

  const toggle = (id: string) => {
    onChange(widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w))
  }

  const toggleCompact = (id: string) => {
    onChange(widgets.map(w => w.id === id ? { ...w, compact: !w.compact } : w))
  }

  const toggleSize = (id: string) => {
    onChange(widgets.map(w => w.id === id ? { ...w, size: w.size === 'full' ? 'half' : 'full' } : w))
  }

  const move = (id: string, dir: -1 | 1) => {
    const s = [...sorted]
    const idx = s.findIndex(w => w.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= s.length) return
    ;[s[idx], s[newIdx]] = [s[newIdx], s[idx]]
    onChange(s.map((w, i) => ({ ...w, order: i })))
  }

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== targetIdx) {
      const s = [...sorted]
      const [moved] = s.splice(dragIdx, 1)
      s.splice(targetIdx, 0, moved)
      onChange(s.map((w, i) => ({ ...w, order: i })))
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDragOverIdx(null)
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
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--cp-overlay)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'relative',
          width: '400px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--cp-panel-bg)',
          borderLeft: '1px solid var(--cp-border-strong)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          overflowY: 'auto',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease',
        }}
        className="p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-lg font-bold">Customize Dashboard</h2>
          <button
            onClick={handleClose}
            style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
          >
            ✕
          </button>
        </div>

        <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mb-4">
          Toggle widgets on/off, reorder by dragging or using arrows, choose size and density.
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
          ↺ Reset to Default
        </button>

        <div className="space-y-2">
          {sorted.map((w, i) => (
            <div
              key={w.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              style={{
                background: dragOverIdx === i && dragIdx !== i
                  ? 'rgba(139, 92, 246, 0.12)'
                  : w.enabled ? 'rgba(124, 58, 237, 0.06)' : 'var(--cp-input-bg)',
                border: `1px solid ${
                  dragOverIdx === i && dragIdx !== i
                    ? 'rgba(139, 92, 246, 0.5)'
                    : w.enabled ? 'rgba(139, 92, 246, 0.2)' : 'var(--cp-border-subtle)'
                }`,
                opacity: dragIdx === i ? 0.4 : w.enabled ? 1 : 0.6,
                transition: 'all 0.15s ease',
                cursor: 'grab',
              }}
              className="rounded-xl p-3 flex items-center gap-3"
            >
              {/* Drag grip + reorder buttons */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => move(w.id, -1)}
                  disabled={i === 0}
                  style={{ color: 'var(--cp-text-muted)', opacity: i === 0 ? 0.3 : 1 }}
                  className="text-xs leading-none hover:opacity-80"
                >
                  ▲
                </button>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--cp-text-dim)" style={{ opacity: 0.5 }}>
                  <circle cx="9" cy="8" r="1.5" /><circle cx="15" cy="8" r="1.5" />
                  <circle cx="9" cy="16" r="1.5" /><circle cx="15" cy="16" r="1.5" />
                </svg>
                <button
                  onClick={() => move(w.id, 1)}
                  disabled={i === sorted.length - 1}
                  style={{ color: 'var(--cp-text-muted)', opacity: i === sorted.length - 1 ? 0.3 : 1 }}
                  className="text-xs leading-none hover:opacity-80"
                >
                  ▼
                </button>
              </div>

              {/* Label + options */}
              <div className="flex-1 min-w-0">
                <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold">{w.label}</div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <button
                    onClick={() => toggleCompact(w.id)}
                    style={{
                      color: w.compact ? '#22d3ee' : 'var(--cp-text-dim)',
                      background: w.compact ? 'rgba(34, 211, 238, 0.08)' : 'transparent',
                      border: `1px solid ${w.compact ? 'rgba(34, 211, 238, 0.2)' : 'var(--cp-border-subtle)'}`,
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                  >
                    {w.compact ? 'Compact' : 'Expanded'}
                  </button>
                  <button
                    onClick={() => toggleSize(w.id)}
                    style={{
                      color: w.size === 'half' ? '#a78bfa' : 'var(--cp-text-dim)',
                      background: w.size === 'half' ? 'rgba(167, 139, 250, 0.08)' : 'transparent',
                      border: `1px solid ${w.size === 'half' ? 'rgba(167, 139, 250, 0.2)' : 'var(--cp-border-subtle)'}`,
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors"
                  >
                    {w.size === 'half' ? '½ Width' : 'Full Width'}
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
