'use client'

import { useState, useRef, useEffect } from 'react'
import { useProject } from './ProjectProvider'

export default function ProjectSwitcher() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading } = useProject()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (loading) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid rgba(109, 40, 217, 0.2)',
          color: 'var(--cp-text-primary)',
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:border-purple-500/40 min-w-[160px]"
      >
        <span className="text-base leading-none">{selectedProject?.icon ?? '🌐'}</span>
        <span className="flex-1 text-left truncate">
          {selectedProject?.name ?? 'All Projects'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            background: 'var(--cp-card-bg)',
            border: '1px solid rgba(109, 40, 217, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
          className="absolute top-full left-0 mt-1 rounded-xl py-1 z-50 min-w-[200px] overflow-hidden"
        >
          <button
            onClick={() => { setSelectedProjectId(null); setOpen(false) }}
            style={{
              background: selectedProjectId === null ? 'rgba(109, 40, 217, 0.15)' : 'transparent',
              color: 'var(--cp-text-primary)',
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
          >
            <span className="text-base leading-none">🌐</span>
            <span>All Projects</span>
            {selectedProjectId === null && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          <div style={{ borderTop: '1px solid rgba(109, 40, 217, 0.12)' }} className="my-1" />

          {projects.filter(p => p.status === 'active').map(project => (
            <button
              key={project.id}
              onClick={() => { setSelectedProjectId(project.id); setOpen(false) }}
              style={{
                background: selectedProjectId === project.id ? 'rgba(109, 40, 217, 0.15)' : 'transparent',
                color: 'var(--cp-text-primary)',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
            >
              <span className="text-base leading-none">{project.icon}</span>
              <div className="flex-1 text-left">
                <div>{project.name}</div>
                {project.description && (
                  <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-normal mt-0.5 truncate max-w-[180px]">
                    {project.description}
                  </div>
                )}
              </div>
              {selectedProjectId === project.id && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
