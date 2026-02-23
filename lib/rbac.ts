/**
 * RBAC - Role-Based Access Control for ClawPulse UI
 *
 * Roles (hierarchical):
 *   viewer   → read-only views (overview, agents, metrics, timeline, activity, sessions, compare, benchmarks, comms, knowledge)
 *   operator → viewer + tasks, workflows, playground, cron, alerts, errors, usage, mission, api-docs, audit
 *   admin    → operator + settings (full access)
 *
 * This is client-side UI gating only. It uses localStorage for role persistence
 * and can later be wired to real auth.
 */

export type Role = 'admin' | 'operator' | 'viewer'

export const ROLES: Role[] = ['admin', 'operator', 'viewer']

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
}

/**
 * Minimum role required per route prefix.
 * More specific prefixes should come first.
 * Routes not listed default to 'viewer'.
 */
const ROUTE_MIN_ROLE: Array<{ pattern: string; minRole: Role }> = [
  // admin-only
  { pattern: '/settings', minRole: 'admin' },
  // operator routes
  { pattern: '/tasks', minRole: 'operator' },
  { pattern: '/workflows', minRole: 'operator' },
  { pattern: '/playground', minRole: 'operator' },
  { pattern: '/cron', minRole: 'operator' },
  { pattern: '/alerts', minRole: 'operator' },
  { pattern: '/errors', minRole: 'operator' },
  { pattern: '/usage', minRole: 'operator' },
  { pattern: '/mission', minRole: 'operator' },
  { pattern: '/api-docs', minRole: 'operator' },
  { pattern: '/audit', minRole: 'operator' },
]

export function getMinRole(path: string): Role {
  for (const { pattern, minRole } of ROUTE_MIN_ROLE) {
    if (path === pattern || path.startsWith(pattern + '/')) {
      return minRole
    }
  }
  return 'viewer'
}

export function hasAccess(role: Role, path: string): boolean {
  const minRole = getMinRole(path)
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
}

/**
 * DEV-ONLY: localStorage-based role override.
 * Production roles come from the user_roles table in Supabase.
 * These helpers are kept for the dev role switcher (gated behind DEV_MODE + admin).
 */
const STORAGE_KEY = 'clawpulse-role-dev'

export function getStoredRole(): Role {
  if (typeof window === 'undefined') return 'viewer'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && ROLES.includes(stored as Role)) return stored as Role
  return 'viewer'
}

export function setStoredRole(role: Role): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, role)
}
