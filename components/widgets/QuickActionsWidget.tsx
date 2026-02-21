'use client'

import Link from 'next/link'

const actions = [
  {
    label: 'Search',
    href: '#search',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: 'Agents',
    href: '/agents',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    label: 'Activity',
    href: '/activity',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: 'Usage',
    href: '/usage',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: 'Knowledge',
    href: '/knowledge',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
]

interface Props {
  compact?: boolean
  onSearch?: () => void
}

export default function QuickActionsWidget({ compact, onSearch }: Props) {
  return (
    <div className={`grid ${compact ? 'grid-cols-6 gap-2' : 'grid-cols-3 sm:grid-cols-6 gap-3'}`}>
      {actions.map(a => {
        const isSearch = a.href === '#search'
        const inner = (
          <div
            style={{
              background: 'rgba(124, 58, 237, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.18)',
              color: '#a78bfa',
            }}
            className={`rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[rgba(139,92,246,0.4)] transition-colors ${compact ? 'p-2' : 'p-4'}`}
          >
            {a.icon}
            <span className="text-xs font-semibold" style={{ color: 'var(--cp-text-secondary)' }}>{a.label}</span>
          </div>
        )
        if (isSearch) {
          return <div key={a.label} onClick={onSearch}>{inner}</div>
        }
        return <Link key={a.label} href={a.href}>{inner}</Link>
      })}
    </div>
  )
}
