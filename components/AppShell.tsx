'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationProvider from '@/components/NotificationProvider'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { useAuth } from '@/components/AuthProvider'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const pathname = usePathname()

  const isLoginPage = pathname === '/login'

  // Login page: render children only, no shell
  if (isLoginPage) {
    return <>{children}</>
  }

  // Loading state while checking auth
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#0a0118' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              boxShadow: '0 0 20px rgba(124, 58, 237, 0.35)',
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div style={{ color: '#6d28d9' }} className="text-xs font-medium tracking-wider uppercase">
            Loading…
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated: render nothing (redirect handled by AuthProvider)
  if (!session) {
    return null
  }

  // Authenticated: render full dashboard shell
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <Sidebar />
      <NotificationProvider />
      <KeyboardShortcuts />
      <PWAInstallBanner />
      <main className="flex-1 overflow-auto pt-16 md:pt-0 page-transition" style={{ background: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
