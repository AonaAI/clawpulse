import { AGENTS } from '@/lib/data'
import type { Agent, AgentStatus } from '@/lib/types'

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = {
    working: { dot: '#4ade80', text: 'Working', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' },
    waiting: { dot: '#facc15', text: 'Waiting', color: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
    idle: { dot: '#6b7280', text: 'Idle', color: '#9ca3af', bg: 'rgba(107, 114, 128, 0.1)' },
  }[status]

  return (
    <span
      style={{ background: config.bg, color: config.color }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
    >
      <span
        style={{
          background: config.dot,
          boxShadow: status === 'working' ? `0 0 6px ${config.dot}` : 'none',
        }}
        className="w-1.5 h-1.5 rounded-full inline-block"
      />
      {config.text}
    </span>
  )
}

function ModelBadge({ model }: { model: string }) {
  const isOpus = model.includes('Opus')
  const isSonnet = model.includes('Sonnet')
  const color = isOpus ? '#c084fc' : isSonnet ? '#60a5fa' : '#34d399'
  return (
    <span
      style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
      className="text-xs px-2 py-0.5 rounded-full font-medium"
    >
      {model}
    </span>
  )
}

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <div
      style={{ borderBottom: '1px solid #2d1054' }}
      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-6 px-6 py-4 hover:bg-[rgba(100,18,166,0.05)] transition-colors group"
    >
      {/* Avatar + name */}
      <div
        style={{
          background: agent.avatar_color,
          boxShadow: `0 0 12px ${agent.avatar_color}40`,
        }}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: '#f0e6ff' }} className="font-semibold">{agent.name}</span>
          <span style={{ color: '#5c3d7a', fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {agent.id}
          </span>
        </div>
        <div style={{ color: '#9d7bbd' }} className="text-sm">{agent.role}</div>
        {agent.current_task && (
          <div style={{ color: '#6b4e8a' }} className="text-xs mt-0.5 truncate">↳ {agent.current_task}</div>
        )}
      </div>

      <div className="flex-shrink-0">
        <ModelBadge model={agent.model} />
      </div>

      <div className="flex-shrink-0 text-right">
        <div style={{ color: '#5c3d7a' }} className="text-xs">{agent.last_activity ?? 'Never'}</div>
        <div style={{ color: '#3d2557' }} className="text-xs mt-0.5 font-mono">{agent.workspace}</div>
      </div>

      <div className="flex-shrink-0">
        <StatusBadge status={agent.status} />
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      style={{ background: '#1a0533', border: '1px solid #2d1054' }}
      className="rounded-xl overflow-hidden hover:border-[#6412A6] transition-colors"
    >
      {/* Card header */}
      <div
        style={{ background: `linear-gradient(135deg, ${agent.avatar_color}20, ${agent.avatar_color}05)`, borderBottom: '1px solid #2d1054' }}
        className="p-5"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              style={{ background: agent.avatar_color, boxShadow: `0 0 16px ${agent.avatar_color}50` }}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base"
            >
              {agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#f0e6ff' }} className="font-bold text-base">{agent.name}</div>
              <div style={{ color: '#9d7bbd' }} className="text-sm">{agent.role}</div>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span style={{ color: '#7c5fa0' }} className="text-xs font-medium uppercase tracking-wide">Model</span>
          <ModelBadge model={agent.model} />
        </div>

        <div>
          <span style={{ color: '#7c5fa0' }} className="text-xs font-medium uppercase tracking-wide block mb-1.5">Workspace</span>
          <code style={{ color: '#9d7bbd', background: '#11021d', border: '1px solid #2d1054', fontSize: '11px' }}
            className="block px-2.5 py-1.5 rounded-lg font-mono truncate"
          >
            {agent.workspace}
          </code>
        </div>

        <div>
          <span style={{ color: '#7c5fa0' }} className="text-xs font-medium uppercase tracking-wide block mb-1.5">
            Slack channels ({agent.slack_channels.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {agent.slack_channels.map((ch) => (
              <span key={ch}
                style={{ color: '#9d7bbd', background: '#11021d', border: '1px solid #2d1054', fontSize: '11px' }}
                className="px-2 py-0.5 rounded-md font-mono"
              >
                {ch}
              </span>
            ))}
          </div>
        </div>

        {agent.spawn_permissions.length > 0 && (
          <div>
            <span style={{ color: '#7c5fa0' }} className="text-xs font-medium uppercase tracking-wide block mb-1.5">Can spawn</span>
            <div className="flex flex-wrap gap-1.5">
              {agent.spawn_permissions.map((id) => {
                const target = AGENTS.find(a => a.id === id)
                return (
                  <span key={id}
                    style={{ color: '#c084fc', background: 'rgba(100,18,166,0.15)', border: '1px solid rgba(100,18,166,0.3)', fontSize: '11px' }}
                    className="px-2 py-0.5 rounded-md"
                  >
                    {target?.name ?? id}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {agent.current_task && (
          <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }} className="rounded-lg p-3">
            <span style={{ color: '#4ade80' }} className="text-xs font-semibold uppercase tracking-wide block mb-1">Current task</span>
            <p style={{ color: '#9d7bbd' }} className="text-xs">{agent.current_task}</p>
          </div>
        )}

        {agent.last_activity && (
          <div style={{ color: '#5c3d7a' }} className="text-xs text-right">
            Last seen {agent.last_activity}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const working = AGENTS.filter(a => a.status === 'working').length
  const waiting = AGENTS.filter(a => a.status === 'waiting').length
  const idle = AGENTS.filter(a => a.status === 'idle').length

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f0e6ff' }} className="text-2xl font-bold tracking-tight">Agent Registry</h1>
        <p style={{ color: '#7c5fa0' }} className="text-sm mt-1">All agents in the ClawPulse network</p>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div style={{ background: '#1a0533', border: '1px solid #2d1054' }} className="rounded-lg px-4 py-2 flex items-center gap-2">
          <span style={{ color: '#7c5fa0' }} className="text-sm">Total</span>
          <span style={{ color: '#f0e6ff' }} className="text-sm font-bold">{AGENTS.length}</span>
        </div>
        <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }} className="rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          <span style={{ color: '#4ade80' }} className="text-sm font-medium">Working</span>
          <span style={{ color: '#4ade80' }} className="text-sm font-bold">{working}</span>
        </div>
        <div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }} className="rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
          <span style={{ color: '#facc15' }} className="text-sm font-medium">Waiting</span>
          <span style={{ color: '#facc15' }} className="text-sm font-bold">{waiting}</span>
        </div>
        <div style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)' }} className="rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
          <span style={{ color: '#9ca3af' }} className="text-sm font-medium">Idle</span>
          <span style={{ color: '#9ca3af' }} className="text-sm font-bold">{idle}</span>
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
