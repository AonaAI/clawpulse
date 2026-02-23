'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fetchSessionWithMetadata, fetchSessionTrace } from '@/lib/supabase-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionDetail {
  id: string
  agent_id: string
  agent_name: string
  session_key: string
  kind: string
  status: string
  started_at: string
  last_active: string | null
  model: string | null
  token_count: number
  duration_minutes: number | null
  cost_usd: number
  metadata: Record<string, unknown> | null
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  name?: string
  input?: unknown
  output?: unknown
  tokens?: number
  timestamp?: string
}

interface TraceEvent {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return '—'
  if (minutes === 0) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatDeltaMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Extract conversation messages from metadata JSONB
function extractMessages(metadata: Record<string, unknown> | null): ConversationMessage[] {
  if (!metadata) return []
  const candidates = ['messages', 'conversation', 'history', 'transcript']
  for (const key of candidates) {
    const val = metadata[key]
    if (Array.isArray(val) && val.length > 0) {
      return val as ConversationMessage[]
    }
  }
  return []
}

function extractSystemPrompt(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  const candidates = ['system_prompt', 'system', 'systemPrompt', 'instructions']
  for (const key of candidates) {
    const val = metadata[key]
    if (typeof val === 'string' && val.trim()) return val
  }
  return null
}

// ── Role badge config ──────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  user: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', label: 'User' },
  assistant: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', label: 'Assistant' },
  system: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', label: 'System' },
  tool: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', label: 'Tool' },
} as const

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Active' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

// ── ToolCallBlock ──────────────────────────────────────────────────────────────

