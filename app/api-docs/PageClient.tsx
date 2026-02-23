'use client'

import { useState, useEffect, useCallback, memo } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  exampleRequest?: string
  exampleResponse: string
}

interface TableDoc {
  name: string
  description: string
  endpoints: Endpoint[]
}

interface Webhook {
  id: string
  url: string
  events: string[]
  status: 'active' | 'paused'
  lastTriggered: string | null
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

const EVENT_TYPES = [
  { id: 'agent_status_change', label: 'Agent Status Change', description: 'When an agent goes online/offline' },
  { id: 'session_completed', label: 'Session Completed', description: 'When an agent session ends' },
  { id: 'error_detected', label: 'Error Detected', description: 'When an error is logged' },
  { id: 'task_completed', label: 'Task Completed', description: 'When a task is marked done' },
  { id: 'budget_exceeded', label: 'Budget Exceeded', description: 'When usage exceeds budget threshold' },
]

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
}

function buildTableDocs(): TableDoc[] {
  const base = `${SUPABASE_URL}/rest/v1`
  return [
    {
      name: 'agents',
      description: 'AI agents registered in the system',
      endpoints: [
        {
          method: 'GET', path: `${base}/agents?select=*`,
          description: 'List all agents',
          exampleResponse: JSON.stringify([{ id: 'uuid', name: 'agent-1', status: 'online', model: 'claude-sonnet-4-20250514', created_at: '2025-01-01T00:00:00Z' }], null, 2),
        },
        {
          method: 'POST', path: `${base}/agents`,
          description: 'Create a new agent',
          exampleRequest: JSON.stringify({ name: 'my-agent', status: 'offline', model: 'claude-sonnet-4-20250514' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', name: 'my-agent', status: 'offline' }, null, 2),
        },
        {
          method: 'PATCH', path: `${base}/agents?id=eq.{id}`,
          description: 'Update an agent',
          exampleRequest: JSON.stringify({ status: 'online' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', status: 'online' }, null, 2),
        },
        {
          method: 'DELETE', path: `${base}/agents?id=eq.{id}`,
          description: 'Delete an agent',
          exampleResponse: '204 No Content',
        },
      ],
    },
    {
      name: 'agent_sessions',
      description: 'Session records for agent runs',
      endpoints: [
        {
          method: 'GET', path: `${base}/agent_sessions?select=*&order=created_at.desc`,
          description: 'List sessions (newest first)',
          exampleResponse: JSON.stringify([{ id: 'uuid', agent_id: 'uuid', status: 'completed', tokens_used: 5000, cost_usd: 0.02, created_at: '2025-01-01T00:00:00Z' }], null, 2),
        },
        {
          method: 'GET', path: `${base}/agent_sessions?agent_id=eq.{agent_id}`,
          description: 'List sessions for a specific agent',
          exampleResponse: JSON.stringify([{ id: 'uuid', agent_id: 'uuid', status: 'running' }], null, 2),
        },
      ],
    },
    {
      name: 'activity_log',
      description: 'Event log for all agent activity',
      endpoints: [
        {
          method: 'GET', path: `${base}/activity_log?select=*&order=created_at.desc&limit=50`,
          description: 'Get recent activity',
          exampleResponse: JSON.stringify([{ id: 'uuid', agent_id: 'uuid', action: 'task_completed', details: 'Deployed v2.1', created_at: '2025-01-01T00:00:00Z' }], null, 2),
        },
        {
          method: 'POST', path: `${base}/activity_log`,
          description: 'Log a new activity entry',
          exampleRequest: JSON.stringify({ agent_id: 'uuid', action: 'custom_event', details: 'Something happened' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', action: 'custom_event' }, null, 2),
        },
      ],
    },
    {
      name: 'projects',
      description: 'Projects that agents work on',
      endpoints: [
        {
          method: 'GET', path: `${base}/projects?select=*`,
          description: 'List all projects',
          exampleResponse: JSON.stringify([{ id: 'uuid', name: 'ClawPulse', description: 'Agent ops dashboard', created_at: '2025-01-01T00:00:00Z' }], null, 2),
        },
      ],
    },
    {
      name: 'tasks',
      description: 'Tasks assigned to agents',
      endpoints: [
        {
          method: 'GET', path: `${base}/tasks?select=*&order=created_at.desc`,
          description: 'List all tasks',
          exampleResponse: JSON.stringify([{ id: 'uuid', title: 'Fix login bug', status: 'in_progress', agent_id: 'uuid', priority: 'high' }], null, 2),
        },
        {
          method: 'POST', path: `${base}/tasks`,
          description: 'Create a new task',
          exampleRequest: JSON.stringify({ title: 'Deploy v3', status: 'pending', priority: 'high' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', title: 'Deploy v3', status: 'pending' }, null, 2),
        },
        {
          method: 'PATCH', path: `${base}/tasks?id=eq.{id}`,
          description: 'Update a task',
          exampleRequest: JSON.stringify({ status: 'completed' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', status: 'completed' }, null, 2),
        },
      ],
    },
    {
      name: 'knowledge',
      description: 'Knowledge base entries',
      endpoints: [
        {
          method: 'GET', path: `${base}/knowledge?select=*`,
          description: 'List knowledge entries',
          exampleResponse: JSON.stringify([{ id: 'uuid', title: 'Deployment Guide', content: '...', category: 'docs', created_at: '2025-01-01T00:00:00Z' }], null, 2),
        },
        {
          method: 'POST', path: `${base}/knowledge`,
          description: 'Add a knowledge entry',
          exampleRequest: JSON.stringify({ title: 'New Guide', content: 'Content here', category: 'docs' }, null, 2),
          exampleResponse: JSON.stringify({ id: 'uuid', title: 'New Guide' }, null, 2),
        },
      ],
    },
  ]
}

function buildCurl(endpoint: Endpoint): string {
  const headers = `-H "apikey: ${SUPABASE_ANON_KEY}" \\\n  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"`
  const contentType = endpoint.method !== 'GET' && endpoint.method !== 'DELETE' ? ` \\\n  -H "Content-Type: application/json"` : ''
  const prefer = endpoint.method === 'POST' || endpoint.method === 'PATCH' ? ` \\\n  -H "Prefer: return=representation"` : ''
  const body = endpoint.exampleRequest ? ` \\\n  -d '${endpoint.exampleRequest.replace(/\n/g, '')}'` : ''
  return `curl -X ${endpoint.method} "${endpoint.path}" \\\n  ${headers}${contentType}${prefer}${body}`
}

// ─── Components ─────────────────────────────────────────────────────────────

const CopyButton = memo(function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={copy}
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(109,40,217,0.12)',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(109,40,217,0.2)'}`,
        color: copied ? '#22c55e' : 'var(--cp-text-muted)',
      }}
      className="px-2 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          Copy
        </>
      )}
    </button>
  )
})

const MethodBadge = memo(function MethodBadge({ method }: { method: string }) {
  return (
    <span
      style={{
        background: `${METHOD_COLORS[method]}18`,
        color: METHOD_COLORS[method],
        border: `1px solid ${METHOD_COLORS[method]}30`,
      }}
      className="px-2 py-0.5 rounded text-xs font-bold font-mono"
    >
      {method}
    </span>
  )
})

const EndpointCard = memo(function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false)
  const curl = buildCurl(endpoint)

  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }}
      className="rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <MethodBadge method={endpoint.method} />
        <code style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-mono flex-1 truncate">
          {endpoint.path.replace(SUPABASE_URL, '')}
        </code>
        <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs hidden sm:block">{endpoint.description}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cp-text-dim)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--cp-border-strong)' }} className="px-4 py-4 space-y-3">
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">{endpoint.description}</p>

          {/* curl */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">cURL Example</span>
              <CopyButton text={curl.replace(/\\\n\s*/g, ' ')} />
            </div>
            <pre
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: '#a5f3fc' }}
              className="p-3 rounded-lg text-xs overflow-x-auto font-mono"
            >
              {curl}
            </pre>
          </div>

          {/* Request body */}
          {endpoint.exampleRequest && (
            <div>
              <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">Request Body</span>
              <pre
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: '#fde68a' }}
                className="p-3 rounded-lg text-xs overflow-x-auto font-mono mt-1"
              >
                {endpoint.exampleRequest}
              </pre>
            </div>
          )}

          {/* Response */}
          <div>
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">Response</span>
            <pre
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: '#86efac' }}
              className="p-3 rounded-lg text-xs overflow-x-auto font-mono mt-1"
            >
              {endpoint.exampleResponse}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
})

function ApiKeySection() {
  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }}
      className="rounded-2xl p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)' }} className="w-10 h-10 rounded-xl flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        </div>
        <div>
          <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">API Key</h3>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs">Public anon key — safe for client-side use with RLS enabled</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <code
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: '#a5f3fc' }}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-mono truncate"
        >
          {SUPABASE_ANON_KEY}
        </code>
        <CopyButton text={SUPABASE_ANON_KEY} />
      </div>

      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }} className="rounded-xl p-3">
        <p style={{ color: '#fbbf24' }} className="text-xs">
          <strong>Usage:</strong> Include this key in the <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>apikey</code> header and <code className="px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Authorization: Bearer</code> header for all requests. Row-Level Security (RLS) policies control data access.
        </p>
      </div>

      <div>
        <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider">Base URL</span>
        <div className="flex items-center gap-2 mt-1">
          <code
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: '#86efac' }}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
          >
            {SUPABASE_URL}/rest/v1
          </code>
          <CopyButton text={`${SUPABASE_URL}/rest/v1`} />
        </div>
      </div>
    </div>
  )
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

function WebhookModal({
  webhook,
  onSave,
  onClose,
}: {
  webhook: Webhook | null
  onSave: (w: Webhook) => void
  onClose: () => void
}) {
  const [url, setUrl] = useState(webhook?.url || '')
  const [events, setEvents] = useState<string[]>(webhook?.events || [])
  const [status, setStatus] = useState<'active' | 'paused'>(webhook?.status || 'active')

  const toggleEvent = (id: string) => {
    setEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!url.trim() || events.length === 0) return
    onSave({
      id: webhook?.id || crypto.randomUUID(),
      url: url.trim(),
      events,
      status,
      lastTriggered: webhook?.lastTriggered || null,
      createdAt: webhook?.createdAt || new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        style={{ background: 'var(--cp-bg)', border: '1px solid var(--cp-border-strong)' }}
        className="w-full max-w-lg rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold">
            {webhook ? 'Edit Webhook' : 'Add Webhook'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--cp-text-muted)' }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* URL */}
        <div>
          <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Webhook URL</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--cp-border-strong)', color: 'var(--cp-text-primary)' }}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Events */}
        <div>
          <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider block mb-2">Events</label>
          <div className="space-y-2">
            {EVENT_TYPES.map(evt => (
              <label
                key={evt.id}
                style={{
                  background: events.includes(evt.id) ? 'rgba(109,40,217,0.12)' : 'transparent',
                  border: `1px solid ${events.includes(evt.id) ? 'rgba(109,40,217,0.3)' : 'var(--cp-border-strong)'}`,
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={events.includes(evt.id)}
                  onChange={() => toggleEvent(evt.id)}
                  className="accent-purple-500"
                />
                <div>
                  <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-medium">{evt.label}</div>
                  <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{evt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider">Status</label>
          <button
            onClick={() => setStatus(s => s === 'active' ? 'paused' : 'active')}
            style={{
              background: status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              border: `1px solid ${status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              color: status === 'active' ? '#22c55e' : '#f59e0b',
            }}
            className="px-3 py-1 rounded-full text-xs font-semibold"
          >
            {status === 'active' ? '● Active' : '⏸ Paused'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            style={{ color: 'var(--cp-text-muted)', border: '1px solid var(--cp-border-strong)' }}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!url.trim() || events.length === 0}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: 'white',
              opacity: !url.trim() || events.length === 0 ? 0.5 : 1,
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity"
          >
            {webhook ? 'Save Changes' : 'Add Webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Webhook | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('clawpulse_webhooks')
      if (stored) setWebhooks(JSON.parse(stored))
    } catch {}
  }, [])

  const save = (list: Webhook[]) => {
    setWebhooks(list)
    localStorage.setItem('clawpulse_webhooks', JSON.stringify(list))
  }

  const handleSave = (w: Webhook) => {
    const exists = webhooks.find(x => x.id === w.id)
    if (exists) {
      save(webhooks.map(x => x.id === w.id ? w : x))
    } else {
      save([...webhooks, w])
    }
    setModalOpen(false)
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    save(webhooks.filter(x => x.id !== id))
  }

  const handleToggle = (id: string) => {
    save(webhooks.map(x => x.id === id ? { ...x, status: x.status === 'active' ? 'paused' as const : 'active' as const } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)' }} className="w-10 h-10 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 16.98h1a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" />
              <path d="M6 16.98H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1" />
              <rect x="6" y="4" width="12" height="16" rx="2" />
              <path d="M12 12h.01" />
              <path d="M12 16h.01" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <div>
            <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-base font-bold">Webhooks</h3>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs">Configure webhook endpoints for event notifications</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white' }}
          className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div
          style={{ background: 'var(--cp-card-bg)', border: '1px dashed var(--cp-border-strong)' }}
          className="rounded-2xl p-8 text-center"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cp-text-dim)" strokeWidth="1.5" className="mx-auto mb-3">
            <path d="M18 16.98h1a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1" />
            <path d="M6 16.98H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1" />
            <rect x="6" y="4" width="12" height="16" rx="2" />
          </svg>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">No webhooks configured yet</p>
          <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-1">Add a webhook to receive event notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div
              key={wh.id}
              style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }}
              className="rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-mono truncate">{wh.url}</code>
                    <button
                      onClick={() => handleToggle(wh.id)}
                      style={{
                        background: wh.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                        color: wh.status === 'active' ? '#22c55e' : '#f59e0b',
                        border: `1px solid ${wh.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      }}
                      className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                    >
                      {wh.status === 'active' ? '● Active' : '⏸ Paused'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {wh.events.map(evt => (
                      <span
                        key={evt}
                        style={{ background: 'rgba(109,40,217,0.1)', color: '#c4b5fd', border: '1px solid rgba(109,40,217,0.2)' }}
                        className="px-2 py-0.5 rounded text-xs font-mono"
                      >
                        {evt}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-2">
                    Last triggered: {wh.lastTriggered ? new Date(wh.lastTriggered).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditing(wh); setModalOpen(true) }}
                    style={{ color: 'var(--cp-text-muted)' }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    style={{ color: '#ef4444' }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <WebhookModal
          webhook={editing}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<'docs' | 'webhooks'>('docs')
  const tableDocs = buildTableDocs()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(109,40,217,0.2), rgba(109,40,217,0.05))',
              border: '1px solid rgba(109,40,217,0.3)',
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l6-6-6-6" />
              <path d="M12 19h8" />
            </svg>
          </div>
          <div>
            <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-xl font-bold">API & Webhooks</h1>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">Supabase REST API reference and webhook configuration</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1" style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)', borderRadius: '12px', padding: '4px' }}>
        {(['docs', 'webhooks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'rgba(109,40,217,0.18)' : 'transparent',
              color: activeTab === tab ? 'var(--cp-text-accent-light)' : 'var(--cp-text-muted)',
            }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          >
            {tab === 'docs' ? '📖 API Documentation' : '🔗 Webhooks'}
          </button>
        ))}
      </div>

      {activeTab === 'docs' ? (
        <div className="space-y-6">
          <ApiKeySection />

          {tableDocs.map(table => (
            <div key={table.name} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold font-mono">{table.name}</h2>
                <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">— {table.description}</span>
              </div>
              <div className="space-y-2">
                {table.endpoints.map((ep, i) => (
                  <EndpointCard key={i} endpoint={ep} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <WebhooksSection />
      )}
    </div>
  )
}
