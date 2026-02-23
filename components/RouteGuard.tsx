'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useRBAC } from './RBACProvider'
import { useAuth } from './AuthProvider'

export default function RouteGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasAccess, roleLoading } = useRBAC()
  const { user, loading: authLoading } = useAuth()
  const toastRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Wait for auth + role to resolve
    if (authLoading || roleLoading) return
    // Login page is always accessible
    if (pathname === '/login') return
    // Not signed in → AuthProvider handles redirect
    if (!user) return

    if (!hasAccess(pathname)) {
      // Show toast
      const toast = document.createElement('div')
      toast.textContent = '🔒 Access restricted — insufficient permissions'
      Object.assign(toast.style, {
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        background: 'linear-gradient(135deg, #7c2d12, #991b1b)',
        color: '#fecaca',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        zIndex: '9999',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(239,68,68,0.3)',
        transition: 'opacity 0.3s',
      })
      document.body.appendChild(toast)
      toastRef.current = toast

      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.opacity = '0'
          setTimeout(() => toast.parentNode?.removeChild(toast), 300)
        }
      }, 3000)

      router.replace('/')
    }
  }, [pathname, hasAccess, router, authLoading, roleLoading, user])

  return null
}
