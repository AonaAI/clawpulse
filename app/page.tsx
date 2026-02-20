import { AGENTS, ACTIVITY_LOG, SAMPLE_TASKS } from '@/lib/data'
import type { Agent, AgentStatus } from '@/lib/types'

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = {
    working: { dot: '#4ade80', text: 'Working', bg: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' },
    waiting: { dot: '#facc15', text: 'Waiting', bg: 'rgba(250, 204, 21, 0.1)', color: '#facc15' },
    idle: { dot: '#6b7280', text: 'Idle', bg: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af' },
  }[status]

  return (
    <span
      style={{ background: config.bg, color: config.color }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
    >
      <span style={{ background: config.dot, boxShadow: status === 'working' ? `0 0 6px ${config.dot}` : 'none' }}
        className="w-1.5 h-1.5 rounded-full inline-block" />
      {config.text}
    </span>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const initials = agent.name.slice(0, 2).toUpperCase()

  return (
    <div
      style={{
        background: '#1a0533',
        border: '1px solid #2d1054',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-xl p-4 flex flex-col gap-3 hover:border-[#6412A6] hover:shadow-lg group cursor-default"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            style={{ background: agent.avatar_color, boxShadow: `0 0 12px ${agent.avatar_color}40` }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          >
            {initials}
          </div>
          <div>
            <div style={{ color: '#f0e6ff' }} className="font-semibold text-sm">{agent.name}</div>
            <div style={{ color: '#7c5fa0' }} className="text-xs">{agent.role}</div>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span style={{ color: '#5c3d7a', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Model</span>
          <span style={{ color: '#9d7bbd', background: '#2d1054', padding: '1px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 500 }}>
            {agent.model}
          </span>
        </div>
        {agent.current_task && (
          <div style={{ color: '#9d7bbd' }} className="text-xs truncate" title={agent.current_task}>
            ↳ {agent.current_task}
          </div>
        )}
        {agent.last_activity && (
          <div style={{ color: '#5c3d7a' }} className="text-xs">
            Last seen {agent.last_activity}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityItem({ item }: { item: typeof ACTIVITY_LOG[0] }) {
  const agent = AGENTS.find(a => a.id === item.agent_id)
  const color = agent?.avatar_color ?? '#6412A6'

  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #1a0533' }}>
      <div
        style={{ background: color, width: '28px', height: '28px', minWidth: '28px' }}
        className="rounded-lg flex items-center justify-center text-white text-xs font-bold"
      >
        {item.agent_name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span style={{ color: '#e0c8ff' }} className="text-sm font-medium">{item.agent_name}</span>
          <span style={{ color: '#5c3d7a' }} className="text-xs flex-shrink-0">{item.time}</span>
        </div>
        <div style={{ color: '#c084fc' }} className="text-xs font-medium">{item.action}</div>
        <div style={{ color: '#7c5fa0' }} className="text-xs truncate">{item.details}</div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const workingAgents = AGENTS.filter(a => a.status === 'working')
  const waitingAgents = AGENTS.filter(a => a.status === 'waiting')
  const activeTasks = SAMPLE_TASKS.filter(t => t.status === 'in_progress')
  const doneTasks = SAMPLE_TASKS.filter(t => t.status === 'done')

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f0e6ff' }} className="text-2xl font-bold tracking-tight">Overview</h1>
        <p style={{ color: '#7c5fa0' }} className="text-sm mt-1">Real-time status of your agent network</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Agents', value: AGENTS.length, color: '#c084fc', icon: '◎' },
          { label: 'Active Now', value: workingAgents.length, color: '#4ade80', icon: '⚡' },
          { label: 'Waiting', value: waitingAgents.length, color: '#facc15', icon: '⏳' },
          { label: 'Tasks Done', value: doneTasks.length, color: '#a78bfa', icon: '✓' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{ background: '#1a0533', border: '1px solid #2d1054' }}
            className="rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: '#7c5fa0' }} className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
              <span style={{ color: stat.color, opacity: 0.8 }} className="text-sm">{stat.icon}</span>
            </div>
            <div style={{ color: stat.color }} className="text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Agent grid */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ color: '#e0c8ff' }} className="font-semibold text-base">Agent Status</h2>
            <span style={{ color: '#7c5fa0', background: '#1a0533', border: '1px solid #2d1054' }}
              className="text-xs px-2 py-0.5 rounded-full">
              {AGENTS.length} agents
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Active tasks */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: '#e0c8ff' }} className="font-semibold text-base">Active Tasks</h2>
              <span style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
                className="text-xs px-2 py-0.5 rounded-full font-medium">
                {activeTasks.length} in progress
              </span>
            </div>
            <div style={{ background: '#1a0533', border: '1px solid #2d1054' }} className="rounded-xl divide-y">
              {activeTasks.map((task) => {
                const agent = AGENTS.find(a => a.id === task.assigned_agent)
                const priorityColor = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' }[task.priority]
                return (
                  <div key={task.id} className="p-3 flex items-start gap-3">
                    <div style={{ background: priorityColor, width: '3px', minWidth: '3px', borderRadius: '2px' }} className="mt-1 h-4" />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: '#e0c8ff' }} className="text-sm font-medium truncate">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span style={{ color: '#9d7bbd', background: '#2d1054', padding: '1px 6px', borderRadius: '999px', fontSize: '10px' }}>
                          {agent?.name ?? task.assigned_agent}
                        </span>
                        <span style={{ color: '#5c3d7a', fontSize: '11px' }}>{task.project}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity feed */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: '#e0c8ff' }} className="font-semibold text-base">Activity Feed</h2>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
              </span>
            </div>
            <div style={{ background: '#1a0533', border: '1px solid #2d1054' }} className="rounded-xl px-4 overflow-hidden">
              {ACTIVITY_LOG.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
