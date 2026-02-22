'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase-client'
import { useAuth } from '@/components/AuthProvider'

type Role = 'admin' | 'editor' | 'viewer'

interface UserRecord {
  id: string
  email: string
  last_sign_in_at: string | null
  created_at: string
  role: Role
}

// ── Role badge ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<Role, { color: string; bg: string; border: string }> = {
  admin:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  editor: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)' },
  viewer: { color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)' },
}

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CFG[role] ?? ROLE_CFG.viewer
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
    >
      {role}
    </span>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase()
  // Pick a hue based on the email string
  const hue = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      style={{
        background: `linear-gradient(135deg, hsl(${hue},55%,28%) 0%, hsl(${hue + 30},45%,18%) 100%)`,
        border: `1px solid hsl(${hue},55%,35%)`,
        flexShrink: 0,
      }}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white"
    >
      {initials}
    </div>
  )
}

// ── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    // Invite user via admin API
    const { data, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim())
    if (inviteErr) {
      setError(inviteErr.message)
      setLoading(false)
      return
    }

    // Set role
    if (data?.user?.id) {
      await supabase.from('user_roles').upsert({ user_id: data.user.id, role }, { onConflict: 'user_id' })
    }

    setLoading(false)
    onInvited()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #150228 0%, #0e0120 100%)',
          border: '1px solid rgba(109,40,217,0.35)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold">
              Invite User
            </h2>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
              Send a magic-link invitation email
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--cp-text-muted)' }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={{ color: 'var(--cp-text-secondary)' }} className="text-xs font-semibold block mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={{
                background: 'var(--cp-input-bg)',
                border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)',
              }}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-600 placeholder:text-gray-600"
            />
          </div>

          <div>
            <label style={{ color: 'var(--cp-text-secondary)' }} className="text-xs font-semibold block mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              style={{
                background: 'var(--cp-input-bg)',
                border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)',
              }}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="admin">Admin — Full access</option>
              <option value="editor">Editor — Can edit data</option>
              <option value="viewer">Viewer — Read only</option>
            </select>
          </div>

          {error && (
            <div
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
              className="text-xs px-3 py-2.5 rounded-lg"
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--cp-input-bg)',
                border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-secondary)',
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                background: loading ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                border: '1px solid rgba(139,92,246,0.4)',
                color: '#fff',
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRecord
  onClose: () => void
  onDeleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (delErr) {
      setError(delErr.message)
      setLoading(false)
      return
    }
    setLoading(false)
    onDeleted()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'linear-gradient(180deg, #150228 0%, #0e0120 100%)',
          border: '1px solid rgba(248,113,113,0.3)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </div>
          <div>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="font-bold">Remove User</h2>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm mb-4">
          Remove <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold">{user.email}</span> from ClawPulse? They will lose access immediately.
        </p>

        {error && (
          <div
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
            className="text-xs px-3 py-2.5 rounded-lg mb-3"
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            style={{
              background: 'var(--cp-input-bg)',
              border: '1px solid var(--cp-border-strong)',
              color: 'var(--cp-text-secondary)',
            }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            style={{
              background: loading ? 'rgba(248,113,113,0.3)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: '1px solid rgba(248,113,113,0.4)',
              color: '#fff',
            }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Removing…' : 'Remove User'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const [{ data: authData }, { data: rolesData }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      supabase.from('user_roles').select('*'),
    ])

    const roleMap: Record<string, Role> = {}
    for (const r of rolesData ?? []) roleMap[r.user_id] = r.role as Role

    const list: UserRecord[] = (authData?.users ?? []).map(u => ({
      id: u.id,
      email: u.email ?? '(no email)',
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
      role: roleMap[u.id] ?? 'viewer',
    }))

    // Sort: current user first, then alphabetically
    list.sort((a, b) => {
      if (a.id === currentUser?.id) return -1
      if (b.id === currentUser?.id) return 1
      return a.email.localeCompare(b.email)
    })

    setUsers(list)
    setLoading(false)
  }, [currentUser?.id])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setRoleUpdating(userId)
    await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setRoleUpdating(null)
  }

  function fmtDate(dateStr: string | null) {
    if (!dateStr) return 'Never'
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">
            Team Members
          </h2>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
            {users.length} {users.length === 1 ? 'user' : 'users'} with access to ClawPulse
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            border: '1px solid rgba(139,92,246,0.4)',
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite User
        </button>
      </div>

      {/* User list */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">Loading users…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">No users found</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              style={{
                background: 'var(--cp-table-header-bg)',
                borderBottom: '1px solid var(--cp-border-strong)',
              }}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3"
            >
              {['User', 'Role', 'Last sign in', ''].map((h, i) => (
                <div key={i} style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-bold uppercase tracking-wider">
                  {h}
                </div>
              ))}
            </div>

            {users.map((u, idx) => {
              const isCurrentUser = u.id === currentUser?.id
              return (
                <div
                  key={u.id}
                  style={{
                    borderBottom: idx < users.length - 1 ? '1px solid var(--cp-border)' : 'none',
                  }}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar email={u.email} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold truncate">
                          {u.email}
                        </span>
                        {isCurrentUser && (
                          <span
                            style={{ color: '#6d28d9', background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.2)' }}
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                          >
                            You
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
                        Joined {fmtDate(u.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value as Role)}
                      disabled={roleUpdating === u.id}
                      style={{
                        background: 'var(--cp-input-bg)',
                        border: '1px solid var(--cp-border-strong)',
                        color: ROLE_CFG[u.role]?.color ?? 'var(--cp-text-secondary)',
                      }}
                      className="text-xs font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {roleUpdating === u.id && (
                      <div className="w-3.5 h-3.5 border border-violet-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Last sign in */}
                  <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs whitespace-nowrap">
                    {fmtDate(u.last_sign_in_at)}
                  </div>

                  {/* Actions */}
                  <div>
                    <button
                      onClick={() => !isCurrentUser && setDeleteTarget(u)}
                      disabled={isCurrentUser}
                      title={isCurrentUser ? "Can't remove yourself" : 'Remove user'}
                      style={{ color: isCurrentUser ? 'var(--cp-text-dim)' : '#6b7280' }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div
        style={{
          background: 'rgba(109,40,217,0.04)',
          border: '1px solid var(--cp-border)',
        }}
        className="mt-4 rounded-xl p-4 grid grid-cols-3 gap-4"
      >
        {([
          { role: 'admin' as Role, desc: 'Full access — manage users, settings, all data' },
          { role: 'editor' as Role, desc: 'Can create/edit tasks, knowledge, missions' },
          { role: 'viewer' as Role, desc: 'Read-only access to all dashboards' },
        ]).map(({ role, desc }) => (
          <div key={role} className="space-y-1">
            <RoleBadge role={role} />
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Modals */}
      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onInvited={loadUsers} />
      )}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={loadUsers}
        />
      )}
    </div>
  )
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* Account section */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6"
      >
        <h3 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-4">
          Account
        </h3>
        <div className="flex items-center gap-4">
          {user && <Avatar email={user.email ?? ''} />}
          <div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">
              {user?.email}
            </div>
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
              Signed in via Supabase Auth · ID: {user?.id?.slice(0, 8)}…
            </div>
          </div>
        </div>
      </div>

      {/* Platform section */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6"
      >
        <h3 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-4">
          Platform
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Version', value: 'v3.3.0' },
            { label: 'Environment', value: 'Production' },
            { label: 'Hosting', value: 'Firebase · clawpulse.web.app' },
            { label: 'Database', value: 'Supabase (PostgreSQL)' },
            { label: 'Auth', value: 'Supabase Auth (email / magic link)' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{label}</span>
              <span style={{ color: 'var(--cp-text-secondary)' }} className="text-xs font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = document.documentElement.getAttribute('data-theme')
    if (stored === 'light') setTheme('light')
  }, [])

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t)
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('cp_theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('cp_theme', 'dark')
    }
  }

  return (
    <div className="space-y-6">
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6"
      >
        <h3 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-4">
          Theme
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'dark' as const, label: 'Dark', desc: 'Deep purple dark mode (default)', preview: '#0a0118' },
            { value: 'light' as const, label: 'Light', desc: 'Clean light mode', preview: '#f7f5fb' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => applyTheme(opt.value)}
              style={{
                background: theme === opt.value ? 'rgba(109,40,217,0.12)' : 'var(--cp-input-bg)',
                border: `1px solid ${theme === opt.value ? 'rgba(139,92,246,0.5)' : 'var(--cp-border-strong)'}`,
              }}
              className="rounded-xl p-4 text-left transition-all"
            >
              <div
                style={{ background: opt.preview, border: '1px solid rgba(255,255,255,0.08)' }}
                className="w-full h-12 rounded-lg mb-3"
              />
              <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">
                {opt.label}
              </div>
              <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
                {opt.desc}
              </div>
              {theme === opt.value && (
                <div
                  style={{ color: '#a78bfa' }}
                  className="text-xs font-bold mt-2 flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Active
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-6"
      >
        <h3 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-1">
          Design System
        </h3>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs mb-4">
          Current color tokens used across the dashboard
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Background', hex: '#0a0118' },
            { label: 'Primary accent', hex: '#7c3aed' },
            { label: 'Secondary accent', hex: '#22d3ee' },
            { label: 'Working status', hex: '#34d399' },
          ].map(({ label, hex }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div style={{ background: hex, border: '1px solid rgba(255,255,255,0.12)' }} className="w-5 h-5 rounded-md flex-shrink-0" />
              <div>
                <div style={{ color: 'var(--cp-text-secondary)' }} className="text-xs font-medium">{label}</div>
                <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-mono">{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab nav ───────────────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
] as const

type TabId = (typeof TABS)[number]['id']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general')

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            style={{
              background: 'rgba(109,40,217,0.12)',
              border: '1px solid rgba(109,40,217,0.25)',
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2m0 16v2M2 12h2m16 0h2" />
            </svg>
          </div>
          <h1 style={{ color: 'var(--cp-text-heading)' }} className="text-2xl font-bold tracking-tight">
            Settings
          </h1>
        </div>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">
          Manage your workspace, users, and preferences
        </p>
      </div>

      {/* Tab nav */}
      <div
        style={{
          background: 'var(--cp-card-bg)',
          border: '1px solid var(--cp-border-strong)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-2xl p-1.5 flex gap-1 mb-6 w-fit"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={
                isActive
                  ? {
                      background: 'rgba(109,40,217,0.2)',
                      color: '#c4b5fd',
                      border: '1px solid rgba(109,40,217,0.35)',
                    }
                  : {
                      background: 'transparent',
                      color: 'var(--cp-text-nav)',
                      border: '1px solid transparent',
                    }
              }
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'appearance' && <AppearanceTab />}
    </div>
  )
}
