'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Types ──────────────────────────────────────────────────────────────────

type AlertType = 'agent_offline' | 'error_rate' | 'token_budget' | 'session_duration' | 'agent_idle' | 'cost_budget'
type Severity = 'info' | 'warning' | 'critical'

interface AlertRule {
  id: string
  name: string
  type: AlertType
  threshold: number
  severity: Severity
  targetAgent: string
  targetAgentName: string
  enabled: boolean
  createdAt: string
  lastTriggered?: string
  budgetScope?: 'global' | 'per_agent'
  alertAt80?: boolean
  alertAt100?: boolean
}

interface AlertHistoryEntry {
  id: string
  agent_name: string
  action: string
  details: string
  created_at: string
  severity: Severity
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cp_alert_rules'

const ALERT_TYPE_CONFIG: Record<AlertType, {
  label: string
  description: (threshold: number) => string
  unit: string
  defaultThreshold: number
}> = {
  agent_offline:    { label: 'Agent Offline',        description: (t) => `Agent offline for more than ${t} minutes`,              unit: 'minutes', defaultThreshold: 15     },
  error_rate:       { label: 'Error Rate',            description: (t) => `Error rate exceeds ${t}%`,                              unit: '%',       defaultThreshold: 10     },
  token_budget:     { label: 'Token Budget',          description: (t) => `Token usage exceeds ${t.toLocaleString()} tokens`,      unit: 'tokens',  defaultThreshold: 100000 },
  session_duration: { label: 'Session Duration',      description: (t) => `Session duration anomaly: exceeds ${t} minutes`,        unit: 'minutes', defaultThreshold: 120    },
  agent_idle:       { label: 'Agent Idle Too Long',   description: (t) => `Agent idle for more than ${t} minutes`,                 unit: 'minutes', defaultThreshold: 30     },
  cost_budget:      { label: 'Cost Budget',           description: (t) => `Monthly spend alert: budget $${t} (warns at 80% & 100%)`, unit: '$',     defaultThreshold: 500    },
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', label: 'Critical' },
  warning:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  label: 'Warning'  },
  info:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.3)',  label: 'Info'     },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const DEFAULT_BUDGET_RULES: AlertRule[] = [
  {
    id: 'default-budget-80',
    name: '80% Budget Warning',
    type: 'cost_budget',
    threshold: 3000,
    severity: 'warning',
    targetAgent: 'all',
    targetAgentName: 'All agents',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    budgetScope: 'global',
    alertAt80: true,
    alertAt100: false,
  },
  {
    id: 'default-budget-100',
    name: '100% Budget Exceeded',
    type: 'cost_budget',
    threshold: 3000,
    severity: 'critical',
    targetAgent: 'all',
    targetAgentName: 'All agents',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    budgetScope: 'global',
    alertAt80: false,
    alertAt100: true,
  },
]

function loadRules(): AlertRule[] {
  if (typeof window === 'undefined') return DEFAULT_BUDGET_RULES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BUDGET_RULES
    const saved: AlertRule[] = JSON.parse(raw)
    // If saved rules don't include budget defaults, prepend them
    const hasDefaults = saved.some(r => r.id === 'default-budget-80' || r.id === 'default-budget-100')
    if (!hasDefaults) return [...DEFAULT_BUDGET_RULES, ...saved]
    return saved
  }
  catch { return DEFAULT_BUDGET_RULES }
}

function saveRules(rules: AlertRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

// ── Alert Type Icon ────────────────────────────────────────────────────────

function AlertTypeIcon({ type }: { type: AlertType }) {
  if (type === 'agent_offline') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <line x1="17" y1="17" x2="23" y2="17" />
    </svg>
  )
  if (type === 'error_rate') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
  if (type === 'token_budget') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
  if (type === 'session_duration') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
  if (type === 'cost_budget') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

// ── Severity Badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity]
  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize whitespace-nowrap"
    >
      {cfg.label}
    </span>
  )
}

// ── Alert Rule Card ────────────────────────────────────────────────────────

