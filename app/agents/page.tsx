'use client'

import { useEffect, useState } from 'react'
import { AGENTS } from '@/lib/data'
import type { AgentStatus, AgentLive, MergedAgent } from '@/lib/types'

const POLL_INTERVAL = 30_000

function formatLastActive(ms: number | null): string {
  if (ms === null) return 'Never'
  const ago = Date.now() - ms
  if (ago < 60_000) return 'Just now'
  if (ago < 3_600_000) return `${Math.floor(ago / 60_000)} min ago`
  if (ago < 86_400_000) return `${Math.floor(ago / 3_600_000)} hr ago`
  return `${Math.floor(ago / 86_400_000)}d ago`
}

function mergeLiveData(live: (AgentLive & { dir: string })[]): MergedAgent[] {
  const liveMap = new Map(live.map(d => [d.dir, d]))
  return AGENTS.map(agent => {
    const lookup = agent.dir ?? agent.id
    const data = liveMap.get(lookup)
    return {
      ...agent,
      status: (data?.status ?? 'offline') as AgentStatus,
      sessionCount: data?.sessionCount ?? 0,
      lastActive: data?.lastActive ?? null,
      totalTokens: data?.totalTokens ?? 0,
    }
  })
}

const OFFLINE_AGENTS: MergedAgent[] = AGENTS.map(a => ({
  ...a,
  status: 'offline' as AgentStatus,
  sessionCount: 0,
  lastActive: null,
  totalTokens: 0,
}))

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = {
    working: {
      dot: '#34d399',
      text: 'Working',
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.08)',
      border: 'rgba(52, 211, 153, 0.25)',
      pulse: true,
    },
    idle: {
      dot: '#4b5563',
      text: 'Idle',
      color: '#6b7280',
      bg: 'rgba(75, 85, 99, 0.06)',
      border: 'rgba(75, 85, 99, 0.2)',
      pulse: false,
    },
    offline: {
      dot: '#374151',
      text: 'Offline',
      color: '#4b5563',
      bg: 'rgba(55, 65, 81, 0.04)',
      border: 'rgba(55, 65, 81, 0.15)',
      pulse: false,
    },
  }[status]

  return (
    <span
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      <span
        style={{ background: config.dot }}
        className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${config.pulse ? 'status-glow-working' : ''}`}
      />
      {config.text}
    </span>
  )
}

function ModelBadge({ model }: { model: string }) {
  const isOpus = model.includes('Opus')
  const isSonnet = model.includes('Sonnet')
  const color = isOpus ? '#a78bfa' : isSonnet ? '#60a5fa' : '#34d399'
  const bg = isOpus
    ? 'rgba(167, 139, 250, 0.08)'
    : isSonnet
    ? 'rgba(96, 165, 250, 0.08)'
    : 'rgba(52, 211, 153, 0.08)'
  const border = isOpus
    ? 'rgba(167, 139, 250, 0.2)'
    : isSonnet
    ? 'rgba(96, 165, 250, 0.2)'
    : 'rgba(52, 211, 153, 0.2)'
  return (
    <span
      style={{ color, background: bg, border: `1px solid ${border}` }}
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
    >
      {model}
    </span>
  )
}

function AgentCard({ agent }: { agent: MergedAgent }) {
  const isWorking = agent.status === 'working'
  const initials = agent.name.slice(0, 2).toUpperCase()

  return (
    <div
      style={{
        background: isWorking ? 'rgba(124, 58, 237, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.28)' : 'rgba(109, 40, 217, 0.14)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: isWorking
          ? '0 0 0 1px rgba(139, 92, 246, 0.06), 0 8px 32px rgba(0, 0, 0, 0.4)'
          : '0 4px 24px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-xl overflow-hidden hover:border-[rgba(139,92,246,0.4)]"
    >
      {/* Card header */}
      <div
        style={{
          background: isWorking
            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(79, 46, 220, 0.04) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%)',
          borderBottom: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)'}`,
        }}
        className="p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                background: isWorking
                  ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(79, 46, 220, 0.15) 100%)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                boxShadow: isWorking ? '0 0 20px rgba(124, 58, 237, 0.25)' : 'none',
                color: isWorking ? '#c4b5fd' : '#6b7280',
              }}
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div style={{ color: '#f8f4ff' }} className="font-bold text-base leading-tight">{agent.name}</div>
              <div style={{ color: '#6b7280' }} className="text-sm mt-0.5">{agent.role}</div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={agent.status} />
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span style={{ color: '#4b5563' }} className="text-xs font-semibold uppercase tracking-wider">Model</span>
          <ModelBadge model={agent.model} />
        </div>

        <div>
          <span style={{ color: '#4b5563' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Workspace</span>
          <code
            style={{
              color: '#6b7280',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
            }}
            className="block px-2.5 py-1.5 rounded-lg font-mono truncate"
          >
            {agent.workspace}
          </code>
        </div>

        {agent.slack_channels.length > 0 && (
          <div>
            <span style={{ color: '#4b5563' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">
              Slack channels ({agent.slack_channels.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {agent.slack_channels.map((ch) => (
                <span
                  key={ch}
                  style={{
                    color: '#6b7280',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '11px',
                  }}
                  className="px-2 py-0.5 rounded-md font-mono"
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        )}

        {agent.spawn_permissions.length > 0 && (
          <div>
            <span style={{ color: '#4b5563' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Can spawn</span>
            <div className="flex flex-wrap gap-1.5">
              {agent.spawn_permissions.map((id) => {
                const target = AGENTS.find(a => a.id === id)
                return (
                  <span
                    key={id}
                    style={{
                      color: '#8b5cf6',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.22)',
                      fontSize: '11px',
                    }}
                    className="px-2 py-0.5 rounded-md font-semibold"
                  >
                    {target?.name ?? id}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            {agent.sessionCount > 0 ? (
              <span style={{ color: '#6b7280' }} className="text-xs font-medium">
                {agent.sessionCount} sessions
              </span>
            ) : (
              <span style={{ color: '#374151' }} className="text-xs">No sessions</span>
            )}
          </div>
          {agent.lastActive !== null && (
            <div style={{ color: '#374151' }} className="text-xs font-medium">
              Last seen {formatLastActive(agent.lastActive)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<MergedAgent[]>(OFFLINE_AGENTS)
  const [apiError, setApiError] = useState(false)

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents')
        if (!res.ok) throw new Error('non-ok response')
        const live = await res.json()
        setAgents(mergeLiveData(live))
        setApiError(false)
      } catch {
        setApiError(true)
      }
    }

    fetchAgents()
    const id = setInterval(fetchAgents, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const working = agents.filter(a => a.status === 'working').length
  const idle = agents.filter(a => a.status === 'idle').length
  const offline = agents.filter(a => a.status === 'offline').length

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Agent Registry</h1>
        <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">All agents in the ClawPulse network</p>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(109, 40, 217, 0.18)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-xl px-4 py-2 flex items-center gap-2.5"
        >
          <span style={{ color: '#6b7280' }} className="text-sm font-medium">Total</span>
          <span style={{ color: '#f8f4ff' }} className="text-sm font-bold">{agents.length}</span>
        </div>
        <div
          style={{
            background: 'rgba(52, 211, 153, 0.06)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-xl px-4 py-2 flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block status-glow-working" />
          <span style={{ color: '#34d399' }} className="text-sm font-semibold">Working</span>
          <span style={{ color: '#34d399' }} className="text-sm font-bold">{working}</span>
        </div>
        <div
          style={{
            background: 'rgba(75, 85, 99, 0.06)',
            border: '1px solid rgba(75, 85, 99, 0.2)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-xl px-4 py-2 flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
          <span style={{ color: '#9ca3af' }} className="text-sm font-semibold">Idle</span>
          <span style={{ color: '#9ca3af' }} className="text-sm font-bold">{idle}</span>
        </div>
        <div
          style={{
            background: 'rgba(55, 65, 81, 0.04)',
            border: '1px solid rgba(55, 65, 81, 0.2)',
            backdropFilter: 'blur(12px)',
          }}
          className="rounded-xl px-4 py-2 flex items-center gap-2.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gray-700 inline-block" />
          <span style={{ color: '#4b5563' }} className="text-sm font-semibold">Offline</span>
          <span style={{ color: '#4b5563' }} className="text-sm font-bold">{offline}</span>
        </div>
      </div>

      {apiError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
          }}
          className="rounded-xl px-4 py-3 text-xs font-medium mb-6"
        >
          Could not reach /api/agents — run <code className="font-mono">next dev</code> for live data. Showing offline state.
        </div>
      )}

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
