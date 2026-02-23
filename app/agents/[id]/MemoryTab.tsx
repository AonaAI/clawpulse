'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { MemoryFile } from '@/app/api/agents/[id]/memory/route'
import type { KnowledgeEntry } from '@/lib/types'
import type { Session } from '@/lib/types'

// ── Model context limits ────────────────────────────────────────────────────

function getContextLimit(model: string): number {
  const m = model.toLowerCase()
  if (m.includes('gpt-4')) return 128_000
  return 200_000 // Claude Opus / Sonnet
}

// ── Simple markdown → HTML ──────────────────────────────────────────────────

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks (must come before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="md-pre"><code class="md-code">${escHtml(code.trim())}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, (_, code) => `<code class="md-inline-code">${escHtml(code)}</code>`)
    // Horizontal rules
    .replace(/^---+$/gm, '<hr class="md-hr" />')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="md-em">$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>')
    // Unordered list items
    .replace(/^[ \t]*[-*] (.+)$/gm, '<li class="md-li">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li class="md-li">[\s\S]*?<\/li>)(\n<li class="md-li">[\s\S]*?<\/li>)*/g, match => `<ul class="md-ul">${match}</ul>`)
    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
    .replace(/(<li class="md-oli">[\s\S]*?<\/li>)(\n<li class="md-oli">[\s\S]*?<\/li>)*/g, match => `<ol class="md-ol">${match}</ol>`)
    // Paragraphs: wrap lines that aren't HTML tags
    .split('\n\n')
    .map(block => {
      if (block.trim().startsWith('<')) return block
      const trimmed = block.trim()
      if (!trimmed) return ''
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')

  return html
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  lesson:   { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)' },
  skill:    { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)' },
  document: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)' },
  protocol: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
}

function getCategoryStyle(cat: string) {
  return CATEGORY_CONFIG[cat] ?? { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' }
}

// ── Context Window Visualization ─────────────────────────────────────────────

function ContextBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100)
  const color = pct < 40 ? '#34d399' : pct < 70 ? '#fbbf24' : '#f87171'
  const gradientColor = pct < 40
    ? 'linear-gradient(90deg, #059669, #34d399)'
    : pct < 70
    ? 'linear-gradient(90deg, #d97706, #fbbf24)'
    : 'linear-gradient(90deg, #dc2626, #f87171)'

  // Estimated breakdown (rough estimates for Claude Code agents)
  const systemEst = Math.min(8_000, used * 0.18)
  const toolsEst = Math.min(6_000, used * 0.13)
  const convEst = Math.max(0, used - systemEst - toolsEst)
  const maxEst = Math.max(systemEst, toolsEst, convEst, 1)

  return (
    <div>
      {/* Main bar */}
      <div className="flex items-center justify-between mb-2">
        <span style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-sm">Context Window</span>
        <span style={{ color }} className="text-sm font-bold font-mono">
          {(used / 1000).toFixed(1)}k / {(limit / 1000).toFixed(0)}k tokens
        </span>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '10px', overflow: 'hidden' }} className="mb-1">
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: gradientColor,
            borderRadius: '999px',
            transition: 'width 0.8s ease',
          }}
        />
      </div>

      <div className="flex items-center justify-between mb-5">
        <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{pct.toFixed(1)}% used</span>
        <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">{((limit - used) / 1000).toFixed(1)}k remaining</span>
      </div>

      {/* Breakdown */}
      {used > 0 && (
        <div className="space-y-2.5">
          {[
            { label: 'System Prompt', tokens: systemEst, color: '#8b5cf6' },
            { label: 'Tool Definitions', tokens: toolsEst, color: '#22d3ee' },
            { label: 'Conversation', tokens: convEst, color: '#60a5fa' },
          ].map(({ label, tokens, color: barColor }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium">{label}</span>
                <span style={{ color: barColor }} className="text-xs font-mono font-semibold">
                  ~{tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : Math.round(tokens)}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(tokens / maxEst) * 100}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: '999px',
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          ))}
          <p style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px' }} className="mt-2 italic">
            Breakdown estimated from session token count
          </p>
        </div>
      )}
    </div>
  )
}

// ── Knowledge Entry Row ───────────────────────────────────────────────────────

