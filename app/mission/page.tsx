'use client'

import { useEffect, useState } from 'react'
import { fetchSettings, upsertSetting } from '@/lib/supabase-client'
import { supabase } from '@/lib/supabase-client'

interface AgentMission {
  id: string
  name: string
  role: string
  model: string
  mission: string | null
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function EditableStatement({
  label,
  value,
  onSave,
  large = false,
  accent,
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  large?: boolean
  accent: { color: string; bg: string; border: string; glow: string }
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value) }, [value])

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div
      style={{
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        boxShadow: editing ? `0 0 32px ${accent.glow}` : '0 4px 24px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        transition: 'box-shadow 0.3s',
      }}
      className="rounded-2xl p-7"
    >
      <div className="flex items-center justify-between mb-5">
        <span
          style={{ color: accent.color, background: `${accent.color}18`, border: `1px solid ${accent.color}35` }}
          className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
        >
          {label}
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{
              color: 'var(--cp-text-muted)',
              background: 'var(--cp-input-bg)',
              border: '1px solid var(--cp-border-subtle)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-white transition-colors"
          >
            <EditIcon />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setDraft(value) }}
              style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                color: accent.color,
                background: accent.bg,
                border: `1px solid ${accent.border}`,
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <SaveIcon />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          rows={4}
          style={{
            background: 'var(--cp-code-bg)',
            border: `1px solid ${accent.border}`,
            color: 'var(--cp-text-primary)',
            fontSize: large ? '18px' : '15px',
            lineHeight: '1.6',
            resize: 'vertical',
          }}
          className="w-full rounded-xl px-4 py-3 outline-none font-medium"
        />
      ) : (
        <p
          style={{
            color: 'var(--cp-text-heading)',
            fontSize: large ? '22px' : '16px',
            lineHeight: '1.65',
            fontWeight: large ? 600 : 400,
            letterSpacing: large ? '-0.01em' : '0',
          }}
        >
          {value || <span style={{ color: 'var(--cp-text-dim)', fontStyle: 'italic' }}>No statement yet — click Edit to add one.</span>}
        </p>
      )}
    </div>
  )
}

function AgentMissionCard({ agent, onSave }: { agent: AgentMission; onSave: (id: string, mission: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(agent.mission || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(agent.mission || '') }, [agent.mission])

  async function handleSave() {
    setSaving(true)
    await onSave(agent.id, draft)
    setSaving(false)
    setEditing(false)
  }

  const isOpus = agent.model.includes('opus') || agent.model.includes('Opus')
  const isSonnet = agent.model.includes('sonnet') || agent.model.includes('Sonnet')
  const modelColor = isOpus ? '#a78bfa' : isSonnet ? '#60a5fa' : '#34d399'

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        backdropFilter: 'blur(12px)',
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
          borderBottom: '1px solid var(--cp-divider)',
        }}
        className="px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              background: 'rgba(109,40,217,0.15)',
              border: '1px solid rgba(139,92,246,0.2)',
              color: '#8b5cf6',
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-sm">{agent.name}</div>
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{agent.role}</div>
          </div>
        </div>
        <span style={{ color: modelColor, background: `${modelColor}15`, border: `1px solid ${modelColor}30` }} className="text-xs px-2 py-0.5 rounded-full font-semibold">
          {isOpus ? 'Opus' : isSonnet ? 'Sonnet' : 'GPT-4o'}
        </span>
      </div>

      {/* Mission */}
      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Enter agent mission statement..."
              style={{
                background: 'var(--cp-code-bg)',
                border: '1px solid var(--cp-border-stronger)',
                color: 'var(--cp-text-primary)',
                fontSize: '13px',
                resize: 'vertical',
              }}
              className="w-full rounded-lg px-3 py-2.5 outline-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEditing(false); setDraft(agent.mission || '') }}
                style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                <SaveIcon />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {agent.mission ? (
              <p style={{ color: 'var(--cp-text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>{agent.mission}</p>
            ) : (
              <p style={{ color: 'var(--cp-text-dimmer)', fontSize: '13px', fontStyle: 'italic' }}>No mission statement yet</p>
            )}
            <button
              onClick={() => setEditing(true)}
              style={{ color: 'var(--cp-text-muted)' }}
              className="flex items-center gap-1 mt-3 text-xs font-semibold hover:text-white transition-colors"
            >
              <EditIcon />
              {agent.mission ? 'Edit mission' : 'Add mission'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MissionPage() {
  const [mission, setMission] = useState('')
  const [vision, setVision] = useState('')
  const [agents, setAgents] = useState<AgentMission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [settings, agentsData] = await Promise.all([
        fetchSettings(['company_mission', 'company_vision']),
        supabase.from('agents').select('id, name, role, model, mission').order('name'),
      ])
      setMission(settings['company_mission'] || '')
      setVision(settings['company_vision'] || '')
      setAgents((agentsData.data || []) as AgentMission[])
      setLoading(false)
    }
    load()
  }, [])

  async function saveMission(value: string) {
    await upsertSetting('company_mission', value)
    setMission(value)
  }

  async function saveVision(value: string) {
    await upsertSetting('company_vision', value)
    setVision(value)
  }

  async function saveAgentMission(agentId: string, agentMission: string) {
    const { error } = await supabase.from('agents').update({ mission: agentMission }).eq('id', agentId)
    if (!error) {
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, mission: agentMission } : a))
    }
  }

  const missionAccent = {
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.2)',
    glow: 'rgba(167,139,250,0.15)',
  }

  const visionAccent = {
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.06)',
    border: 'rgba(34,211,238,0.2)',
    glow: 'rgba(34,211,238,0.15)',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Mission & Vision</h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">The purpose and direction of our agent network</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-16">Loading…</div>
      ) : (
        <>
          {/* Company mission + vision */}
          <div className="space-y-5 mb-12">
            <EditableStatement
              label="Company Mission"
              value={mission}
              onSave={saveMission}
              large
              accent={missionAccent}
            />
            <EditableStatement
              label="Company Vision"
              value={vision}
              onSave={saveVision}
              large
              accent={visionAccent}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div style={{ flex: 1, height: '1px', background: 'rgba(109,40,217,0.14)' }} />
            <span style={{ color: 'var(--cp-text-nav-label)' }} className="text-xs font-bold uppercase tracking-widest">Agent Missions</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(109,40,217,0.14)' }} />
          </div>

          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mb-6">
            Each agent operates with a focused mission aligned to the company&apos;s broader purpose. Click any card to edit.
          </p>

          {/* Agent missions grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentMissionCard key={agent.id} agent={agent} onSave={saveAgentMission} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
