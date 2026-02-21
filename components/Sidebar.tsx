'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { AGENTS } from '@/lib/data'
import SearchModal from './SearchModal'

const navItems = [
  {
    href: '/',
    label: 'Overview',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/agents',
    label: 'Agents',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="4" height="18" rx="1" />
        <rect x="10" y="3" width="4" height="13" rx="1" />
        <rect x="17" y="3" width="4" height="16" rx="1" />
      </svg>
    ),
  },
  {
    href: '/knowledge',
    label: 'Knowledge',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
  },
  {
    href: '/comms',
    label: 'Comms',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="12" y1="7" x2="12" y2="13" />
      </svg>
    ),
  },
  {
    href: '/metrics',
    label: 'Metrics',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    href: '/activity',
    label: 'Activity',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/usage',
    label: 'Usage',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M12 2a10 10 0 0 1 9 5.5" />
      </svg>
    ),
  },
  {
    href: '/mission',
    label: 'Mission',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
]

function SidebarContent({ onNavClick, onSearchClick }: { onNavClick?: () => void; onSearchClick?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div style={{ borderBottom: '1px solid rgba(109, 40, 217, 0.12)' }} className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              boxShadow: '0 0 20px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <div style={{ color: '#f8f4ff' }} className="font-bold text-sm tracking-wide leading-none">
              ClawPulse
            </div>
            <div style={{ color: '#6d28d9' }} className="text-xs mt-0.5 leading-none font-medium">
              Agent Ops
            </div>
          </div>
        </div>
      </div>

      {/* Search button */}
      <div className="px-3 pt-3">
        <button
          onClick={() => { onNavClick?.(); onSearchClick?.() }}
          style={{
            color: '#7c5fa0',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(109,40,217,0.15)',
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="flex-1 text-left">Search...</span>
          <kbd style={{ color: '#4b5563', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }} className="text-xs px-1.5 py-0.5 rounded font-mono hidden sm:inline">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div style={{ color: '#3b1d6e' }} className="px-2 mb-3 text-xs font-bold uppercase tracking-widest">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              style={
                isActive
                  ? {
                      background: 'rgba(109, 40, 217, 0.18)',
                      color: '#c4b5fd',
                      borderLeft: '2px solid #7c3aed',
                      boxShadow: 'inset 0 0 24px rgba(109, 40, 217, 0.06)',
                    }
                  : { color: '#7c5fa0', borderLeft: '2px solid transparent' }
              }
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px]"
              onMouseEnter={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(109, 40, 217, 0.08)'
                  el.style.color = '#ddd6fe'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'transparent'
                  el.style.color = '#7c5fa0'
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.55 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* System status */}
      <div style={{ borderTop: '1px solid rgba(109, 40, 217, 0.12)' }} className="px-4 py-4 space-y-3">
        <div style={{ color: '#3b1d6e' }} className="text-xs font-bold uppercase tracking-widest mb-2">
          System
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span style={{ color: '#6b7280' }} className="text-xs font-medium">System Active</span>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(109, 40, 217, 0.18)',
          }}
          className="rounded-xl p-3 space-y-2.5"
        >
          <div className="flex justify-between items-center">
            <span style={{ color: '#6b7280' }} className="text-xs">Total agents</span>
            <span style={{ color: '#f8f4ff' }} className="text-xs font-semibold">{AGENTS.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Close on route change
  const pathname = usePathname()
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{
          background: 'linear-gradient(180deg, #0e0120 0%, #080112 100%)',
          borderRight: '1px solid rgba(109, 40, 217, 0.18)',
          width: '240px',
          minWidth: '240px',
        }}
        className="hidden md:flex flex-col h-screen sticky top-0"
      >
        <SidebarContent onSearchClick={() => setSearchOpen(true)} />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        style={{
          background: 'rgba(109, 40, 217, 0.15)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          backdropFilter: 'blur(12px)',
        }}
        className="md:hidden fixed top-4 left-4 z-40 w-11 h-11 rounded-xl flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile: backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile: drawer */}
      <aside
        style={{
          background: 'linear-gradient(180deg, #0e0120 0%, #080112 100%)',
          borderRight: '1px solid rgba(109, 40, 217, 0.25)',
          width: '280px',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: mobileOpen ? '4px 0 32px rgba(0,0,0,0.6)' : 'none',
        }}
        className="md:hidden fixed left-0 top-0 h-full z-50"
      >
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          style={{ color: '#6b7280' }}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} onSearchClick={() => setSearchOpen(true)} />
      </aside>

      {/* Global search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
