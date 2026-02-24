'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fetchSessionWithMetadata } from '@/lib/supabase-client'

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
  thinking?: string
  name?: string
  input?: unknown
  output?: unknown
  tokens?: number
  timestamp?: string
}

type MessageFilter = 'all' | 'user' | 'assistant' | 'system' | 'tool'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
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

// Copy to clipboard helper
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy:', err)
    return false
  }
}

// Export conversation
function exportConversation(messages: ConversationMessage[], format: 'json' | 'text', sessionKey: string) {
  let content: string
  let filename: string
  let mimeType: string

  if (format === 'json') {
    content = JSON.stringify(messages, null, 2)
    filename = `session-${sessionKey}-replay.json`
    mimeType = 'application/json'
  } else {
    content = messages.map((msg, idx) => {
      const header = `[${idx + 1}] ${msg.role.toUpperCase()}${msg.timestamp ? ` @ ${formatTime(msg.timestamp)}` : ''}${msg.tokens ? ` (${msg.tokens} tokens)` : ''}`
      const separator = '─'.repeat(60)
      let body = ''
      
      if (msg.role === 'tool') {
        body += `Tool: ${msg.name || 'Unknown'}\n`
        if (msg.input) body += `Input: ${typeof msg.input === 'string' ? msg.input : JSON.stringify(msg.input, null, 2)}\n`
        if (msg.output) body += `Output: ${typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output, null, 2)}\n`
      } else {
        if (msg.thinking) body += `[Thinking]\n${msg.thinking}\n\n`
        if (msg.content) body += msg.content
      }
      
      return `${header}\n${separator}\n${body}\n\n`
    }).join('')
    filename = `session-${sessionKey}-replay.txt`
    mimeType = 'text/plain'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Role badge config ──────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  user: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', label: 'User' },
  assistant: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', label: 'Assistant' },
  system: { color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', label: 'System' },
  tool: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', label: 'Tool' },
} as const

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Active' },
  completed: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.25)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Failed' },
}

// ── ToolCallBlock ──────────────────────────────────────────────────────────────