function KnowledgeRow({ entry, isLast }: { entry: KnowledgeEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const cat = getCategoryStyle(entry.category)

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 sm:px-5 py-3.5 flex items-start gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--cp-text-dim)', marginTop: '2px', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-semibold leading-tight">{entry.title}</span>
            <span
              style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`, fontSize: '10px' }}
              className="px-2 py-0.5 rounded-full font-bold flex-shrink-0 capitalize whitespace-nowrap"
            >
              {entry.category}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {entry.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-tag-bg)', border: '1px solid var(--cp-border-subtle)', fontSize: '10px' }}
                className="px-1.5 py-0.5 rounded font-mono"
              >
                {tag}
              </span>
            ))}
            <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '11px' }} className="ml-auto flex-shrink-0">
              {formatDate(entry.updated_at)}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 sm:px-5 pb-4 pt-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <pre
            style={{
              background: 'var(--cp-code-bg)',
              border: '1px solid var(--cp-border-subtle)',
              color: 'var(--cp-text-secondary)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {entry.content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main MemoryTab ────────────────────────────────────────────────────────────

interface MemoryTabProps {
  agentId: string
  agentModel: string
  latestSession: Session | null
}

export default function MemoryTab({ agentId, agentModel, latestSession }: MemoryTabProps) {
  const [memFiles, setMemFiles] = useState<MemoryFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [memLoading, setMemLoading] = useState(true)
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [kbLoading, setKbLoading] = useState(true)

  useEffect(() => {
    async function loadMemory() {
      try {
        const res = await fetch(`/api/agents/${agentId}/memory`)
        if (res.ok) {
          const data = await res.json()
          const files: MemoryFile[] = data.files ?? []
          setMemFiles(files)
          if (files.length > 0) setSelectedFile(files[0].name)
        }
      } catch {
        // ignore
      } finally {
        setMemLoading(false)
      }
    }

    async function loadKnowledge() {
      const { data } = await supabase
        .from('knowledge')
        .select('*')
        .eq('source_agent', agentId)
        .order('updated_at', { ascending: false })
      setKnowledge((data ?? []) as KnowledgeEntry[])
      setKbLoading(false)
    }

    loadMemory()
    loadKnowledge()
  }, [agentId])

  const contextLimit = getContextLimit(agentModel)
  const contextUsed = latestSession?.token_count ?? 0

  const activeFile = memFiles.find(f => f.name === selectedFile) ?? null

  return (
    <div className="space-y-6">
      {/* ── Context Window ─────────────────────────────────────────────── */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Context Window</h2>
          <span style={{ color: 'var(--cp-text-dim)', fontSize: '11px' }} className="ml-auto">
            {agentModel} · {(contextLimit / 1000).toFixed(0)}k max
          </span>
        </div>

        {contextUsed === 0 ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-6">
            No active session — context data unavailable
          </div>
        ) : (
          <ContextBar used={contextUsed} limit={contextLimit} />
        )}
      </div>

      {/* ── Memory Files ───────────────────────────────────────────────── */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid var(--cp-divider-accent)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Memory Files</h2>
            {!memLoading && memFiles.length > 0 && (
              <span style={{ color: 'var(--cp-text-dim)', fontSize: '12px' }} className="ml-1">
                {memFiles.length} file{memFiles.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {memLoading ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">Loading…</div>
        ) : memFiles.length === 0 ? (
          <div className="px-4 sm:px-5 py-10 text-center">
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm mb-1">No memory files found</div>
            <div style={{ color: 'var(--cp-text-dimmer)', fontSize: '12px' }}>
              Expected at {'{workspace}'}/MEMORY.md
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row" style={{ minHeight: '320px' }}>
            {/* File list */}
            <div
              className="sm:w-56 flex-shrink-0 overflow-y-auto"
              style={{ borderRight: '1px solid var(--cp-divider-accent)', borderBottom: '1px solid var(--cp-divider-accent)' }}
            >
              {memFiles.map(file => {
                const isActive = file.name === selectedFile
                return (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className="w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors"
                    style={{
                      background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                      borderLeft: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <span
                      style={{
                        color: isActive ? '#c4b5fd' : 'var(--cp-text-secondary)',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontWeight: isActive ? 600 : 400,
                        wordBreak: 'break-all',
                      }}
                    >
                      {file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px' }}>{formatSize(file.size)}</span>
                      <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px' }}>·</span>
                      <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px' }}>{formatTimeAgo(file.modified)}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* File content */}
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {activeFile ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      style={{
                        color: '#c4b5fd',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}
                    >
                      {activeFile.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '11px' }}>{formatSize(activeFile.size)}</span>
                      <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '11px' }}>Modified {formatTimeAgo(activeFile.modified)}</span>
                    </div>
                  </div>
                  <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(activeFile.content) }}
                    style={{ fontSize: '13px', lineHeight: '1.7' }}
                  />
                </>
              ) : (
                <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">Select a file</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Knowledge Base ─────────────────────────────────────────────── */}
      <div
        style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
        className="rounded-xl overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid var(--cp-divider-accent)' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Knowledge Base</h2>
            {!kbLoading && (
              <span style={{ color: 'var(--cp-text-dim)', fontSize: '12px' }} className="ml-1">
                {knowledge.length} {knowledge.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
        </div>

        {kbLoading ? (
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-10">Loading…</div>
        ) : knowledge.length === 0 ? (
          <div className="px-4 sm:px-5 py-10 text-center">
            <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm mb-1">No knowledge entries</div>
            <div style={{ color: 'var(--cp-text-dimmer)', fontSize: '12px' }}>
              Knowledge added by this agent will appear here
            </div>
          </div>
        ) : (
          <div>
            {knowledge.map((entry, i) => (
              <KnowledgeRow key={entry.id} entry={entry} isLast={i === knowledge.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
