'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, updateProject, updateProjectAgent } from '@/lib/supabase-client'
import { fetchCompanySettings, updateCompanySettings } from '@/lib/company'
import { APP_NAME, COMPANY_NAME } from '@/lib/config'
import type { CompanySettings } from '@/lib/company'
import { useProject } from '@/components/ProjectProvider'
import type { Project, ProjectAgent } from '@/components/ProjectProvider'

// ── Icons ────────────────────────────────────────────────────────────────────

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Editable text (mission / vision) ─────────────────────────────────────────

function EditableText({
  label,
  value,
  onSave,
  placeholder = 'Click Edit to add a statement…',
  large = false,
  color,
}: {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  placeholder?: string
  large?: boolean
  color: string
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:text-[var(--cp-text-primary)] transition-colors"
          >
            <EditIcon /> Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => { setEditing(false); setDraft(value) }}
              style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
              className="px-2 py-1 rounded-md text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold"
            >
              <CheckIcon /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          rows={large ? 3 : 2}
          style={{
            background: 'var(--cp-code-bg)',
            border: `1px solid ${color}40`,
            color: 'var(--cp-text-primary)',
            fontSize: large ? '16px' : '14px',
            lineHeight: '1.6',
            resize: 'vertical',
          }}
          className="w-full rounded-lg px-3 py-2.5 outline-none"
        />
      ) : (
        <p style={{
          color: value ? 'var(--cp-text-primary)' : 'var(--cp-text-dim)',
          fontSize: large ? '17px' : '14px',
          lineHeight: '1.65',
          fontStyle: value ? 'normal' : 'italic',
          fontWeight: large ? 500 : 400,
        }}>
          {value || placeholder}
        </p>
      )}
    </div>
  )
}

// ── Goals list (inline editable) ─────────────────────────────────────────────

