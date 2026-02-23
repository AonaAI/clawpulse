'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { APP_NAME } from '@/lib/config'

const STORAGE_KEY = 'onboarding_complete'
const BUDGET_KEY = 'cp_monthly_budget'

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'features', title: 'Explore' },
  { id: 'budget', title: 'Budget' },
  { id: 'complete', title: 'Done' },
] as const

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
      </svg>
    ),
    title: 'Agents',
    desc: 'Monitor all your AI agents, their health, and activity in real time.',
    path: '/agents',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'Sessions',
    desc: 'Browse session history, durations, and tool usage patterns.',
    path: '/sessions',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    title: 'Errors',
    desc: 'Track and triage errors across all agents with full context.',
    path: '/errors',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
    title: 'Usage',
    desc: 'Track token consumption, costs, and set budget alerts.',
    path: '/usage',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Alerts',
    desc: 'Get notified when agents fail, budgets spike, or errors surge.',
    path: '/settings',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: 'Workflows',
    desc: 'Visualise agent workflows, task chains, and automations.',
    path: '/workflows',
  },
]

export function useOnboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        setShow(true)
      }
    } catch {}
  }, [])

  const restart = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setShow(true)
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    setShow(false)
  }, [])

  return { show, restart, dismiss }
}

export default function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [dontShow, setDontShow] = useState(true)
  const [budget, setBudget] = useState('')
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [animating, setAnimating] = useState(false)

  const goTo = (newStep: number) => {
    if (animating) return
    setDirection(newStep > step ? 'next' : 'prev')
    setAnimating(true)
    setTimeout(() => {
      setStep(newStep)
      setAnimating(false)
    }, 200)
  }

  const next = () => { if (step < STEPS.length - 1) goTo(step + 1) }
  const prev = () => { if (step > 0) goTo(step - 1) }

  const finish = () => {
    if (dontShow) {
      try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    }
    if (budget.trim()) {
      try { localStorage.setItem(BUDGET_KEY, budget.trim()) } catch {}
    }
    onClose()
  }

  const skip = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    onClose()
  }

  const slideStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${direction === 'next' ? '20px' : '-20px'})`
      : 'translateX(0)',
    transition: 'all 0.2s ease-out',
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--cp-panel-bg)',
          border: '1px solid rgba(109,40,217,0.35)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Progress bar */}
        <div style={{ background: 'rgba(109,40,217,0.08)' }} className="h-1">
          <div
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              transition: 'width 0.3s ease',
            }}
            className="h-full rounded-r-full"
          />
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8" style={slideStyle}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(109,40,217,0.05))',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-2xl font-bold mb-2">
                Welcome to {APP_NAME}
              </h2>
              <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                Your AI agent operations dashboard. Monitor agents, track sessions, catch errors, and manage costs — all in one place.
              </p>
              <button
                onClick={next}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: '1px solid rgba(139,92,246,0.4)',
                }}
                className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              >
                Get Started →
              </button>
            </div>
          )}

          {/* Step 1: Features */}
          {step === 1 && (
            <div>
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-xl font-bold mb-2">
                Explore Features
              </h2>
              <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-5">
                Here&apos;s what you can do with {APP_NAME}:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FEATURES.map(f => (
                  <div
                    key={f.title}
                    style={{
                      background: 'var(--cp-card-bg)',
                      border: '1px solid var(--cp-border-strong)',
                    }}
                    className="rounded-xl p-4 transition-all hover:border-violet-500/30"
                  >
                    <div className="mb-2">{f.icon}</div>
                    <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold mb-1">{f.title}</div>
                    <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs leading-relaxed">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <div>
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-xl font-bold mb-2">
                Set a Budget
              </h2>
              <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-5">
                Optionally set a monthly budget to track your AI spending. You can always change this later in Usage.
              </p>
              <div className="relative mb-4">
                <span
                  style={{ color: 'var(--cp-text-muted)' }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                >
                  $
                </span>
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="e.g. 500"
                  min="0"
                  step="1"
                  style={{
                    background: 'var(--cp-input-bg)',
                    border: '1px solid var(--cp-border-strong)',
                    color: 'var(--cp-text-primary)',
                  }}
                  className="w-full pl-7 pr-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-600 placeholder:text-gray-600"
                />
              </div>
              <div
                style={{
                  background: 'rgba(109,40,217,0.06)',
                  border: '1px solid var(--cp-border)',
                }}
                className="rounded-xl p-3 text-xs"
              >
                <p style={{ color: 'var(--cp-text-muted)' }}>
                  💡 You&apos;ll get alerts when spending approaches your budget limit. Skip this step if you prefer to set it up later.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div className="text-center">
              <div
                style={{
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.25)',
                }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="text-2xl font-bold mb-2">
                You&apos;re All Set!
              </h2>
              <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-6">
                Start exploring {APP_NAME} and take control of your agent operations.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6 max-w-xs mx-auto">
                {[
                  { label: 'View Agents', path: '/agents', emoji: '🤖' },
                  { label: 'Sessions', path: '/sessions', emoji: '📊' },
                  { label: 'Dashboard', path: '/', emoji: '🏠' },
                  { label: 'Settings', path: '/settings', emoji: '⚙️' },
                ].map(q => (
                  <button
                    key={q.path}
                    onClick={() => { finish(); router.push(q.path) }}
                    style={{
                      background: 'var(--cp-card-bg)',
                      border: '1px solid var(--cp-border-strong)',
                      color: 'var(--cp-text-secondary)',
                    }}
                    className="px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:border-violet-500/30"
                  >
                    {q.emoji} {q.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={e => setDontShow(e.target.checked)}
                  className="rounded accent-violet-600"
                />
                <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">
                  Don&apos;t show this again
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div
          style={{ borderTop: '1px solid var(--cp-border)' }}
          className="px-6 sm:px-8 py-4 flex items-center justify-between"
        >
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                style={{
                  background: i === step
                    ? '#7c3aed'
                    : i < step
                    ? 'rgba(124,58,237,0.4)'
                    : 'rgba(156,163,175,0.2)',
                }}
                className="w-2 h-2 rounded-full transition-all"
                title={s.title}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button
                onClick={skip}
                style={{ color: 'var(--cp-text-dim)' }}
                className="px-3 py-2 text-xs font-medium hover:text-violet-400 transition-colors"
              >
                Skip
              </button>
            )}
            {step > 0 && step < STEPS.length - 1 && (
              <button
                onClick={prev}
                style={{
                  background: 'var(--cp-input-bg)',
                  border: '1px solid var(--cp-border-strong)',
                  color: 'var(--cp-text-secondary)',
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              >
                Back
              </button>
            )}
            {step > 0 && step < STEPS.length - 1 && (
              <button
                onClick={next}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: '1px solid rgba(139,92,246,0.4)',
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              >
                Next →
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button
                onClick={finish}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: '1px solid rgba(139,92,246,0.4)',
                }}
                className="px-6 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
