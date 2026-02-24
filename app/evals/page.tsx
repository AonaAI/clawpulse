'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentEval {
  agent: string
  color: string
  overallScore: number
  taskCompletion: number
  responseQuality: number
  toolEfficiency: number
  errorRate: number
  trend: '↑' | '↓' | '→'
  lastEval: string
}

interface EvalRun {
  sessionId: string
  agent: string
  score: number
  duration: string
  status: 'Passed' | 'Failed'
  time: string
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const AGENT_EVALS: AgentEval[] = [
  { agent: 'Pulse',  color: '#a78bfa', overallScore: 94, taskCompletion: 97, responseQuality: 95, toolEfficiency: 92, errorRate: 1.2, trend: '↑', lastEval: '2h ago' },
  { agent: 'Dev',    color: '#22d3ee', overallScore: 88, taskCompletion: 91, responseQuality: 87, toolEfficiency: 89, errorRate: 3.4, trend: '↑', lastEval: '3h ago' },
  { agent: 'Aloa',   color: '#34d399', overallScore: 91, taskCompletion: 93, responseQuality: 92, toolEfficiency: 88, errorRate: 2.1, trend: '→', lastEval: '5h ago' },
  { agent: 'Scout',  color: '#fbbf24', overallScore: 76, taskCompletion: 78, responseQuality: 74, toolEfficiency: 77, errorRate: 8.6, trend: '↓', lastEval: '6h ago' },
  { agent: 'Atlas',  color: '#f472b6', overallScore: 82, taskCompletion: 85, responseQuality: 80, toolEfficiency: 83, errorRate: 5.3, trend: '↑', lastEval: '8h ago' },
  { agent: 'Forge',  color: '#fb923c', overallScore: 79, taskCompletion: 81, responseQuality: 78, toolEfficiency: 80, errorRate: 6.8, trend: '→', lastEval: '10h ago' },
  { agent: 'Nexus',  color: '#818cf8', overallScore: 85, taskCompletion: 87, responseQuality: 86, toolEfficiency: 82, errorRate: 4.1, trend: '↑', lastEval: '12h ago' },
  { agent: 'Echo',   color: '#e879f9', overallScore: 71, taskCompletion: 73, responseQuality: 70, toolEfficiency: 72, errorRate: 11.2, trend: '↓', lastEval: '14h ago' },
  { agent: 'Sigma',  color: '#4ade80', overallScore: 89, taskCompletion: 90, responseQuality: 91, toolEfficiency: 86, errorRate: 2.9, trend: '↑', lastEval: '18h ago' },
]

const EVAL_RUNS: EvalRun[] = [
  { sessionId: 'eval-9f3a2',  agent: 'Pulse',  score: 96, duration: '4m 12s', status: 'Passed', time: '14 min ago' },
  { sessionId: 'eval-7d8c1',  agent: 'Dev',    score: 87, duration: '3m 44s', status: 'Passed', time: '1h 02m ago' },
  { sessionId: 'eval-2b5e9',  agent: 'Scout',  score: 61, duration: '5m 18s', status: 'Failed', time: '2h 15m ago' },
  { sessionId: 'eval-4a1f7',  agent: 'Aloa',   score: 92, duration: '3m 57s', status: 'Passed', time: '3h 30m ago' },
  { sessionId: 'eval-8c6d3',  agent: 'Atlas',  score: 83, duration: '4m 05s', status: 'Passed', time: '5h 41m ago' },
  { sessionId: 'eval-1e9b4',  agent: 'Echo',   score: 58, duration: '6m 22s', status: 'Failed', time: '8h 17m ago' },
  { sessionId: 'eval-6h2k8',  agent: 'Nexus',  score: 85, duration: '4m 33s', status: 'Passed', time: '11h 05m ago' },
  { sessionId: 'eval-3m7p5',  agent: 'Sigma',  score: 91, duration: '3m 48s', status: 'Passed', time: '16h 22m ago' },
  { sessionId: 'eval-5j4n1',  agent: 'Forge',  score: 74, duration: '5m 01s', status: 'Passed', time: '21h 44m ago' },
  { sessionId: 'eval-0q9r6',  agent: 'Scout',  score: 63, duration: '4m 57s', status: 'Failed', time: '38h 10m ago' },
]

const DIMENSIONS = [
  { label: 'Task Completion',   avg: 86.1, color: '#a78bfa' },
  { label: 'Response Quality',  avg: 83.7, color: '#22d3ee' },
  { label: 'Tool Efficiency',   avg: 83.2, color: '#34d399' },
  { label: 'Error Rate (inv.)', avg: 80.4, color: '#fbbf24' },
  { label: 'Overall Score',     avg: 87.3, color: '#f472b6' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'
  const bg    = score >= 85 ? 'rgba(52,211,153,0.12)' : score >= 70 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)'
  const border= score >= 85 ? 'rgba(52,211,153,0.35)' : score >= 70 ? 'rgba(251,191,36,0.35)' : 'rgba(248,113,113,0.35)'
  return (
    <span
      style={{ color, background: bg, border: `1px solid ${border}`, fontSize: 12, fontWeight: 700 }}
      className="px-2.5 py-0.5 rounded-full tabular-nums"
    >
      {score}
    </span>
  )
}

function TrendBadge({ trend }: { trend: '↑' | '↓' | '→' }) {
  const color = trend === '↑' ? '#34d399' : trend === '↓' ? '#f87171' : '#94a3b8'
  return <span style={{ color, fontSize: 15, fontWeight: 700 }}>{trend}</span>
}

function StatusBadge({ status }: { status: 'Passed' | 'Failed' }) {
  return (
    <span
      style={{
        color: status === 'Passed' ? '#34d399' : '#f87171',
        background: status === 'Passed' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
        border: `1px solid ${status === 'Passed' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
        fontSize: 11, fontWeight: 700,
      }}
      className="px-2.5 py-0.5 rounded-full"
    >
      {status}
    </span>
  )
}

function NewEvalModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--cp-panel-bg)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base">New Evaluation</div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 12 }}>Configure and run a new eval session</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--cp-text-dim)' }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Target Agent</div>
            <select style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }}>
              <option>All agents</option>
              {AGENT_EVALS.map(a => <option key={a.agent}>{a.agent}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Eval Suite</div>
            <select style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }}>
              <option>Full Quality Suite</option>
              <option>Task Completion Only</option>
              <option>Tool Usage Benchmark</option>
              <option>Response Coherence</option>
            </select>
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Pass Threshold</div>
            <input type="number" defaultValue={75} min={0} max={100} style={{ background: 'var(--cp-code-bg)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid rgba(255,255,255,0.08)' }} className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/[0.07] transition-all">Cancel</button>
          <button
            onClick={onClose}
            style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-purple-500/30"
          >
            Run Eval
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EvalsPage() {
  const [showModal, setShowModal] = useState(false)

  const summaryCards = [
    {
      label: 'Avg Quality Score',
      value: '87.3',
      sub: '/ 100',
      color: '#a78bfa',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
    },
    {
      label: 'Evals This Week',
      value: '142',
      sub: 'runs',
      color: '#22d3ee',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      label: 'Passing Rate',
      value: '94.2%',
      sub: '',
      color: '#34d399',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    {
      label: 'Agents Evaluated',
      value: '9',
      sub: 'active',
      color: '#f472b6',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
            Evaluations
          </h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">
            Quality scoring across your agent network
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: 'var(--cp-text-accent-light)' }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-500/25 transition-all flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Eval
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
            <div className="flex items-baseline gap-1.5">
              <span style={{ color: card.color }} className="text-2xl font-bold tabular-nums">{card.value}</span>
              {card.sub && <span style={{ color: 'var(--cp-text-dim)' }} className="text-sm">{card.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Quality Scores Table */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl mb-6 overflow-hidden"
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--cp-border)' }}>
          <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">Quality Scores by Agent</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--cp-border)' }}>
                {['Agent', 'Overall Score', 'Task Completion', 'Response Quality', 'Tool Efficiency', 'Error Rate', 'Trend', 'Last Eval'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--cp-text-secondary)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENT_EVALS.map((row, i) => (
                <tr
                  key={row.agent}
                  style={{ borderBottom: i < AGENT_EVALS.length - 1 ? '1px solid var(--cp-border)' : 'none' }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: row.color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ color: row.color }} className="font-semibold">{row.agent}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ScoreBadge score={row.overallScore} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${row.taskCompletion}%`, height: '100%', borderRadius: 2, background: '#a78bfa' }} />
                      </div>
                      <span style={{ color: 'var(--cp-text-primary)', fontSize: 12 }} className="tabular-nums">{row.taskCompletion}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${row.responseQuality}%`, height: '100%', borderRadius: 2, background: '#22d3ee' }} />
                      </div>
                      <span style={{ color: 'var(--cp-text-primary)', fontSize: 12 }} className="tabular-nums">{row.responseQuality}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, maxWidth: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${row.toolEfficiency}%`, height: '100%', borderRadius: 2, background: '#34d399' }} />
                      </div>
                      <span style={{ color: 'var(--cp-text-primary)', fontSize: 12 }} className="tabular-nums">{row.toolEfficiency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span style={{ color: row.errorRate > 7 ? '#f87171' : row.errorRate > 4 ? '#fbbf24' : '#34d399', fontSize: 12 }} className="font-medium tabular-nums">
                      {row.errorRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3"><TrendBadge trend={row.trend} /></td>
                  <td className="px-4 py-3">
                    <span style={{ color: 'var(--cp-text-dim)', fontSize: 12 }} className="font-mono">{row.lastEval}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom grid: Recent Runs + Dimension Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Eval Runs */}
        <div
          className="xl:col-span-3"
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 12 }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--cp-border)' }}>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">Recent Eval Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--cp-border)' }}>
                  {['Session ID', 'Agent', 'Score', 'Duration', 'Status', 'Time'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--cp-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVAL_RUNS.map((run, i) => {
                  const agentColor = AGENT_EVALS.find(a => a.agent === run.agent)?.color ?? '#94a3b8'
                  return (
                    <tr
                      key={run.sessionId}
                      style={{ borderBottom: i < EVAL_RUNS.length - 1 ? '1px solid var(--cp-border)' : 'none' }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--cp-text-dim)' }}>{run.sessionId}</td>
                      <td className="px-4 py-2.5 font-semibold text-xs" style={{ color: agentColor }}>{run.agent}</td>
                      <td className="px-4 py-2.5"><ScoreBadge score={run.score} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--cp-text-secondary)' }}>{run.duration}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--cp-text-dim)' }}>{run.time}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dimension Breakdown */}
        <div
          className="xl:col-span-2"
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 12 }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--cp-border)' }}>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-bold">Dimension Breakdown</h2>
            <p style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="mt-0.5">Avg scores across all agents</p>
          </div>
          <div className="px-5 py-5 space-y-5">
            {DIMENSIONS.map(dim => (
              <div key={dim.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ color: 'var(--cp-text-secondary)', fontSize: 12 }} className="font-medium">{dim.label}</span>
                  <span style={{ color: dim.color, fontSize: 12 }} className="font-bold tabular-nums">{dim.avg}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)' }} className="relative overflow-hidden">
                  <div
                    style={{
                      width: `${dim.avg}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: `linear-gradient(90deg, ${dim.color}90 0%, ${dim.color} 100%)`,
                      boxShadow: `0 0 8px ${dim.color}60`,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Mini legend */}
            <div style={{ borderTop: '1px solid var(--cp-border)', paddingTop: 16, marginTop: 8 }}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="font-semibold uppercase tracking-wider mb-3">Score Key</div>
              <div className="space-y-2">
                {[
                  { label: 'Excellent', range: '≥ 85', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
                  { label: 'Good',      range: '70–84', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
                  { label: 'Needs Work',range: '< 70',  color: '#f87171', bg: 'rgba(248,113,113,0.1)',border: 'rgba(248,113,113,0.25)' },
                ].map(k => (
                  <div key={k.label} className="flex items-center justify-between">
                    <span
                      style={{ color: k.color, background: k.bg, border: `1px solid ${k.border}`, fontSize: 11, fontWeight: 700 }}
                      className="px-2 py-0.5 rounded-full"
                    >
                      {k.label}
                    </span>
                    <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }} className="font-mono">{k.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && <NewEvalModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