function GoalsList({
  goals,
  onSave,
  color,
  accentBg,
}: {
  goals: string[]
  onSave: (goals: string[]) => Promise<void>
  color: string
  accentBg: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>(goals)
  const [newGoal, setNewGoal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(goals) }, [goals])

  async function handleSave() {
    setSaving(true)
    await onSave(draft.filter(g => g.trim()))
    setSaving(false)
    setEditing(false)
    setNewGoal('')
  }

  function addGoal() {
    if (newGoal.trim()) {
      setDraft(prev => [...prev, newGoal.trim()])
      setNewGoal('')
    }
  }

  function removeGoal(i: number) {
    setDraft(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateGoal(i: number, val: string) {
    setDraft(prev => prev.map((g, idx) => idx === i ? val : g))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span style={{ color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Goals
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:text-[var(--cp-text-primary)] transition-colors"
          >
            <EditIcon /> Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => { setEditing(false); setDraft(goals); setNewGoal('') }}
              style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
              className="px-2 py-1 rounded-md text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold"
            >
              <CheckIcon /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((goal, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={goal}
                onChange={e => updateGoal(i, e.target.value)}
                style={{
                  background: 'var(--cp-code-bg)',
                  border: `1px solid ${color}30`,
                  color: 'var(--cp-text-primary)',
                  fontSize: '13px',
                }}
                className="flex-1 rounded-lg px-3 py-1.5 outline-none text-sm"
              />
              <button onClick={() => removeGoal(i)} style={{ color: '#ef4444' }} className="p-1 rounded hover:bg-red-500/10 transition-colors">
                <TrashIcon />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              placeholder="Add a goal…"
              style={{
                background: 'var(--cp-code-bg)',
                border: `1px dashed ${color}40`,
                color: 'var(--cp-text-primary)',
                fontSize: '13px',
              }}
              className="flex-1 rounded-lg px-3 py-1.5 outline-none text-sm placeholder-gray-600"
            />
            <button
              onClick={addGoal}
              style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold"
            >
              <PlusIcon /> Add
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {goals.length === 0 ? (
            <p style={{ color: 'var(--cp-text-dim)', fontSize: '13px', fontStyle: 'italic' }}>No goals set yet — click Edit to add some.</p>
          ) : (
            goals.map((goal, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div
                  style={{ background: accentBg, border: `1px solid ${color}40`, color, marginTop: '3px' }}
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                >
                  {i + 1}
                </div>
                <p style={{ color: 'var(--cp-text-secondary)', fontSize: '13px', lineHeight: '1.55' }}>{goal}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Agent with mission + KPIs ─────────────────────────────────────────────────

interface AgentWithMission {
  id: string
  name: string
  role: string
  model: string
  mission: string | null
}

function AgentKpiCard({
  agent,
  projectAgent,
  onSaveMission,
  onSaveKpis,
}: {
  agent: AgentWithMission
  projectAgent: ProjectAgent
  onSaveMission: (agentId: string, mission: string) => Promise<void>
  onSaveKpis: (projectId: string, agentId: string, kpis: string[]) => Promise<void>
}) {
  const [editingMission, setEditingMission] = useState(false)
  const [draftMission, setDraftMission] = useState(agent.mission || '')
  const [editingKpis, setEditingKpis] = useState(false)
  const [draftKpis, setDraftKpis] = useState<string[]>(projectAgent.kpis || [])
  const [newKpi, setNewKpi] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => { setDraftMission(agent.mission || '') }, [agent.mission])
  useEffect(() => { setDraftKpis(projectAgent.kpis || []) }, [projectAgent.kpis])

  async function saveMission() {
    setSaving(true)
    await onSaveMission(agent.id, draftMission)
    setSaving(false)
    setEditingMission(false)
  }

  async function saveKpis() {
    setSaving(true)
    await onSaveKpis(projectAgent.project_id, agent.id, draftKpis.filter(k => k.trim()))
    setSaving(false)
    setEditingKpis(false)
    setNewKpi('')
  }

  function addKpi() {
    if (newKpi.trim()) { setDraftKpis(prev => [...prev, newKpi.trim()]); setNewKpi('') }
  }

  const isOpus = agent.model.toLowerCase().includes('opus')
  const isSonnet = agent.model.toLowerCase().includes('sonnet')
  const modelColor = isOpus ? '#a78bfa' : isSonnet ? '#60a5fa' : '#34d399'
  const kpis = projectAgent.kpis || []

  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(8px)' }}
      className="rounded-xl overflow-hidden"
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          style={{ background: 'var(--cp-divider-accent)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--cp-text-accent-light)' }}
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
        >
          {agent.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">{agent.name}</span>
            <span style={{ color: modelColor, background: `${modelColor}15`, border: `1px solid ${modelColor}30` }} className="text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {isOpus ? 'Opus' : isSonnet ? 'Sonnet' : 'GPT-4o'}
            </span>
          </div>
          <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs truncate">{agent.role}</div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {kpis.length > 0 && (
            <span style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }} className="text-xs px-2 py-0.5 rounded-full font-semibold">
              {kpis.length} KPI{kpis.length !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ color: 'var(--cp-text-dim)' }}>
            <ChevronIcon open={expanded} />
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--cp-divider)' }} className="px-4 py-3 space-y-4">
          {/* Mission */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--cp-text-accent-light)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Agent Mission</span>
              {!editingMission ? (
                <button onClick={() => setEditingMission(true)} style={{ color: 'var(--cp-text-dim)' }} className="flex items-center gap-1 text-xs hover:text-[var(--cp-text-primary)]">
                  <EditIcon /> Edit
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingMission(false); setDraftMission(agent.mission || '') }} style={{ color: 'var(--cp-text-dim)' }} className="text-xs px-2 py-0.5 rounded">Cancel</button>
                  <button onClick={saveMission} disabled={saving} style={{ color: 'var(--cp-text-accent-light)' }} className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded">
                    <CheckIcon /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editingMission ? (
              <textarea
                value={draftMission}
                onChange={e => setDraftMission(e.target.value)}
                autoFocus rows={2}
                placeholder="Enter agent mission…"
                style={{ background: 'var(--cp-code-bg)', border: '1px solid rgba(167,139,250,0.3)', color: 'var(--cp-text-primary)', fontSize: '13px', resize: 'vertical' }}
                className="w-full rounded-lg px-3 py-2 outline-none"
              />
            ) : (
              <p style={{ color: agent.mission ? 'var(--cp-text-secondary)' : 'var(--cp-text-dim)', fontSize: '13px', lineHeight: '1.55', fontStyle: agent.mission ? 'normal' : 'italic' }}>
                {agent.mission || 'No mission yet'}
              </p>
            )}
          </div>

          {/* KPIs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: '#22d3ee', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>KPIs</span>
              {!editingKpis ? (
                <button onClick={() => setEditingKpis(true)} style={{ color: 'var(--cp-text-dim)' }} className="flex items-center gap-1 text-xs hover:text-[var(--cp-text-primary)]">
                  <EditIcon /> Edit
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingKpis(false); setDraftKpis(projectAgent.kpis || []); setNewKpi('') }} style={{ color: 'var(--cp-text-dim)' }} className="text-xs px-2 py-0.5 rounded">Cancel</button>
                  <button onClick={saveKpis} disabled={saving} style={{ color: '#22d3ee' }} className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded">
                    <CheckIcon /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editingKpis ? (
              <div className="space-y-1.5">
                {draftKpis.map((kpi, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={kpi}
                      onChange={e => setDraftKpis(prev => prev.map((k, j) => j === i ? e.target.value : k))}
                      style={{ background: 'var(--cp-code-bg)', border: '1px solid rgba(34,211,238,0.25)', color: 'var(--cp-text-primary)', fontSize: '12px' }}
                      className="flex-1 rounded-lg px-2.5 py-1.5 outline-none"
                    />
                    <button onClick={() => setDraftKpis(prev => prev.filter((_, j) => j !== i))} style={{ color: '#ef4444' }} className="p-0.5 rounded hover:bg-red-500/10">
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    value={newKpi}
                    onChange={e => setNewKpi(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKpi()}
                    placeholder="Add KPI…"
                    style={{ background: 'var(--cp-code-bg)', border: '1px dashed rgba(34,211,238,0.3)', color: 'var(--cp-text-primary)', fontSize: '12px' }}
                    className="flex-1 rounded-lg px-2.5 py-1.5 outline-none placeholder-gray-600"
                  />
                  <button onClick={addKpi} style={{ color: '#22d3ee' }} className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded">
                    <PlusIcon /> Add
                  </button>
                </div>
              </div>
            ) : kpis.length === 0 ? (
              <p style={{ color: 'var(--cp-text-dim)', fontSize: '12px', fontStyle: 'italic' }}>No KPIs defined</p>
            ) : (
              <ul className="space-y-1">
                {kpis.map((kpi, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span style={{ color: '#22d3ee', marginTop: '2px' }}>›</span>
                    <span style={{ color: 'var(--cp-text-secondary)', fontSize: '12px', lineHeight: '1.5' }}>{kpi}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  projectAgents,
  agents,
  companyMission,
  companyVision,
  onSaveProject,
  onSaveMission,
  onSaveKpis,
}: {
  project: Project
  projectAgents: ProjectAgent[]
  agents: AgentWithMission[]
  companyMission: string
  companyVision: string
  onSaveProject: (id: string, updates: Partial<Project>) => Promise<void>
  onSaveMission: (agentId: string, mission: string) => Promise<void>
  onSaveKpis: (projectId: string, agentId: string, kpis: string[]) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(true)
  const agentIds = new Set(projectAgents.filter(pa => pa.project_id === project.id).map(pa => pa.agent_id))
  const projectAgentsList = projectAgents.filter(pa => pa.project_id === project.id)
  const projectAgentItems = agents.filter(a => agentIds.has(a.id))

  const inheritColor = '#34d399'
  const goalsColor = '#f59e0b'

  async function toggleInherit() {
    await onSaveProject(project.id, { inherit_company_mission: !project.inherit_company_mission })
  }

  return (
    <div
      style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }}
      className="rounded-2xl overflow-hidden"
    >
      {/* Project header */}
      <div
        style={{ borderBottom: '1px solid var(--cp-divider)' }}
        className="px-5 py-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              style={{ background: `${project.color}15`, border: `1px solid ${project.color}30` }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            >
              {project.icon}
            </div>
            <div>
              <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-base">{project.name}</div>
              {project.description && (
                <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5 line-clamp-1">{project.description}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Inherit toggle */}
            <button
              onClick={toggleInherit}
              style={{
                color: project.inherit_company_mission ? inheritColor : 'var(--cp-text-dim)',
                background: project.inherit_company_mission ? `${inheritColor}12` : 'var(--cp-card-bg)',
                border: `1px solid ${project.inherit_company_mission ? inheritColor + '35' : 'var(--cp-border-subtle)'}`,
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              title="Toggle inherit company mission"
            >
              <span style={{ fontSize: '10px' }}>↑</span>
              {project.inherit_company_mission ? 'Inheriting' : 'Custom'}
            </button>
            <button onClick={() => setExpanded(e => !e)} style={{ color: 'var(--cp-text-dim)' }} className="p-1.5">
              <ChevronIcon open={expanded} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-6">
          {/* Mission / Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mission column */}
            <div
              style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: '12px', padding: '16px' }}
            >
              {project.inherit_company_mission ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: 'var(--cp-text-accent-light)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Mission</span>
                    <span style={{ color: inheritColor, fontSize: '9px', background: `${inheritColor}15`, border: `1px solid ${inheritColor}30`, padding: '1px 6px', borderRadius: '999px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inherited</span>
                  </div>
                  <p style={{ color: companyMission ? 'var(--cp-text-secondary)' : 'var(--cp-text-dim)', fontSize: '13px', lineHeight: '1.6', fontStyle: companyMission ? 'normal' : 'italic' }}>
                    {companyMission || 'No company mission set'}
                  </p>
                </div>
              ) : (
                <EditableText
                  label="Mission"
                  value={project.mission || ''}
                  onSave={v => onSaveProject(project.id, { mission: v })}
                  color="#a78bfa"
                  placeholder="Add a custom mission for this project…"
                />
              )}
            </div>

            {/* Vision column */}
            <div
              style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)', borderRadius: '12px', padding: '16px' }}
            >
              {project.inherit_company_mission ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: '#22d3ee', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Vision</span>
                    <span style={{ color: inheritColor, fontSize: '9px', background: `${inheritColor}15`, border: `1px solid ${inheritColor}30`, padding: '1px 6px', borderRadius: '999px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inherited</span>
                  </div>
                  <p style={{ color: companyVision ? 'var(--cp-text-secondary)' : 'var(--cp-text-dim)', fontSize: '13px', lineHeight: '1.6', fontStyle: companyVision ? 'normal' : 'italic' }}>
                    {companyVision || 'No company vision set'}
                  </p>
                </div>
              ) : (
                <EditableText
                  label="Vision"
                  value={project.vision || ''}
                  onSave={v => onSaveProject(project.id, { vision: v })}
                  color="#22d3ee"
                  placeholder="Add a custom vision for this project…"
                />
              )}
            </div>
          </div>

          {/* Project Goals */}
          <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: '12px', padding: '16px' }}>
            <GoalsList
              goals={project.goals || []}
              onSave={goals => onSaveProject(project.id, { goals })}
              color={goalsColor}
              accentBg="rgba(245,158,11,0.15)"
            />
          </div>

          {/* Agents */}
          {projectAgentItems.length > 0 && (
            <div>
              <p style={{ color: 'var(--cp-text-nav-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Agents ({projectAgentItems.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {projectAgentItems.map(agent => {
                  const pa = projectAgentsList.find(p => p.agent_id === agent.id)!
                  return (
                    <AgentKpiCard
                      key={agent.id}
                      agent={agent}
                      projectAgent={pa}
                      onSaveMission={onSaveMission}
                      onSaveKpis={onSaveKpis}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MissionPage() {
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [agents, setAgents] = useState<AgentWithMission[]>([])
  const [loading, setLoading] = useState(true)
  const { projects, projectAgents, selectedProjectId, refresh: refreshProjects } = useProject()

  useEffect(() => {
    async function load() {
      const [companyData, agentsData] = await Promise.all([
        fetchCompanySettings(),
        supabase.from('agents').select('id, name, role, model, mission').order('name'),
      ])
      setCompany(companyData)
      setAgents((agentsData.data || []) as AgentWithMission[])
      setLoading(false)
    }
    load()
  }, [])

  const saveCompany = useCallback(async (updates: Partial<Pick<CompanySettings, 'mission' | 'vision' | 'goals'>>) => {
    await updateCompanySettings(updates)
    setCompany(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  const saveProject = useCallback(async (id: string, updates: Partial<Project>) => {
    await updateProject(id, updates as Parameters<typeof updateProject>[1])
    await refreshProjects()
  }, [refreshProjects])

  const saveAgentMission = useCallback(async (agentId: string, mission: string) => {
    await supabase.from('agents').update({ mission }).eq('id', agentId)
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, mission } : a))
  }, [])

  const saveKpis = useCallback(async (projectId: string, agentId: string, kpis: string[]) => {
    await updateProjectAgent(projectId, agentId, { kpis })
    await refreshProjects()
  }, [refreshProjects])

  const visibleProjects = selectedProjectId
    ? projects.filter(p => p.id === selectedProjectId)
    : projects

  const companyMission = company?.mission || ''
  const companyVision = company?.vision || ''
  const companyGoals = company?.goals || []

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">Mission & Vision</h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5">Purpose, direction, and goals across the entire agent network</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm text-center py-20">Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* ── Company card ── */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(34,211,238,0.04) 100%)',
              border: '1px solid rgba(124,58,237,0.2)',
              backdropFilter: 'blur(16px)',
            }}
            className="rounded-2xl p-6"
          >
            {/* Company header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
              >
                🏢
              </div>
              <div>
                <div style={{ color: 'var(--cp-text-primary)' }} className="font-bold text-lg">{company?.name || COMPANY_NAME}</div>
                <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium">Company — Top level</div>
              </div>
            </div>

            {/* Mission + Vision grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '14px', padding: '18px' }}>
                <EditableText
                  label="Mission"
                  value={companyMission}
                  onSave={v => saveCompany({ mission: v })}
                  large
                  color="#a78bfa"
                  placeholder="Define the company mission…"
                />
              </div>
              <div style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: '14px', padding: '18px' }}>
                <EditableText
                  label="Vision"
                  value={companyVision}
                  onSave={v => saveCompany({ vision: v })}
                  large
                  color="#22d3ee"
                  placeholder="Define the company vision…"
                />
              </div>
            </div>

            {/* Company Goals */}
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', padding: '18px' }}>
              <GoalsList
                goals={companyGoals}
                onSave={goals => saveCompany({ goals })}
                color="#f59e0b"
                accentBg="rgba(245,158,11,0.15)"
              />
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-4">
            <div style={{ flex: 1, height: '1px', background: 'var(--cp-border)' }} />
            <span style={{ color: 'var(--cp-text-nav-label)' }} className="text-xs font-bold uppercase tracking-widest">
              {visibleProjects.length} Project{visibleProjects.length !== 1 ? 's' : ''}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--cp-border)' }} />
          </div>

          {/* ── Project cards ── */}
          {visibleProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              projectAgents={projectAgents}
              agents={agents}
              companyMission={companyMission}
              companyVision={companyVision}
              onSaveProject={saveProject}
              onSaveMission={saveAgentMission}
              onSaveKpis={saveKpis}
            />
          ))}
        </div>
      )}
    </div>
  )
}
