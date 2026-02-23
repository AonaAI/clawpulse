'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProject } from '@/components/ProjectProvider'
import { fetchAgents } from '@/lib/supabase-client'

interface Agent {
  id: string
  name: string
  status: string
  type: string
  last_active: string | null
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRelative(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function ProjectDetailClient() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { projects, projectAgents, loading: projLoading } = useProject()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const project = projects.find(p => p.id === projectId)
  const agentIds = projectAgents.filter(pa => pa.project_id === projectId).map(pa => pa.agent_id)

  const load = useCallback(async () => {
    try {
      const allAgents = await fetchAgents()
      setAgents(allAgents as Agent[])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (projLoading || loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
        <div className="text-center py-20">
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">Project not found</p>
          <button
            onClick={() => router.push('/settings')}
            style={{ color: 'var(--cp-text-accent-light)' }}
            className="text-sm mt-2 hover:underline"
          >
            ← Back to Settings
          </button>
        </div>
      </div>
    )
  }

  const projectAgentsList = agents.filter(a => agentIds.includes(a.id))
  const activeAgents = projectAgentsList.filter(a => a.status === 'active' || a.status === 'working')

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => router.push('/settings')}
        style={{ color: 'var(--cp-text-muted)' }}
        className="flex items-center gap-1.5 text-sm mb-4 hover:text-violet-400 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Settings
      </button>

      <div className="flex items-start gap-4 mb-8">
        <div
          style={{ background: project.color ? `${project.color}20` : 'var(--cp-divider-accent)', border: `1px solid ${project.color || 'rgba(109,40,217,0.3)'}40` }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
        >
          {project.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 style={{ color: 'var(--cp-text-heading)' }} className="text-2xl font-bold tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">
              Created {fmtDate(project.created_at)}
            </span>
            <span
              style={{
                color: project.status === 'active' ? '#34d399' : 'var(--cp-text-muted)',
                background: project.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.08)',
                border: `1px solid ${project.status === 'active' ? 'rgba(52,211,153,0.25)' : 'rgba(156,163,175,0.2)'}`,
              }}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
            >
              {project.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Agents', value: projectAgentsList.length, icon: '🤖' },
          { label: 'Active', value: activeAgents.length, icon: '🟢' },
          { label: 'Goals', value: project.goals?.length ?? 0, icon: '🎯' },
          { label: 'Status', value: project.status, icon: '📊' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }} className="rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{s.icon}</span>
              <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium">{s.label}</span>
            </div>
            <div style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {(project.mission || (project.goals && project.goals.length > 0)) && (
        <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }} className="rounded-2xl p-6 mb-6">
          <h2 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-4">Mission & Goals</h2>
          {project.mission && (
            <div className="mb-4">
              <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-1">Mission</div>
              <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm leading-relaxed">{project.mission}</p>
            </div>
          )}
          {project.vision && (
            <div className="mb-4">
              <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-1">Vision</div>
              <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm leading-relaxed">{project.vision}</p>
            </div>
          )}
          {project.goals && project.goals.length > 0 && (
            <div>
              <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-2">Goals</div>
              <div className="space-y-2">
                {project.goals.map((goal, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span style={{ color: '#7c3aed' }} className="text-sm mt-0.5">●</span>
                    <span style={{ color: 'var(--cp-text-secondary)' }} className="text-sm">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-strong)' }} className="rounded-2xl p-6">
        <h2 style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-bold mb-4">
          Agents ({projectAgentsList.length})
        </h2>
        {projectAgentsList.length === 0 ? (
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">No agents assigned to this project</p>
        ) : (
          <div className="space-y-2">
            {projectAgentsList.map(agent => {
              const pa = projectAgents.find(p => p.project_id === projectId && p.agent_id === agent.id)
              return (
                <div
                  key={agent.id}
                  style={{ background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border)' }}
                  className="rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => router.push(`/agents/${agent.id}`)}
                >
                  <div
                    style={{
                      background: agent.status === 'active' || agent.status === 'working' ? 'rgba(52,211,153,0.15)' : 'rgba(156,163,175,0.08)',
                      border: `1px solid ${agent.status === 'active' || agent.status === 'working' ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.2)'}`,
                    }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                  >
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold truncate">{agent.name}</div>
                    <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5">
                      {pa?.role || agent.type} · Last active {fmtRelative(agent.last_active)}
                    </div>
                  </div>
                  <span style={{ color: agent.status === 'active' || agent.status === 'working' ? '#34d399' : 'var(--cp-text-dim)' }} className="text-xs font-medium">
                    {agent.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