function AlertRuleCard({ rule, onToggle, onDelete }: {
  rule: AlertRule
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const cfg = SEVERITY_CONFIG[rule.severity]
  const typeCfg = ALERT_TYPE_CONFIG[rule.type]

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: `1px solid ${rule.enabled ? cfg.border : 'var(--cp-border)'}`,
        backdropFilter: 'blur(12px)',
        opacity: rule.enabled ? 1 : 0.6,
        transition: 'all 0.2s',
      }}
      className="rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, width: 34, height: 34, minWidth: 34 }}
          className="rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        >
          <AlertTypeIcon type={rule.type} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">{rule.name}</span>
            <SeverityBadge severity={rule.severity} />
            {!rule.enabled && (
              <span style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
              >
                Disabled
              </span>
            )}
          </div>
          <div style={{ color: 'var(--cp-text-secondary)', fontSize: 13 }}>{typeCfg.description(rule.threshold)}</div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
              Agent: <span style={{ color: 'var(--cp-text-muted)' }} className="font-semibold">
                {rule.targetAgent === 'all' ? 'All agents' : rule.targetAgentName}
              </span>
            </span>
            {rule.lastTriggered ? (
              <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                Last triggered: <span style={{ color: '#fbbf24' }} className="font-semibold">{formatTs(rule.lastTriggered)}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>Never triggered</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle */}
          <button
            onClick={() => onToggle(rule.id)}
            style={{
              width: 38, height: 22, borderRadius: 11,
              background: rule.enabled ? 'rgba(52,211,153,0.2)' : 'var(--cp-border-subtle)',
              border: `1px solid ${rule.enabled ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.1)'}`,
              position: 'relative',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            title={rule.enabled ? 'Disable alert' : 'Enable alert'}
          >
            <span
              style={{
                position: 'absolute',
                top: 2, left: rule.enabled ? 18 : 2,
                width: 16, height: 16, borderRadius: 8,
                background: rule.enabled ? '#34d399' : '#6b7280',
                transition: 'left 0.2s, background 0.2s',
              }}
            />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(rule.id)}
            style={{ color: 'var(--cp-text-dim)', width: 28, height: 28 }}
            className="flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete rule"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'inherit' }}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Alert Modal ─────────────────────────────────────────────────────

