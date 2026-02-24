'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type RuleType = 'Content Filter' | 'Rate Limit' | 'Injection Detection' | 'PII Detection' | 'Topic Boundary'
type ActionTaken = 'Blocked' | 'Warned' | 'Logged'

interface GuardrailRule {
  id: string
  name: string
  description: string
  type: RuleType
  enabled: boolean
  triggers7d: number
  appliesTo: string
}

interface TriggerEntry {
  time: string
  rule: string
  agent: string
  preview: string
  action: ActionTaken
  status: 'Resolved' | 'Active'
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const RULES: GuardrailRule[] = [
  {
    id: 'gr-1',
    name: 'Profanity & Toxic Content',
    description: 'Blocks outputs containing profanity, hate speech, or toxic language before delivery to users.',
    type: 'Content Filter',
    enabled: true,
    triggers7d: 4,
    appliesTo: 'All agents',
  },
  {
    id: 'gr-2',
    name: 'Prompt Injection Shield',
    description: 'Detects and neutralises prompt injection patterns in user-supplied inputs targeting agent behaviour.',
    type: 'Injection Detection',
    enabled: true,
    triggers7d: 2,
    appliesTo: 'Pulse, Dev, Aloa',
  },
  {
    id: 'gr-3',
    name: 'PII Scrubber',
    description: 'Automatically redacts personally identifiable information (email, phone, SSN) from agent outputs.',
    type: 'PII Detection',
    enabled: true,
    triggers7d: 5,
    appliesTo: 'All agents',
  },
  {
    id: 'gr-4',
    name: 'API Rate Limiter',
    description: 'Enforces max 60 API calls per minute per agent to prevent runaway loops and excessive spend.',
    type: 'Rate Limit',
    enabled: true,
    triggers7d: 1,
    appliesTo: 'All agents',
  },
  {
    id: 'gr-5',
    name: 'Off-Topic Boundary',
    description: 'Warns when agents respond to topics outside their defined scope (e.g. finance advice from a code agent).',
    type: 'Topic Boundary',
    enabled: true,
    triggers7d: 3,
    appliesTo: 'Scout, Atlas',
  },
  {
    id: 'gr-6',
    name: 'NSFW Content Filter',
    description: 'Prevents generation or relay of sexually explicit or graphic violent content in any context.',
    type: 'Content Filter',
    enabled: true,
    triggers7d: 0,
    appliesTo: 'All agents',
  },
  {
    id: 'gr-7',
    name: 'Credential Leak Detection',
    description: 'Scans agent outputs for API keys, tokens, and secrets and redacts them before logging or delivery.',
    type: 'PII Detection',
    enabled: false,
    triggers7d: 0,
    appliesTo: 'Dev, Forge',
  },
  {
    id: 'gr-8',
    name: 'Session Token Rate Cap',
    description: 'Halts sessions exceeding 200k tokens to prevent runaway context expansion and cost blowout.',
    type: 'Rate Limit',
    enabled: true,
    triggers7d: 1,
    appliesTo: 'All agents',
  },
]

const TRIGGER_LOG: TriggerEntry[] = [
  { time: '08:42 AM',  rule: 'PII Scrubber',            agent: 'Pulse',  preview: '"…contact me at john.smith@example.com for…"',          action: 'Blocked', status: 'Resolved' },
  { time: '06:17 AM',  rule: 'Prompt Injection Shield', agent: 'Dev',    preview: '"Ignore all previous instructions and instead…"',        action: 'Blocked', status: 'Resolved' },
  { time: '04:55 AM',  rule: 'Off-Topic Boundary',      agent: 'Scout',  preview: '"Based on current ETH prices, you should invest…"',      action: 'Warned',  status: 'Resolved' },
  { time: 'Yesterday', rule: 'PII Scrubber',            agent: 'Aloa',   preview: '"The customer\'s phone number is +61 412 555 8…"',        action: 'Blocked', status: 'Resolved' },
  { time: 'Yesterday', rule: 'API Rate Limiter',        agent: 'Atlas',  preview: 'Exceeded 60 req/min (peaked at 74 req/min)',              action: 'Warned',  status: 'Resolved' },
  { time: 'Yesterday', rule: 'Profanity Filter',        agent: 'Pulse',  preview: '"This is complete b***s***, the user just wants to…"',   action: 'Blocked', status: 'Resolved' },
  { time: '2 days ago',rule: 'Session Token Rate Cap',  agent: 'Dev',    preview: 'Session token count: 201,342 (limit: 200,000)',           action: 'Logged',  status: 'Resolved' },
  { time: '2 days ago',rule: 'Off-Topic Boundary',      agent: 'Atlas',  preview: '"I recommend seeing a doctor for that symptom…"',         action: 'Warned',  status: 'Resolved' },
]

const TYPE_BREAKDOWN = [
  { type: 'Content Filter',      count: 4,  color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)' },
  { type: 'Injection Detection', count: 2,  color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.25)'  },
  { type: 'PII Detection',       count: 5,  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  { type: 'Rate Limit',          count: 2,  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)'  },
  { type: 'Topic Boundary',      count: 3,  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

const RULE_TYPE_COLORS: Record<RuleType, { color: string; bg: string; border: string }> = {
  'Content Filter':      { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.28)' },
  'Rate Limit':          { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.28)'  },
  'Injection Detection': { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.28)'  },
  'PII Detection':       { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.28)'  },
  'Topic Boundary':      { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.28)' },
}

const ACTION_COLORS: Record<ActionTaken, { color: string; bg: string; border: string }> = {
  Blocked: { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.28)' },
  Warned:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.28)'  },
  Logged:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.28)'  },
}

function RuleTypeBadge({ type }: { type: RuleType }) {
  const cfg = RULE_TYPE_COLORS[type]
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 11, fontWeight: 700 }}
      className="px-2.5 py-0.5 rounded-full whitespace-nowrap"
    >
      {type}
    </span>
  )
}

