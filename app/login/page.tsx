'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Set the persistence mode BEFORE signing in so the adaptive storage
    // in supabase-client.ts routes tokens to the right store.
    if (rememberMe) {
      sessionStorage.removeItem('cp_no_persist')
    } else {
      sessionStorage.setItem('cp_no_persist', '1')
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1a0533 0%, #11021d 40%, #0a0118 100%)',
      }}
    >
      {/* Background glow effects */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(100, 18, 166, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: '10%',
          right: '10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(45, 16, 84, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-sm">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-10">
          <div
            style={{
              background: 'linear-gradient(135deg, #6412A6 0%, #2d1054 100%)',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              boxShadow: '0 0 32px rgba(100, 18, 166, 0.45), 0 0 80px rgba(100, 18, 166, 0.15), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: '#f8f4ff' }}
          >
            ClawPulse
          </h1>
          <p
            className="text-sm mt-1.5 font-medium tracking-wide"
            style={{ color: '#7c3aed' }}
          >
            Agent Operations
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(109, 40, 217, 0.22)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          className="rounded-2xl px-7 py-8"
        >
          <h2
            className="text-base font-semibold mb-1"
            style={{ color: '#f8f4ff' }}
          >
            Sign in to your account
          </h2>
          <p className="text-xs mb-7" style={{ color: '#6b7280' }}>
            Protected workspace — authorized access only
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: '#9ca3af' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(109, 40, 217, 0.25)',
                  color: '#f8f4ff',
                  caretColor: '#8b5cf6',
                }}
                onFocus={e => {
                  e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(109, 40, 217, 0.12)'
                }}
                onBlur={e => {
                  e.currentTarget.style.border = '1px solid rgba(109, 40, 217, 0.25)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: '#9ca3af' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(109, 40, 217, 0.25)',
                  color: '#f8f4ff',
                  caretColor: '#8b5cf6',
                }}
                onFocus={e => {
                  e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(109, 40, 217, 0.12)'
                }}
                onBlur={e => {
                  e.currentTarget.style.border = '1px solid rgba(109, 40, 217, 0.25)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(v => !v)}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: rememberMe
                    ? '1.5px solid rgba(139, 92, 246, 0.8)'
                    : '1.5px solid rgba(109, 40, 217, 0.35)',
                  background: rememberMe
                    ? 'linear-gradient(135deg, #6412A6 0%, #4c1d95 100%)'
                    : 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  boxShadow: rememberMe ? '0 0 8px rgba(100,18,166,0.35)' : 'none',
                }}
              >
                {rememberMe && (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: '#9ca3af' }}
                onClick={() => setRememberMe(v => !v)}
              >
                Remember me
              </span>
            </label>

            {/* Error */}
            {error && (
              <div
                className="rounded-xl px-4 py-3 text-xs font-medium"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{
                background: loading
                  ? 'rgba(100, 18, 166, 0.4)'
                  : 'linear-gradient(135deg, #6412A6 0%, #4c1d95 100%)',
                color: loading ? 'rgba(248,244,255,0.5)' : '#f8f4ff',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(100, 18, 166, 0.35)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(100, 18, 166, 0.55)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(100, 18, 166, 0.35)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#4b5563' }}>
          ClawPulse — Agent Operations Platform
        </p>
      </div>
    </div>
  )
}