function CreateAlertModal({ agents, onClose, onCreate }: {
  agents: { id: string; name: string }[]
  onClose: () => void
  onCreate: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => void
}) {
  const [alertType, setAlertType] = useState<AlertType>('agent_offline')
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState<number>(ALERT_TYPE_CONFIG['agent_offline'].defaultThreshold)
  const [severity, setSeverity] = useState<Severity>('warning')
  const [targetAgent, setTargetAgent] = useState('all')
  const [budgetScope, setBudgetScope] = useState<'global' | 'per_agent'>('global')
  const [alertAt80, setAlertAt80] = useState(true)
  const [alertAt100, setAlertAt100] = useState(true)

  const handleTypeChange = (t: AlertType) => {
    setAlertType(t)
    setThreshold(ALERT_TYPE_CONFIG[t].defaultThreshold)
    if (t === 'cost_budget') setSeverity('warning')
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    const agent = agents.find(a => a.id === targetAgent)
    const rule: Omit<AlertRule, 'id' | 'createdAt'> = {
      name: name.trim(),
      type: alertType,
      threshold,
      severity,
      targetAgent,
      targetAgentName: agent?.name || 'All agents',
      enabled: true,
    }
    if (alertType === 'cost_budget') {
      rule.budgetScope = budgetScope
      rule.alertAt80 = alertAt80
      rule.alertAt100 = alertAt100
    }
    onCreate(rule)
    onClose()
  }

  const typeCfg = ALERT_TYPE_CONFIG[alertType]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'var(--cp-overlay)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--cp-panel-bg)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 16,
          width: '100%', maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(109,40,217,0.15)', background: 'rgba(21,2,40,0.98)' }} className="px-6 py-4 flex items-center justify-between sticky top-0">
          <div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base">Create Alert Rule</div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>Set up a new monitoring rule</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--cp-text-dim)' }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Alert type */}
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Alert Type
            </div>
            <div className="space-y-2">
              {(Object.keys(ALERT_TYPE_CONFIG) as AlertType[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  style={{
                    width: '100%',
                    background: alertType === t ? 'rgba(124,58,237,0.18)' : 'var(--cp-card-bg)',
                    border: alertType === t ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--cp-border-subtle)',
                    borderRadius: 8, padding: '10px 12px', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ color: alertType === t ? '#c4b5fd' : 'var(--cp-text-primary)', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                    {ALERT_TYPE_CONFIG[t].label}
                  </div>
                  <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
                    {ALERT_TYPE_CONFIG[t].description(ALERT_TYPE_CONFIG[t].defaultThreshold)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Rule Name
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`e.g. ${typeCfg.label} Alert`}
              style={{
                background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px',
                fontSize: 13, width: '100%', outline: 'none', display: 'block',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--cp-border-strong)')}
            />
          </div>

          {/* Threshold */}
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Threshold ({typeCfg.unit})
            </div>
            <input
              type="number"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              min={1}
              style={{
                background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px',
                fontSize: 13, width: '100%', outline: 'none', display: 'block',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--cp-border-strong)')}
            />
          </div>

          {/* Severity */}
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Severity
            </div>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as Severity[]).map(s => {
                const cfg = SEVERITY_CONFIG[s]
                const active = severity === s
                return (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: active ? cfg.bg : 'var(--cp-card-bg)',
                      border: active ? `1px solid ${cfg.border}` : '1px solid var(--cp-border-subtle)',
                      color: active ? cfg.color : 'var(--cp-text-dim)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target agent */}
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Target Agent
            </div>
            <select
              value={targetAgent}
              onChange={e => setTargetAgent(e.target.value)}
              style={{
                background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)',
                color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px',
                fontSize: 13, width: '100%', outline: 'none', display: 'block',
              }}
            >
              <option value="all">All agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Cost Budget specific options */}
          {alertType === 'cost_budget' && (
            <>
              <div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Budget Scope
                </div>
                <div className="flex gap-2">
                  {(['global', 'per_agent'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setBudgetScope(scope)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: budgetScope === scope ? 'rgba(124,58,237,0.18)' : 'var(--cp-card-bg)',
                        border: budgetScope === scope ? '1px solid rgba(139,92,246,0.4)' : '1px solid var(--cp-border-subtle)',
                        color: budgetScope === scope ? '#c4b5fd' : 'var(--cp-text-dim)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {scope === 'global' ? '🌐 Global' : '🤖 Per Agent'}
                    </button>
                  ))}
                </div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginTop: 6 }}>
                  {budgetScope === 'global'
                    ? `Global monthly budget: $${threshold}/month`
                    : `Per-agent budget: $${threshold}/agent/month`}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Alert Thresholds
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'alertAt80', label: '⚠️ Alert at 80%', desc: `Warn at $${(threshold * 0.8).toFixed(0)}`, value: alertAt80, set: setAlertAt80 },
                    { key: 'alertAt100', label: '🚨 Alert at 100%', desc: `Critical at $${threshold}`, value: alertAt100, set: setAlertAt100 },
                  ].map(item => (
                    <div
                      key={item.key}
                      onClick={() => item.set(!item.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: item.value ? 'rgba(124,58,237,0.08)' : 'var(--cp-card-bg)',
                        border: item.value ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--cp-border-subtle)',
                        borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        background: item.value ? '#7c3aed' : 'var(--cp-input-bg)',
                        border: item.value ? '1px solid #a78bfa' : '1px solid var(--cp-border-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.value && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ color: item.value ? '#c4b5fd' : 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                        <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--cp-divider-accent)' }} className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/[0.07] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{
              background: name.trim() ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(139,92,246,0.4)',
              color: name.trim() ? '#c4b5fd' : '#6b7280',
            }}
            className="px-5 py-2 rounded-lg text-sm font-semibold disabled:cursor-not-allowed transition-all"
          >
            Create Rule
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [showModal, setShowModal] = useState(false)
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Load rules from localStorage on client
  useEffect(() => { setRules(loadRules()) }, [])

  // Load agents from Supabase
  useEffect(() => {
    supabase.from('agents').select('id, name').order('name').then(({ data }) => {
      if (data) setAgents(data)
    })
  }, [])

  // Load alert history from activity_log (error/warning patterns)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, agent_id, action, details, created_at, agent:agents(name)')
      .or('action.ilike.%error%,action.ilike.%fail%,action.ilike.%crash%,action.ilike.%warning%,action.ilike.%offline%,action.ilike.%timeout%')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      setHistory(data.map(item => {
        const agentRow = item.agent as unknown as { name: string } | null
        const text = ((item.action || '') + ' ' + (item.details || '')).toLowerCase()
        let severity: Severity = 'info'
        if (text.includes('crash') || text.includes('critical')) severity = 'critical'
        else if (text.includes('error') || text.includes('fail') || text.includes('timeout')) severity = 'warning'
        return {
          id: item.id,
          agent_name: agentRow?.name || item.agent_id,
          action: item.action,
          details: item.details || '',
          created_at: item.created_at,
          severity,
        }
      }))
    }
    setHistoryLoading(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // CRUD
  const handleCreate = (rule: Omit<AlertRule, 'id' | 'createdAt'>) => {
    const newRule: AlertRule = { ...rule, id: genId(), createdAt: new Date().toISOString() }
    const updated = [...rules, newRule]
    setRules(updated)
    saveRules(updated)
  }

  const handleToggle = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    saveRules(updated)
  }

  const handleDelete = (id: string) => {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    saveRules(updated)
  }

  // Summary stats
  const totalRules = rules.length
  const activeRules = rules.filter(r => r.enabled).length
  const criticalRules = rules.filter(r => r.severity === 'critical').length
  const today = new Date().toISOString().slice(0, 10)
  const triggeredToday = history.filter(h => h.created_at.startsWith(today)).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
            Alerts
          </h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
            Smart alerting rules for agent monitoring
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(139,92,246,0.4)',
            color: 'var(--cp-text-accent-light)',
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-500/25 transition-all flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Rule
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Rules', value: totalRules.toString(), color: 'var(--cp-text-accent-light)',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            ),
          },
          {
            label: 'Active Rules', value: activeRules.toString(), color: '#34d399',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ),
          },
          {
            label: 'Triggered Today', value: historyLoading ? '…' : triggeredToday.toString(), color: '#fbbf24',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ),
          },
          {
            label: 'Critical Alerts', value: criticalRules.toString(), color: '#f87171',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ),
          },
        ].map(card => (
          <div
            key={card.label}
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: card.color, opacity: 0.7 }}>{card.icon}</span>
              <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">{card.label}</div>
            </div>
            <div style={{ color: card.color }} className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Alert Rules Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">Alert Rules</h2>
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        </div>

        {rules.length === 0 ? (
          <div
            style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
            className="rounded-xl p-12 text-center"
          >
            <div className="flex justify-center mb-4">
              <div
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.2)', width: 56, height: 56, borderRadius: 14 }}
                className="flex items-center justify-center"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
            </div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold mb-2">No alert rules yet</div>
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs max-w-xs mx-auto mb-5">
              Create rules to get notified when agents go offline, error rates spike, or token budgets are exceeded.
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(139,92,246,0.35)', color: 'var(--cp-text-accent-light)' }}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-500/25 transition-all"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <AlertRuleCard key={rule.id} rule={rule} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Alert History Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">Alert History</h2>
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>Recent events from activity log</span>
        </div>

        {historyLoading ? (
          <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)' }} className="rounded-xl p-8 text-center">
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm">Loading alert history…</div>
          </div>
        ) : history.length === 0 ? (
          <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className="rounded-xl p-8 text-center">
            <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold mb-1">No alert events found</div>
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">No error or warning activity in the log.</div>
          </div>
        ) : (
          <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className="rounded-xl overflow-hidden">
            {history.map((entry, idx) => {
              const cfg = SEVERITY_CONFIG[entry.severity]
              return (
                <div
                  key={entry.id}
                  style={{
                    borderBottom: idx < history.length - 1 ? '1px solid var(--cp-input-bg)' : 'none',
                    borderLeft: `2px solid ${cfg.color}`,
                  }}
                  className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: cfg.color, marginTop: 5, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{entry.agent_name}</span>
                      <SeverityBadge severity={entry.severity} />
                      <span style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginLeft: 'auto' }} className="font-mono whitespace-nowrap">
                        {formatTs(entry.created_at)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12, marginTop: 2 }} className="truncate">
                      {entry.action}{entry.details ? `: ${entry.details.slice(0, 100)}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showModal && (
        <CreateAlertModal
          agents={agents}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
