'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { type Role, hasAccess as checkAccess, getStoredRole, setStoredRole } from '@/lib/rbac'

interface RBACContextValue {
  role: Role
  setRole: (r: Role) => void
  hasAccess: (path: string) => boolean
}

const RBACContext = createContext<RBACContextValue>({
  role: 'admin',
  setRole: () => {},
  hasAccess: () => true,
})

export default function RBACProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>('admin')

  useEffect(() => {
    setRoleState(getStoredRole())
  }, [])

  const setRole = useCallback((r: Role) => {
    setStoredRole(r)
    setRoleState(r)
  }, [])

  const hasAccessFn = useCallback((path: string) => checkAccess(role, path), [role])

  return (
    <RBACContext.Provider value={{ role, setRole, hasAccess: hasAccessFn }}>
      {children}
    </RBACContext.Provider>
  )
}

export function useRBAC() {
  return useContext(RBACContext)
}
