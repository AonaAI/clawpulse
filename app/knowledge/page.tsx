'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, upsertKnowledge } from '@/lib/supabase-client'
import { AGENTS } from '@/lib/data'
import { useDebounce } from '@/lib/useDebounce'
import type { KnowledgeEntry, KnowledgeCategory } from '@/lib/types'

const CATEGORIES: { value: KnowledgeCategory | 'all'; label: string; color: string; bg: string; border: string }[] = [
  { value: 'all',      label: 'All',       color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
  { value: 'lesson',   label: 'Lessons',   color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.2)'  },
  { value: 'skill',    label: 'Skills',    color: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.2)'  },
  { value: 'document', label: 'Documents', color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.2)'  },
  { value: 'protocol', label: 'Protocols', color: '#f472b6', bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.2)' },
]

function categoryConfig(cat: KnowledgeCategory) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0]
}

// ── Small components ──────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: KnowledgeCategory }) {
  const cfg = categoryConfig(category)
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
    >
      {category}
    </span>
  )
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-tag-bg)', border: '1px solid var(--cp-border-subtle)', fontSize: 11 }}
      className="px-2 py-0.5 rounded-md font-mono"
    >
      #{tag}
    </span>
  )
}

function IconButton({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className="p-1 rounded-md transition-colors"
      style={{ color: danger ? '#f87171' : '#6b7280', background: 'transparent' }}
      onMouseEnter={e => { (e.target as HTMLElement).style.background = danger ? 'rgba(248,113,113,0.12)' : 'rgba(139,92,246,0.12)' }}
      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ── Knowledge Card ────────────────────────────────────────────────────────

function KnowledgeCard({ entry, onEdit, onDelete }: { entry: KnowledgeEntry; onEdit: (e: KnowledgeEntry) => void; onDelete: (e: KnowledgeEntry) => void }) {
  const agent = AGENTS.find(a => a.id === entry.source_agent)
  const cfg = categoryConfig(entry.category)

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        borderTop: `2px solid ${cfg.color}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-xl overflow-hidden group"
    >
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CategoryBadge category={entry.category} />
            <h3 style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base mt-2 leading-snug">{entry.title}</h3>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
            <IconButton onClick={() => onEdit(entry)} title="Edit">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </IconButton>
            <IconButton onClick={() => onDelete(entry)} title="Delete" danger>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </IconButton>
          </div>
        </div>

        {/* Content preview */}
        <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm leading-relaxed line-clamp-3">{entry.content}</p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map(tag => <TagChip key={tag} tag={tag} />)}
          </div>
        )}

        {/* Footer */}
        <div
          style={{ borderTop: '1px solid var(--cp-divider)' }}
          className="flex items-center justify-between pt-3"
        >
          {agent ? (
            <div className="flex items-center gap-2">
              <div
                style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.2)', width: 20, height: 20, minWidth: 20, fontSize: 9, color: '#8b5cf6' }}
                className="rounded-md flex items-center justify-center font-bold"
              >{agent.name.slice(0, 2).toUpperCase()}</div>
              <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{agent.name}</span>
            </div>
          ) : (
            <span style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs">Unknown author</span>
          )}
          <span style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs">
            {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Modal / Form ──────────────────────────────────────────────────────────

interface KnowledgeFormData {
  title: string
  content: string
  category: KnowledgeCategory
  tags: string
  source_agent: string
}

const emptyForm: KnowledgeFormData = {
  title: '',
  content: '',
  category: 'document',
  tags: '',
  source_agent: 'main',
}

function KnowledgeModal({
  open, entry, onClose, onSave,
}: {
  open: boolean
  entry: KnowledgeEntry | null
  onClose: () => void
  onSave: (data: KnowledgeFormData, id?: string) => void
}) {
  const [form, setForm] = useState<KnowledgeFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setForm({
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags.join(', '),
        source_agent: entry.source_agent,
      })
    } else {
      setForm(emptyForm)
    }
  }, [entry, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    await onSave(form, entry?.id)
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--cp-input-bg)',
    border: '1px solid rgba(139,92,246,0.2)',
    color: 'var(--cp-text-card-title)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  }
  const labelStyle: React.CSSProperties = { color: 'var(--cp-text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }

  return (
    <div
      style={{ background: 'var(--cp-overlay)', backdropFilter: 'blur(4px)' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--cp-panel-bg)',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
        className="rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-xl font-bold mb-5">
          {entry ? 'Edit Entry' : 'New Knowledge Entry'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Entry title…" required />
          </div>
          <div>
            <label style={labelStyle}>Content *</label>
            <textarea
              style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write the knowledge entry content…"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as KnowledgeCategory }))}>
                <option value="document">Document</option>
                <option value="lesson">Lesson</option>
                <option value="skill">Skill</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Author</label>
              <select style={inputStyle} value={form.source_agent} onChange={e => setForm(f => ({ ...f, source_agent: e.target.value }))}>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input
              style={inputStyle}
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. api, auth, onboarding"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.content.trim()} style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', opacity: saving ? 0.6 : 1 }} className="px-5 py-2 rounded-lg text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity">
              {saving ? 'Saving…' : entry ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ entry, onClose, onConfirm }: { entry: KnowledgeEntry | null; onClose: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)
  if (!entry) return null
  return (
    <div style={{ background: 'var(--cp-overlay)', backdropFilter: 'blur(4px)' }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--cp-panel-bg)', border: '1px solid rgba(248,113,113,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} className="rounded-2xl w-full max-w-sm p-6">
        <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold mb-2">Delete Entry</h2>
        <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm mb-5">Delete <strong style={{ color: 'var(--cp-text-card-title)' }}>&quot;{entry.title}&quot;</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">Cancel</button>
          <button disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }} style={{ background: '#dc2626', color: '#fff', opacity: deleting ? 0.6 : 1 }} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Webhook API Docs ───────────────────────────────────────────────────────

const FUNCTION_URL = 'https://<project-ref>.supabase.co/functions/v1/update-agent-status'

const CODE_EXAMPLES = [
  {
    label: 'Set status',
    code: `curl -X POST ${FUNCTION_URL} \\
  -H "Authorization: Bearer <WEBHOOK_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "main",
    "status": "working",
    "current_task": "Refactoring auth module"
  }'`,
  },
  {
    label: 'With metadata',
    code: `curl -X POST ${FUNCTION_URL} \\
  -H "Authorization: Bearer <WEBHOOK_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "coder",
    "status": "idle",
    "current_task": null,
    "metadata": {
      "last_repo": "clawpulse",
      "exit_code": 0
    }
  }'`,
  },
  {
    label: 'Task only (no status change)',
    code: `curl -X POST ${FUNCTION_URL} \\
  -H "Authorization: Bearer <WEBHOOK_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "researcher",
    "current_task": "Summarising weekly reports"
  }'`,
  },
]