function ToolCallBlock({ msg }: { msg: ConversationMessage }) {
  const [expanded, setExpanded] = useState(false)
  const hasInput = msg.input !== undefined && msg.input !== null
  const hasOutput = msg.output !== undefined && msg.output !== null

  return (
    <div
      style={{
        background: 'rgba(251,191,36,0.04)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 8,
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', padding: '2px 7px', borderRadius: 5 }}>
          Tool
        </span>
        <span style={{ color: '#e2c97e', fontSize: 13, fontWeight: 600 }}>{msg.name || 'Unknown Tool'}</span>
        {msg.tokens !== undefined && (
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginLeft: 'auto' }}>{msg.tokens} tokens</span>
        )}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--cp-text-dim)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(251,191,36,0.15)', background: 'rgba(0,0,0,0.2)' }} className="px-3 py-2 space-y-2">
          {hasInput && (
            <div>
              <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Input</div>
              <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, color: '#d4b483', overflow: 'auto', maxHeight: 240, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {typeof msg.input === 'string' ? msg.input : JSON.stringify(msg.input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Output</div>
              <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, color: '#d4b483', overflow: 'auto', maxHeight: 240, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────────────

function MessageBubble({ msg, totalMs, prevTimestamp }: {
  msg: ConversationMessage
  totalMs: number
  prevTimestamp: string | null
}) {
  const role = (msg.role || 'assistant') as keyof typeof ROLE_CONFIG
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.assistant

  const isUser = role === 'user'
  const isTool = role === 'tool'
  const isSystem = role === 'system'

  const deltaMs = prevTimestamp && msg.timestamp
    ? new Date(msg.timestamp).getTime() - new Date(prevTimestamp).getTime()
    : 0
  const barPct = totalMs > 0 && deltaMs > 0 ? Math.max(2, Math.min(100, (deltaMs / totalMs) * 100)) : 0

  const content = typeof msg.content === 'string'
    ? msg.content
    : msg.content != null
    ? JSON.stringify(msg.content, null, 2)
    : null

  if (isTool) {
    return (
      <div className="flex items-start gap-3">
        <div style={{ width: 28, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {msg.timestamp && (
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="mb-1 font-mono">{formatTime(msg.timestamp)}</div>
          )}
          <ToolCallBlock msg={msg} />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, width: 28, height: 28, minWidth: 28, fontSize: 10, fontWeight: 700, flexShrink: 0 }}
        className="rounded-lg flex items-center justify-center"
      >
        {isUser ? 'U' : isSystem ? 'S' : 'AI'}
      </div>

      {/* Bubble */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: isUser ? '75%' : '85%' }}>
        {/* Header row */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5 }}>
            {cfg.label}
          </span>
          {msg.timestamp && (
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="font-mono">{formatTime(msg.timestamp)}</span>
          )}
          {msg.tokens !== undefined && (
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }}>{msg.tokens} tok</span>
          )}
        </div>

        {/* Content */}
        {content && (
          <div
            style={{
              background: isUser ? 'rgba(52,211,153,0.07)' : isSystem ? 'rgba(167,139,250,0.06)' : 'var(--cp-card-bg)',
              border: `1px solid ${isUser ? 'rgba(52,211,153,0.18)' : isSystem ? 'rgba(167,139,250,0.18)' : 'var(--cp-border)'}`,
              borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
              padding: '10px 14px',
            }}
          >
            {isSystem ? (
              <pre style={{ color: 'var(--cp-text-secondary)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {content}
              </pre>
            ) : (
              <p style={{ color: 'var(--cp-text-secondary)', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {content}
              </p>
            )}
          </div>
        )}

        {/* Timing bar */}
        {barPct > 0 && (
          <div className={`mt-1.5 ${isUser ? 'flex justify-end' : ''}`}>
            <div style={{ width: `${barPct}%`, height: 2, background: `linear-gradient(90deg, ${cfg.color}40, ${cfg.color}90)`, borderRadius: 2, minWidth: 8, maxWidth: 200 }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── TraceEventItem ─────────────────────────────────────────────────────────────

function TraceEventItem({ event, prevTimestamp }: { event: TraceEvent; prevTimestamp: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = !!(event.details || Object.keys(event.metadata).length > 0)
  const deltaMs = prevTimestamp
    ? new Date(event.created_at).getTime() - new Date(prevTimestamp).getTime()
    : 0

  return (
    <div className="flex items-start gap-2">
      <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, width: 68, textAlign: 'right', paddingTop: 8, flexShrink: 0 }} className="font-mono">
        {formatTime(event.created_at)}
      </div>
      <div style={{ width: 2, alignSelf: 'stretch', background: 'rgba(109,40,217,0.15)', borderRadius: 2, flexShrink: 0, minHeight: 40 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={() => hasDetails && setExpanded(e => !e)}
          style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(109,40,217,0.1)', borderRadius: 8, cursor: hasDetails ? 'pointer' : 'default' }}
          className={hasDetails ? 'hover:bg-white/[0.025] transition-colors' : ''}
        >
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              {deltaMs > 0 && (
                <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="font-mono">+{formatDeltaMs(deltaMs)}</span>
              )}
              {hasDetails && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-dim)', marginLeft: 'auto', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </div>
            <div style={{ color: 'var(--cp-text-secondary)', fontSize: 12.5, fontWeight: 500, marginTop: 2 }}>{event.action}</div>
          </div>
          {expanded && hasDetails && (
            <div style={{ borderTop: '1px solid rgba(109,40,217,0.12)', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 7px 7px' }} className="px-3 py-2 space-y-2">
              {event.details && (
                <p style={{ color: 'var(--cp-text-secondary)', fontSize: 12, lineHeight: 1.6 }} className="whitespace-pre-wrap">{event.details}</p>
              )}
              {Object.keys(event.metadata).length > 0 && (
                <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#94a3b8', overflow: 'auto', maxHeight: 180 }}>
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PromptInspectorSidebar ─────────────────────────────────────────────────────

function PromptInspectorSidebar({
  systemPrompt,
  open,
  onToggle,
}: {
  systemPrompt: string | null
  open: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{
        width: open ? 320 : 40,
        flexShrink: 0,
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={open ? 'Close prompt inspector' : 'Open prompt inspector'}
        style={{
          position: 'absolute',
          top: 12,
          left: open ? 8 : 6,
          zIndex: 10,
          background: 'rgba(109,40,217,0.15)',
          border: '1px solid rgba(139,92,246,0.25)',
          color: '#a78bfa',
          width: 28,
          height: 28,
          borderRadius: 8,
        }}
        className="flex items-center justify-center hover:bg-purple-500/20 transition-colors flex-shrink-0"
      >
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Panel content */}
      {open && (
        <div
          style={{
            background: 'var(--cp-card-bg)',
            border: '1px solid var(--cp-border)',
            borderRadius: 12,
            minHeight: 400,
            paddingTop: 48,
          }}
        >
          <div className="px-4 pb-4 flex flex-col">
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Prompt Inspector
            </div>
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 4 }}>
              System Prompt
            </div>
            {systemPrompt ? (
              <pre style={{
                color: '#c4b5fd',
                fontSize: 11.5,
                lineHeight: 1.75,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(109,40,217,0.06)',
                border: '1px solid rgba(109,40,217,0.15)',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: 'monospace',
                maxHeight: 600,
                overflow: 'auto',
              }}>
                {systemPrompt}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: 12, fontWeight: 600 }}>No system prompt</div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                  Not found in session metadata
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Client Component ──────────────────────────────────────────────────────

export default function SessionDetailClient({ id: propId }: { id: string }) {
  // For static export with Firebase rewrites, useParams may return __placeholder__.
  // Extract the real session ID from the URL path instead.
  const params = useParams()
  const paramsId = params?.id as string
  const [urlId, setUrlId] = useState(paramsId || propId)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const segments = window.location.pathname.split('/')
      const last = segments[segments.length - 1]
      if (last && last !== '__placeholder__') setUrlId(last)
    }
  }, [])
  const id = urlId === '__placeholder__' ? '' : urlId

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'conversation' | 'trace'>('conversation')

  useEffect(() => {
    if (!id) return // Wait for URL extraction to resolve
    setLoading(true)
    setNotFound(false)
    Promise.all([
      fetchSessionWithMetadata(id),
      fetchSessionTrace(id),
    ]).then(([sess, traceData]) => {
      if (!sess) { setNotFound(true); setLoading(false); return }
      setSession(sess)
      setTrace(traceData)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="skeleton-shimmer mb-6" style={{ width: 120, height: 24, borderRadius: 6 }} />
      <div className="skeleton-shimmer mb-8" style={{ height: 110, borderRadius: 12 }} />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
            <div className="skeleton-shimmer" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
            <div className="skeleton-shimmer" style={{ width: i % 2 === 0 ? '55%' : '70%', height: 72, borderRadius: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )

  if (notFound) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/sessions"
        style={{ color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        className="mb-6 hover:text-purple-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Sessions
      </Link>
      <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', marginTop: 16 }}>
        <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600 }}>Session not found</div>
        <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, marginTop: 6 }}>
          ID: <code style={{ color: '#a78bfa' }}>{id}</code>
        </div>
      </div>
    </div>
  )

  if (!session) return null

  const messages = extractMessages(session.metadata)
  const systemPrompt = extractSystemPrompt(session.metadata)
  const statusCfg = STATUS_CONFIG[session.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: session.status }

  const msgTimestamps = messages.map(m => m.timestamp).filter(Boolean) as string[]
  const msgTotalMs = msgTimestamps.length >= 2
    ? new Date(msgTimestamps[msgTimestamps.length - 1]).getTime() - new Date(msgTimestamps[0]).getTime()
    : 0

  const userMsgCount = messages.filter(m => m.role === 'user').length
  const assistantMsgCount = messages.filter(m => m.role === 'assistant').length
  const toolCallCount = messages.filter(m => m.role === 'tool').length

  const msgSummary = messages.length > 0
    ? `${messages.length} (${userMsgCount}↑ ${assistantMsgCount}↓${toolCallCount > 0 ? ` ${toolCallCount}⚙` : ''})`
    : trace.length > 0 ? `${trace.length} events` : '—'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/sessions"
        style={{ color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        className="mb-5 hover:text-purple-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Sessions
      </Link>

      {/* Session metadata header */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 14 }}
        className="mb-6 px-5 py-4"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div
              style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', width: 40, height: 40, fontSize: 13, fontWeight: 700 }}
              className="rounded-xl flex items-center justify-center flex-shrink-0"
            >
              {getInitials(session.agent_name)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: 'var(--cp-text-primary)', fontSize: 16, fontWeight: 700 }}>{session.agent_name}</span>
                <span
                  style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, color: statusCfg.color }}
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                >
                  {statusCfg.label}
                </span>
              </div>
              <code style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', padding: '1px 8px', borderRadius: 5, display: 'inline-block', marginTop: 2 }}>
                {session.session_key}
              </code>
            </div>
          </div>
          {session.model && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 8, padding: '4px 12px' }}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Model</div>
              <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600 }}>{session.model}</div>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Started', value: formatFullDate(session.started_at) },
            { label: 'Duration', value: formatDuration(session.duration_minutes) },
            { label: 'Total Tokens', value: formatTokens(session.token_count) },
            { label: 'Messages', value: msgSummary },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{stat.label}</div>
              <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5">
        {(['conversation', 'trace'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'rgba(124,58,237,0.18)' : 'transparent',
              border: `1px solid ${activeTab === tab ? 'rgba(139,92,246,0.35)' : 'transparent'}`,
              color: activeTab === tab ? '#c4b5fd' : 'var(--cp-text-muted)',
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'conversation' ? 'Conversation' : 'Trace Events'}
            {tab === 'trace' && trace.length > 0 && (
              <span style={{ marginLeft: 6, background: 'rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 99 }}>
                {trace.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex gap-4 items-start">
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'conversation' ? (
            messages.length === 0 ? (
              <div
                style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
                className="px-6 py-16 text-center"
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No conversation data available</div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
                  Conversation messages are stored in the <code style={{ background: 'rgba(109,40,217,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>metadata</code> field of agent sessions when agents support conversation logging.
                </div>
                {trace.length > 0 && (
                  <button
                    onClick={() => setActiveTab('trace')}
                    style={{ marginTop: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd', padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    View {trace.length} trace events instead
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
                className="px-4 sm:px-6 py-5 space-y-5"
              >
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 8, borderBottom: '1px solid var(--cp-divider)' }}>
                  Conversation · {messages.length} message{messages.length !== 1 ? 's' : ''}
                </div>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    msg={msg}
                    totalMs={msgTotalMs}
                    prevTimestamp={idx > 0 ? (messages[idx - 1].timestamp ?? null) : null}
                  />
                ))}
              </div>
            )
          ) : (
            trace.length === 0 ? (
              <div
                style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
                className="px-6 py-16 text-center"
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <circle cx="12" cy="6" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="18" r="2" />
                </svg>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600 }}>No trace events</div>
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                  Trace events are logged when agents link activity to this session via <code style={{ background: 'rgba(109,40,217,0.1)', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>session_id</code>.
                </div>
              </div>
            ) : (
              <div
                style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
                className="px-4 sm:px-5 py-5"
              >
                <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Trace · {trace.length} event{trace.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-3">
                  {trace.map((event, idx) => (
                    <TraceEventItem
                      key={event.id}
                      event={event}
                      prevTimestamp={idx > 0 ? trace[idx - 1].created_at : null}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Prompt inspector sidebar — desktop only */}
        <div className="hidden lg:block">
          <PromptInspectorSidebar
            systemPrompt={systemPrompt}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
          />
        </div>
      </div>
    </div>
  )
}