function ToolCallBlock({ msg, index }: { msg: ConversationMessage; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasInput = msg.input !== undefined && msg.input !== null
  const hasOutput = msg.output !== undefined && msg.output !== null

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const content = `Tool: ${msg.name || 'Unknown'}\nInput: ${typeof msg.input === 'string' ? msg.input : JSON.stringify(msg.input, null, 2)}\nOutput: ${typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output, null, 2)}`
    const success = await copyToClipboard(content)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
        <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontFamily: 'monospace', opacity: 0.6, minWidth: 24 }}>
          #{index + 1}
        </span>
        <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', padding: '2px 7px', borderRadius: 5 }}>
          Tool
        </span>
        <span style={{ color: '#e2c97e', fontSize: 13, fontWeight: 600 }}>{msg.name || 'Unknown Tool'}</span>
        {msg.tokens !== undefined && (
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginLeft: 'auto' }}>{msg.tokens} tokens</span>
        )}
        <button
          onClick={handleCopy}
          title="Copy tool call"
          style={{ color: copied ? '#34d399' : 'var(--cp-text-dim)', marginLeft: 4 }}
          className="hover:text-purple-400 transition-colors p-1"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--cp-text-dim)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(251,191,36,0.15)', background: 'var(--cp-code-bg)' }} className="px-3 py-2 space-y-2">
          {hasInput && (
            <div>
              <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Input</div>
              <pre style={{ background: 'var(--cp-code-bg)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, color: '#d4b483', overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {typeof msg.input === 'string' ? msg.input : JSON.stringify(msg.input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <div style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Output</div>
              <pre style={{ background: 'var(--cp-code-bg)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, color: '#d4b483', overflow: 'auto', maxHeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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

function MessageBubble({ msg, totalMs, prevTimestamp, index }: {
  msg: ConversationMessage
  totalMs: number
  prevTimestamp: string | null
  index: number
}) {
  const [copied, setCopied] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
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

  const handleCopy = async () => {
    const text = msg.thinking ? `[Thinking]\n${msg.thinking}\n\n${content || ''}` : (content || '')
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isTool) {
    return (
      <div className="flex items-start gap-3">
        <div style={{ width: 28, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {msg.timestamp && (
            <div style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="mb-1 font-mono">{formatTime(msg.timestamp)}</div>
          )}
          <ToolCallBlock msg={msg} index={index} />
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
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontFamily: 'monospace', opacity: 0.6 }}>
            #{index + 1}
          </span>
          <span style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5 }}>
            {cfg.label}
          </span>
          {msg.timestamp && (
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }} className="font-mono">{formatTime(msg.timestamp)}</span>
          )}
          {msg.tokens !== undefined && (
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 10 }}>{msg.tokens} tok</span>
          )}
          <button
            onClick={handleCopy}
            title="Copy message"
            style={{ color: copied ? '#34d399' : 'var(--cp-text-dim)', marginLeft: isUser ? 'unset' : 'auto', marginRight: isUser ? 'auto' : 'unset' }}
            className="hover:text-purple-400 transition-colors p-1"
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* Thinking (if available) */}
        {msg.thinking && (
          <div className="mb-2">
            <button
              onClick={() => setShowThinking(!showThinking)}
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}
              className="hover:bg-purple-500/15 transition-colors flex items-center gap-1.5"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showThinking ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Thinking
            </button>
            {showThinking && (
              <pre style={{ marginTop: 6, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--cp-text-accent-light)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' }}>
                {msg.thinking}
              </pre>
            )}
          </div>
        )}

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

// ── Main Client Component ──────────────────────────────────────────────────────

export default function SessionReplayClient({ id: propId }: { id: string }) {
  const params = useParams()
  const paramsId = params?.id as string
  const [urlId, setUrlId] = useState(paramsId || propId)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const segments = window.location.pathname.split('/')
      const idIdx = segments.findIndex(s => s === 'sessions')
      if (idIdx !== -1 && segments[idIdx + 1] && segments[idIdx + 1] !== '__placeholder__') {
        setUrlId(segments[idIdx + 1])
      }
    }
  }, [])
  
  const id = urlId === '__placeholder__' ? '' : urlId

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [filter, setFilter] = useState<MessageFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    fetchSessionWithMetadata(id).then(sess => {
      if (!sess) { setNotFound(true); setLoading(false); return }
      setSession(sess)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="skeleton-shimmer mb-6" style={{ width: 180, height: 24, borderRadius: 6 }} />
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
        style={{ color: 'var(--cp-text-accent-light)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        className="mb-6 hover:text-purple-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Sessions
      </Link>
      <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', marginTop: 16 }}>
        <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600 }}>Session not found</div>
        <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, marginTop: 6 }}>
          ID: <code style={{ color: 'var(--cp-text-accent-light)' }}>{id}</code>
        </div>
      </div>
    </div>
  )

  if (!session) return null

  const allMessages = extractMessages(session.metadata)
  const statusCfg = STATUS_CONFIG[session.status] ?? { color: 'var(--cp-text-secondary)', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: session.status }

  // Filter messages
  let messages = allMessages
  if (filter !== 'all') {
    messages = messages.filter(m => m.role === filter)
  }

  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    messages = messages.filter(m => {
      const content = typeof m.content === 'string' ? m.content.toLowerCase() : JSON.stringify(m.content).toLowerCase()
      const thinking = m.thinking ? m.thinking.toLowerCase() : ''
      const toolName = m.name ? m.name.toLowerCase() : ''
      return content.includes(query) || thinking.includes(query) || toolName.includes(query)
    })
  }

  const msgTimestamps = allMessages.map(m => m.timestamp).filter(Boolean) as string[]
  const msgTotalMs = msgTimestamps.length >= 2
    ? new Date(msgTimestamps[msgTimestamps.length - 1]).getTime() - new Date(msgTimestamps[0]).getTime()
    : 0

  const userMsgCount = allMessages.filter(m => m.role === 'user').length
  const assistantMsgCount = allMessages.filter(m => m.role === 'assistant').length
  const toolCallCount = allMessages.filter(m => m.role === 'tool').length
  const systemMsgCount = allMessages.filter(m => m.role === 'system').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5" style={{ color: 'var(--cp-text-dim)', fontSize: 13 }}>
        <Link href="/sessions" className="hover:text-purple-400 transition-colors">Sessions</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link href={`/sessions/${id}`} className="hover:text-purple-400 transition-colors">{session.session_key}</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ color: 'var(--cp-text-accent-light)', fontWeight: 600 }}>Replay</span>
      </div>

      {/* Session metadata header */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)', borderRadius: 14 }}
        className="mb-6 px-5 py-4"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div
              style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)', width: 40, height: 40, fontSize: 13, fontWeight: 700 }}
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
              <code style={{ fontSize: 11, color: 'var(--cp-text-accent-light)', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', padding: '1px 8px', borderRadius: 5, display: 'inline-block', marginTop: 2 }}>
                {session.session_key}
              </code>
            </div>
          </div>
          {session.model && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 8, padding: '4px 12px' }}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Model</div>
              <div style={{ color: 'var(--cp-text-accent-light)', fontSize: 12, fontWeight: 600 }}>{session.model}</div>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Started', value: formatFullDate(session.started_at) },
            { label: 'Duration', value: formatDuration(session.duration_minutes) },
            { label: 'Total Tokens', value: formatTokens(session.token_count) },
            { label: 'Messages', value: `${allMessages.length}` },
            { label: 'Breakdown', value: `${userMsgCount}↑ ${assistantMsgCount}↓ ${toolCallCount}⚙${systemMsgCount > 0 ? ` ${systemMsgCount}⚡` : ''}` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-subtle)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{stat.label}</div>
              <div style={{ color: 'var(--cp-text-primary)', fontSize: 13, fontWeight: 600 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 12 }}
        className="mb-6 px-4 py-3 flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-0" style={{ minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cp-text-dim)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversation..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--cp-text-primary)', fontSize: 13, flex: 1, minWidth: 0 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ color: 'var(--cp-text-dim)' }} className="hover:text-purple-400 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter */}
        <div style={{ borderLeft: '1px solid var(--cp-border)', paddingLeft: 12, marginLeft: 8 }} className="flex items-center gap-2 flex-wrap">
          <span style={{ color: 'var(--cp-text-dim)', fontSize: 11, fontWeight: 600 }}>Filter:</span>
          {(['all', 'user', 'assistant', 'tool', 'system'] as MessageFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(124,58,237,0.18)' : 'transparent',
                border: `1px solid ${filter === f ? 'rgba(139,92,246,0.35)' : 'var(--cp-border-subtle)'}`,
                color: filter === f ? '#c4b5fd' : 'var(--cp-text-muted)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: filter === f ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              className="hover:border-purple-500/40"
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span style={{ marginLeft: 4, opacity: 0.6 }}>
                  ({f === 'user' ? userMsgCount : f === 'assistant' ? assistantMsgCount : f === 'tool' ? toolCallCount : systemMsgCount})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Export */}
        <div style={{ borderLeft: '1px solid var(--cp-border)', paddingLeft: 12, marginLeft: 8 }} className="flex items-center gap-2">
          <button
            onClick={() => exportConversation(allMessages, 'json', session.session_key)}
            title="Export as JSON"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}
            className="hover:bg-purple-500/20 transition-colors flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            JSON
          </button>
          <button
            onClick={() => exportConversation(allMessages, 'text', session.session_key)}
            title="Export as Text"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}
            className="hover:bg-purple-500/20 transition-colors flex items-center gap-1.5"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Text
          </button>
        </div>
      </div>

      {/* Conversation */}
      {allMessages.length === 0 ? (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
          className="px-6 py-16 text-center"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No conversation data available</div>
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
            Conversation messages are stored in the <code style={{ background: 'rgba(109,40,217,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>metadata</code> field when agents support logging.
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
          className="px-6 py-16 text-center"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.3)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No messages match your filter</div>
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, lineHeight: 1.6 }}>
            Try adjusting your search or filter settings.
          </div>
          <button
            onClick={() => { setFilter('all'); setSearchQuery('') }}
            style={{ marginTop: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--cp-text-accent-light)', padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', borderRadius: 14 }}
          className="px-4 sm:px-6 py-5 space-y-5"
        >
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 8, borderBottom: '1px solid var(--cp-divider)' }}>
            Session Replay{filter !== 'all' && <span style={{ color: 'var(--cp-text-accent-light)' }}> · {filter} messages</span>}
            {searchQuery && <span style={{ color: 'var(--cp-text-accent-light)' }}> · search: "{searchQuery}"</span>}
            {' · '}{messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              msg={msg}
              totalMs={msgTotalMs}
              prevTimestamp={idx > 0 ? (messages[idx - 1].timestamp ?? null) : null}
              index={allMessages.indexOf(msg)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
