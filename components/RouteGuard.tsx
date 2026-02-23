'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useRBAC } from './RBACProvider'

export default function RouteGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasAccess } = useRBAC()
  const toastRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasAccess(pathname)) {
      // Show toast
      const toast = document.createElement('div')
      toast.textContent = 'Access restricted'
      Object.assign(toast.style, {
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        background: '#dc2626',
        color: 'white',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
  }, [pathname, hasAccess, router])

  return null
}