function WebhookApiDocs() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState<number | null>(null)

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid rgba(109,40,217,0.18)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 40,
      }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(139,92,246,0.2)', width: 34, height: 34 }}
            className="rounded-lg flex items-center justify-center flex-shrink-0"
          >
            <svg width="16" height="16" fill="none" stroke="#8b5cf6" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h2 style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base">Webhook API</h2>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium mt-0.5">
              Update agent status from external scripts via Supabase Edge Function
            </p>
          </div>
        </div>
        <svg
          width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(109,40,217,0.12)' }}>
          {/* Endpoint */}
          <div className="px-6 py-5 space-y-5">
            <div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Endpoint
              </p>
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(109,40,217,0.16)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: '#a78bfa',
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ color: '#34d399', fontWeight: 700, marginRight: 8 }}>POST</span>
                {FUNCTION_URL}
              </div>
            </div>

            {/* Auth */}
            <div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Authentication
              </p>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(109,40,217,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                <span style={{ color: '#9ca3af' }}>Header: </span>
                <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Authorization: Bearer {'<WEBHOOK_API_KEY>'}</span>
              </div>
              <p style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>
                Set <code style={{ fontFamily: 'monospace', color: '#a78bfa' }}>WEBHOOK_API_KEY</code> as a Supabase secret:
                {' '}<code style={{ fontFamily: 'monospace', color: '#9ca3af' }}>supabase secrets set WEBHOOK_API_KEY=your-key</code>
              </p>
            </div>

            {/* Fields table */}
            <div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Request body (JSON)
              </p>
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(109,40,217,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(109,40,217,0.12)' }}>
                      {['Field', 'Type', 'Required', 'Description'].map(h => (
                        <th key={h} style={{ color: '#6b7280', fontWeight: 700, textAlign: 'left', padding: '8px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { field: 'agent_id', type: 'string', req: true, desc: 'ID of the agent to update (must exist in agents table)' },
                      { field: 'status', type: 'string', req: false, desc: 'idle | working | offline | waiting' },
                      { field: 'current_task', type: 'string', req: false, desc: 'Human-readable description of what the agent is doing' },
                      { field: 'metadata', type: 'object', req: false, desc: 'Arbitrary JSON stored on the agent row and logged to activity_log' },
                    ].map((row, i) => (
                      <tr key={row.field} style={{ borderTop: i > 0 ? '1px solid rgba(109,40,217,0.08)' : undefined }}>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#a78bfa', fontWeight: 600 }}>{row.field}</td>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#9ca3af' }}>{row.type}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{
                            background: row.req ? 'rgba(52,211,153,0.08)' : 'rgba(107,114,128,0.08)',
                            color: row.req ? '#34d399' : '#6b7280',
                            border: `1px solid ${row.req ? 'rgba(52,211,153,0.2)' : 'rgba(107,114,128,0.15)'}`,
                            borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                          }}>
                            {row.req ? 'required' : 'optional'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', color: '#9ca3af' }}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Response codes */}
            <div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Response codes
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: '200', label: 'OK', color: '#34d399' },
                  { code: '400', label: 'Bad request / missing fields', color: '#fbbf24' },
                  { code: '401', label: 'Invalid API key', color: '#f87171' },
                  { code: '404', label: 'Agent not found', color: '#f87171' },
                ].map(r => (
                  <div
                    key={r.code}
                    style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid rgba(109,40,217,0.12)`, borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontFamily: 'monospace', color: r.color, fontWeight: 700, fontSize: 13 }}>{r.code}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code examples with tabs */}
            <div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Examples
              </p>
              {/* Tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {CODE_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    style={{
                      background: activeTab === i ? 'rgba(124,58,237,0.16)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${activeTab === i ? 'rgba(139,92,246,0.35)' : 'rgba(109,40,217,0.12)'}`,
                      color: activeTab === i ? '#a78bfa' : '#6b7280',
                      borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              {/* Code block */}
              <div style={{ position: 'relative' }}>
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(109,40,217,0.16)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                    color: '#d1d5db',
                    overflowX: 'auto',
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: 'pre',
                  }}
                >
                  {CODE_EXAMPLES[activeTab].code}
                </pre>
                <button
                  onClick={() => copy(CODE_EXAMPLES[activeTab].code, activeTab)}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(139,92,246,0.25)',
                    color: copied === activeTab ? '#34d399' : '#a78bfa',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {copied === activeTab ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Deploy note */}
            <div
              style={{
                background: 'rgba(251,191,36,0.05)',
                border: '1px solid rgba(251,191,36,0.15)',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 12.5,
                color: '#9ca3af',
              }}
            >
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>Deploy: </span>
              Run{' '}
              <code style={{ fontFamily: 'monospace', color: '#a78bfa' }}>
                supabase functions deploy update-agent-status
              </code>{' '}
              then set your secret with{' '}
              <code style={{ fontFamily: 'monospace', color: '#a78bfa' }}>
                supabase secrets set WEBHOOK_API_KEY=your-secret-key
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [filter, setFilter] = useState<KnowledgeCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<KnowledgeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importToast, setImportToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const data = await fetchKnowledge()
    if (data.length === 0 && entries.length === 0) setError(false)
    setEntries(data as KnowledgeEntry[])
    setLoading(false)
  }, [entries.length])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async (data: KnowledgeFormData, id?: string) => {
    const tags = data.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (id) {
      const updated = await updateKnowledge(id, { title: data.title, content: data.content, category: data.category, tags })
      if (updated) setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))
    } else {
      const created = await createKnowledge({ title: data.title, content: data.content, category: data.category, tags, source_agent: data.source_agent })
      if (created) setEntries(prev => [created as KnowledgeEntry, ...prev])
      else setError(true)
    }
    setModalOpen(false)
    setEditingEntry(null)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deletingEntry) return
    const ok = await deleteKnowledge(deletingEntry.id)
    if (ok) setEntries(prev => prev.filter(e => e.id !== deletingEntry.id))
    setDeletingEntry(null)
  }, [deletingEntry])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const parsed: KnowledgeEntry[] = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
      const toUpsert = parsed.map(({ id, title, content, category, tags, source_agent }) => ({
        id, title, content, category, tags: tags ?? [], source_agent,
      }))
      const count = await upsertKnowledge(toUpsert)
      await load()
      setImportToast({ ok: true, msg: `Imported ${count} entr${count === 1 ? 'y' : 'ies'}` })
    } catch {
      setImportToast({ ok: false, msg: 'Import failed — invalid JSON format' })
    } finally {
      setImporting(false)
      setTimeout(() => setImportToast(null), 4000)
    }
  }, [load])

  const filtered = entries.filter(e => {
    const matchCat = filter === 'all' || e.category === filter
    const q = debouncedSearch.toLowerCase()
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q))
    return matchCat && matchSearch
  })

  const counts = {
    all: entries.length,
    lesson: entries.filter(e => e.category === 'lesson').length,
    skill: entries.filter(e => e.category === 'skill').length,
    document: entries.filter(e => e.category === 'document').length,
    protocol: entries.filter(e => e.category === 'protocol').length,
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Hidden file input for import */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

      {/* Import toast */}
      {importToast && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 60,
            background: importToast.ok ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${importToast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: importToast.ok ? '#34d399' : '#f87171',
            backdropFilter: 'blur(12px)',
            borderRadius: 12, padding: '10px 16px',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {importToast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Shared lessons, skills, and documents across all agents</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import */}
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid rgba(255,255,255,0.1)' }}
            className="px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {importing ? 'Importing…' : 'Import'}
          </button>
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid rgba(255,255,255,0.1)' }}
            className="px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          {/* New Entry */}
          <button
            onClick={() => { setEditingEntry(null); setModalOpen(true) }}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            New Entry
          </button>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => {
            const isActive = filter === cat.value
            return (
              <button
                key={cat.value}
                onClick={() => setFilter(cat.value)}
                style={{
                  background: isActive ? cat.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? cat.border : 'rgba(109,40,217,0.14)'}`,
                  color: isActive ? cat.color : '#6b7280',
                }}
                className="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all"
              >
                {cat.label}
                <span
                  style={{
                    color: isActive ? cat.color : '#374151',
                    background: isActive ? `${cat.color}18` : 'rgba(0,0,0,0.2)',
                    marginLeft: 6,
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 99,
                    fontWeight: 700,
                  }}
                >
                  {counts[cat.value as keyof typeof counts]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex-1 min-w-[200px] max-w-xs">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--cp-card-bg-hover)',
              border: '1px solid var(--cp-border-strong)',
              color: 'var(--cp-text-card-title)',
              borderRadius: 10,
              padding: '7px 12px',
              fontSize: 14,
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }} className="rounded-xl px-4 py-3 text-xs font-medium mb-6">
          Could not reach the <code className="font-mono">knowledge</code> table. Make sure the table exists in Supabase.
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: 'var(--cp-card-bg)', border: '1px solid rgba(109,40,217,0.1)', height: 200 }} className="rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.15)' }} className="w-16 h-16 rounded-2xl flex items-center justify-center">
            <svg width="28" height="28" fill="none" stroke="#6b7280" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">
            {search ? `No results for "${search}"` : 'No knowledge entries yet'}
          </div>
          {!search && (
            <button
              onClick={() => { setEditingEntry(null); setModalOpen(true) }}
              style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
              className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Add your first entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(entry => (
            <KnowledgeCard
              key={entry.id}
              entry={entry}
              onEdit={e => { setEditingEntry(e); setModalOpen(true) }}
              onDelete={e => setDeletingEntry(e)}
            />
          ))}
        </div>
      )}

      <KnowledgeModal open={modalOpen} entry={editingEntry} onClose={() => { setModalOpen(false); setEditingEntry(null) }} onSave={handleSave} />
      <DeleteConfirm entry={deletingEntry} onClose={() => setDeletingEntry(null)} onConfirm={handleDelete} />

      <WebhookApiDocs />
    </div>
  )
}