function ActionBadge({ action }: { action: ActionTaken }) {
  const cfg = ACTION_COLORS[action]
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 11, fontWeight: 700 }}
      className="px-2.5 py-0.5 rounded-full whitespace-nowrap"
    >
      {action}
    </span>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={enabled ? 'Disable rule' : 'Enable rule'}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: enabled ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${enabled ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)'}`,
        position: 'relative',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2, left: enabled ? 20 : 2,
          width: 16, height: 16, borderRadius: 8,
          background: enabled ? '#34d399' : '#6b7280',
          transition: 'left 0.2s, background 0.2s',
        }}
      />
    </button>
  )
}

function NewRuleModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--cp-panel-bg)', border: '1px solid rgba(248,113,113,0.3)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base">New Guardrail Rule</div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>Define a new safety rule for your agents</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--cp-text-dim)' }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Rule Name</div>
            <input type="text" placeholder="e.g. PII Scrubber v2" style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }} />
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Rule Type</div>
            <select style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }}>
              <option>Content Filter</option>
              <option>Rate Limit</option>
              <option>Injection Detection</option>
              <option>PII Detection</option>
              <option>Topic Boundary</option>
            </select>
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Description</div>
            <textarea rows={2} placeholder="What does this rule do?" style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none', resize: 'none' }} />
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Applies To</div>
            <select style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }}>
              <option>All agents</option>
              <option>Pulse</option>
              <option>Dev</option>
              <option>Aloa</option>
              <option>Scout</option>
              <option>Atlas</option>
            </select>
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Action on Trigger</div>
            <div className="flex gap-2">
              {(['Blocked', 'Warned', 'Logged'] as ActionTaken[]).map(a => (
                <button
                  key={a}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: a === 'Blocked' ? ACTION_COLORS[a].bg : 'var(--cp-card-bg)',
                    border: a === 'Blocked' ? `1px solid ${ACTION_COLORS[a].border}` : '1px solid var(--cp-border-subtle)',
                    color: a === 'Blocked' ? ACTION_COLORS[a].color : 'var(--cp-text-dim)',
                    transition: 'all 0.15s',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid rgba(255,255,255,0.08)' }} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/[0.07] transition-all">Cancel</button>
          <button onClick={onClose} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }} className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-red-500/20">Create Rule</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function GuardrailsPage() {
  const [rules, setRules] = useState<GuardrailRule[]>(RULES)
  const [showModal, setShowModal] = useState(false)

  const activeCount = rules.filter(r => r.enabled).length

  const summaryCards = [
    {
      label: 'Active Rules',
      value: `${activeCount}`,
      color: '#a78bfa',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      label: 'Triggers Today',
      value: '3',
      color: '#fbbf24',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      label: 'Blocked Requests',
      value: '12',
      color: '#f87171',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      ),
    },
    {
      label: 'Safe Rate',
      value: '99.7%',
      color: '#34d399',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
  ]

  function handleToggle(id: string) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
            Guardrails
          </h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
            Safety rules and content filters for your agent network
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-all flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Rule
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {summaryCards.map(card => (
          <div
            key={card.label}
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: card.color, opacity: 0.75 }}>{card.icon}</span>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">{card.label}</div>
            </div>
            <div style={{ color: card.color }} className="text-2xl font-bold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Active Rules List */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">Active Rules</h2>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>{rules.length} rules configured</span>
          </div>

          {rules.map(rule => {
            const cfg = RULE_TYPE_COLORS[rule.type]
            return (
              <div
                key={rule.id}
                style={{
                  background: 'var(--cp-card-bg)',
                  border: `1px solid ${rule.enabled ? cfg.border : 'var(--cp-border)'}`,
                  backdropFilter: 'blur(12px)',
                  opacity: rule.enabled ? 1 : 0.55,
                  transition: 'all 0.2s',
                  borderRadius: 12,
                }}
                className="p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Shield icon */}
                  <div
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, width: 36, height: 36, minWidth: 36, borderRadius: 10 }}
                    className="flex items-center justify-center flex-shrink-0"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">{rule.name}</span>
                      <RuleTypeBadge type={rule.type} />
                      {!rule.enabled && (
                        <span style={{ color: 'var(--cp-text-dim)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700 }} className="px-2 py-0.5 rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12 }}>{rule.description}</div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                        Applies to: <span style={{ color: 'var(--cp-text-muted)' }} className="font-semibold">{rule.appliesTo}</span>
                      </span>
                      <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                        Triggers (7d): <span style={{ color: rule.triggers7d > 0 ? '#fbbf24' : 'var(--cp-text-muted)' }} className="font-semibold tabular-nums">{rule.triggers7d}</span>
                      </span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="flex-shrink-0 mt-0.5">
                    <Toggle enabled={rule.enabled} onToggle={() => handleToggle(rule.id)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Rule Type Breakdown sidebar */}
        <div className="xl:col-span-1">
          <div
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 12 }}
            className="sticky top-6"
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--cp-border)' }}>
              <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">Trigger Breakdown</h2>
              <p style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-0.5">By rule type · last 7 days</p>
            </div>
            <div className="p-4 space-y-3">
              {TYPE_BREAKDOWN.map(t => (
                <div
                  key={t.type}
                  style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10 }}
                  className="p-3 flex items-center justify-between"
                >
                  <div>
                    <div style={{ color: t.color, fontSize: 12 }} className="font-semibold">{t.type}</div>
                    <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-0.5">
                      {t.count} trigger{t.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div
                    style={{ color: t.color, background: `${t.bg}`, border: `1px solid ${t.border}`, fontSize: 18, fontWeight: 800, minWidth: 38, height: 38, borderRadius: 8 }}
                    className="flex items-center justify-center tabular-nums"
                  >
                    {t.count}
                  </div>
                </div>
              ))}

              {/* Total */}
              <div
                style={{ borderTop: '1px solid var(--cp-border)', paddingTop: 12, marginTop: 4 }}
                className="flex items-center justify-between"
              >
                <span style={{ color: 'var(--cp-text-secondary)', fontSize: 12 }} className="font-semibold">Total triggers</span>
                <span style={{ color: 'var(--cp-text-primary)', fontSize: 16, fontWeight: 800 }} className="tabular-nums">
                  {TYPE_BREAKDOWN.reduce((a, b) => a + b.count, 0)}
                </span>
              </div>
            </div>

            {/* Safety summary */}
            <div className="px-4 pb-4">
              <div
                style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10 }}
                className="p-3 flex items-center gap-3"
              >
                <div style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', width: 32, height: 32, borderRadius: 8 }} className="flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <div>
                  <div style={{ color: '#34d399' }} className="font-bold text-sm">System Safe</div>
                  <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>99.7% of requests passed all rules</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Log */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 12 }}
        className="overflow-hidden"
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--cp-border)' }}>
          <div>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">Recent Trigger Log</h2>
            <p style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-0.5">Guardrail events across all agents</p>
          </div>
          <span
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 11, fontWeight: 700 }}
            className="px-2.5 py-0.5 rounded-full"
          >
            {TRIGGER_LOG.length} events
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--cp-border)' }}>
                {['Time', 'Rule', 'Agent', 'Content Preview', 'Action Taken', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--cp-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRIGGER_LOG.map((entry, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: i < TRIGGER_LOG.length - 1 ? '1px solid var(--cp-border)' : 'none', borderLeft: `2px solid ${ACTION_COLORS[entry.action].color}` }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--cp-text-dim)', whiteSpace: 'nowrap' }}>{entry.time}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--cp-text-primary)', whiteSpace: 'nowrap' }}>{entry.rule}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#a78bfa', whiteSpace: 'nowrap' }}>{entry.agent}</td>
                  <td className="px-4 py-3 text-xs max-w-xs" style={{ color: 'var(--cp-text-secondary)' }}>
                    <span className="truncate block" title={entry.preview}>{entry.preview}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><ActionBadge action={entry.action} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      style={{
                        color: entry.status === 'Resolved' ? '#34d399' : '#fbbf24',
                        background: entry.status === 'Resolved' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                        border: `1px solid ${entry.status === 'Resolved' ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        fontSize: 11, fontWeight: 700,
                      }}
                      className="px-2.5 py-0.5 rounded-full"
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <NewRuleModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
