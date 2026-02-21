'use client'

import { useRef, useState, useCallback, ReactNode } from 'react'
import { WidgetConfig } from '@/lib/widget-config'

interface Props {
  widget: WidgetConfig
  children: ReactNode
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
  onToggleCollapse: (id: string) => void
  isDragTarget: boolean
  isDragging: boolean
  isMobile: boolean
}

export default function DraggableWidget({
  widget, children, onDragStart, onDragOver, onDragEnd,
  onToggleCollapse, isDragTarget, isDragging, isMobile,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', widget.id)
    onDragStart(widget.id)
  }, [widget.id, onDragStart])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragOver(widget.id)
  }, [widget.id, onDragOver])

  return (
    <div
      ref={ref}
      draggable={!isMobile}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDrop={(e) => { e.preventDefault(); onDragEnd() }}
      className="group relative"
      style={{
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s',
        borderRadius: '16px',
        border: isDragTarget ? '2px dashed rgba(139, 92, 246, 0.5)' : '2px solid transparent',
        background: isDragTarget ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
        boxShadow: isDragTarget ? '0 0 0 4px rgba(139, 92, 246, 0.08)' : 'none',
        padding: '2px',
      }}
    >
      {/* Drag handle + collapse toggle */}
      {!isMobile && (
        <div
          className="absolute -left-1 top-2 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ cursor: 'grab' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Grip icon */}
          <div
            title="Drag to reorder"
            style={{
              color: 'var(--cp-text-dim)',
              background: 'var(--cp-input-bg)',
              border: '1px solid var(--cp-border-subtle)',
              borderRadius: '8px',
              padding: '4px 3px',
              cursor: 'grab',
              lineHeight: 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
            </svg>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => onToggleCollapse(widget.id)}
        title={widget.collapsed ? 'Expand widget' : 'Collapse widget'}
        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          color: 'var(--cp-text-dim)',
          background: 'var(--cp-input-bg)',
          border: '1px solid var(--cp-border-subtle)',
          borderRadius: '8px',
          padding: '4px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: widget.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Widget content */}
      <div style={{
        overflow: 'hidden',
        maxHeight: widget.collapsed ? '0px' : '2000px',
        opacity: widget.collapsed ? 0 : 1,
        transition: 'max-height 0.3s ease, opacity 0.2s ease',
      }}>
        {children}
      </div>

      {/* Collapsed label */}
      {widget.collapsed && (
        <div
          onClick={() => onToggleCollapse(widget.id)}
          style={{
            color: 'var(--cp-text-dim)',
            background: 'var(--cp-input-bg)',
            border: '1px solid var(--cp-border-subtle)',
            borderRadius: '12px',
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
          className="flex items-center gap-2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          {widget.label}
        </div>
      )}
    </div>
  )
}
