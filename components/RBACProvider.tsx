'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type Role, hasAccess as checkAccess, ROLES } from '@/lib/rbac'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase-client'

interface RBACContextValue {
  role: Role
  setRole: (r: Role) => void
  hasAccess: (path: string) => boolean
  roleLoading: boolean
}

const RBACContext = createContext<RBACContextValue>({
  role: 'viewer',
  setRole: () => {},
  hasAccess: () => false,
  roleLoading: true,
})

/**
 * DEV_MODE enables the role switcher in settings for local development.
 * In production, roles come exclusively from the user_roles table.
 */
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

export default function RBACProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [role, setRoleState] = useState<Role>('viewer')
  const [roleLoading, setRoleLoading] = useState(true)
  const [dbRole, setDbRole] = useState<Role>('viewer')

  // Fetch role from user_roles table when user changes
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setRoleState('viewer')
      setDbRole('viewer')
      setRoleLoading(false)
      return
    }

    setRoleLoading(true)
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        const fetchedRole: Role = (data?.role && ROLES.includes(data.role as Role))
          ? (data.role as Role)
          : 'viewer'
        setDbRole(fetchedRole)

        // In DEV_MODE, check if there's a localStorage override (only if user is admin)
        if (DEV_MODE && fetchedRole === 'admin') {
          const override = typeof window !== 'undefined' ? localStorage.getItem('clawpulse-role-dev') : null
          if (override && ROLES.includes(override as Role)) {
            setRoleState(override as Role)
          } else {
            setRoleState(fetchedRole)
          }
        } else {
          setRoleState(fetchedRole)
        }
        setRoleLoading(false)
      })
  }, [user, authLoading])

  /**
   * setRole: In DEV_MODE + admin, allows overriding role for testing.
   * Otherwise this is a no-op (roles come from DB).
   */
  const setRole = useCallback((r: Role) => {
    if (DEV_MODE && dbRole === 'admin') {
      localStorage.setItem('clawpulse-role-dev', r)
      setRoleState(r)
    }
  }, [dbRole])

  const hasAccessFn = useCallback((path: string) => checkAccess(role, path), [role])

  return (
    <RBACContext.Provider value={{ role, setRole, hasAccess: hasAccessFn, roleLoading }}>
      {children}
    </RBACContext.Provider>
  )
}

export function useRBAC() {
  return useContext(RBACContext)
}

/** Whether the dev role switcher should be shown */
export function useDevRoleSwitcherEnabled(): boolean {
  const { role } = useRBAC()
  return DEV_MODE && role === 'admin'
}
