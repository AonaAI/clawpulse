import { AGENTS, SAMPLE_TASKS } from '@/lib/data'
import type { Task, TaskStatus, TaskPriority } from '@/lib/types'

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: 'todo',        label: 'To Do',       color: '#9ca3af', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
  { status: 'in_progress', label: 'In Progress',  color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
  { status: 'done',        label: 'Done',         color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.2)'  },
  { status: 'blocked',     label: 'Blocked',      color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low:      { label: 'Low',      color: '#6b7280', dot: '#6b7280' },
  medium:   { label: 'Medium',   color: '#3b82f6', dot: '#3b82f6' },
  high:     { label: 'High',     color: '#f59e0b', dot: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444', dot: '#ef4444' },
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span
      style={{ color: cfg.color, background: `${cfg.dot}18`, border: `1px solid ${cfg.dot}33` }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
    >
      <span style={{ background: cfg.dot }} className="w-1.5 h-1.5 rounded-full inline-block" />
      {cfg.label}
    </span>
  )
}

function TaskCard({ task }: { task: Task }) {
  const agent = AGENTS.find(a => a.id === task.assigned_agent)
  const priorityColor = PRIORITY_CONFIG[task.priority].color

  return (
    <div
      style={{ background: '#1a0533', border: '1px solid #2d1054', borderLeft: `3px solid ${priorityColor}` }}
      className="rounded-lg p-3.5 space-y-2.5 hover:border-[#6412A6] transition-colors cursor-default group"
    >
      <p style={{ color: '#e0c8ff' }} className="text-sm font-medium leading-snug">{task.title}</p>

      {task.description && (
        <p style={{ color: '#7c5fa0' }} className="text-xs leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <PriorityBadge priority={task.priority} />
        <span
          style={{ color: '#9d7bbd', background: '#11021d', border: '1px solid #2d1054', fontSize: '10px' }}
          className="px-2 py-0.5 rounded-md font-medium"
        >
          {task.project}
        </span>
      </div>

      {agent && (
        <div className="flex items-center gap-2 pt-0.5" style={{ borderTop: '1px solid #2d1054' }}>
          <div
            style={{ background: agent.avatar_color, width: '20px', height: '20px', minWidth: '20px', fontSize: '9px' }}
            className="rounded-md flex items-center justify-center text-white font-bold"
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ color: '#7c5fa0' }} className="text-xs">{agent.name}</span>
          <span style={{ color: '#5c3d7a' }} className="text-xs ml-auto">{agent.role}</span>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  status, label, color, bg, border, tasks,
}: {
  status: TaskStatus; label: string; color: string; bg: string; border: string; tasks: Task[]
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        style={{ background: bg, border: `1px solid ${border}`, borderBottom: 'none', borderRadius: '12px 12px 0 0' }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span style={{ background: color }} className="w-2 h-2 rounded-full inline-block" />
          <span style={{ color }} className="text-sm font-semibold">{label}</span>
        </div>
        <span
          style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
          className="text-xs px-2 py-0.5 rounded-full font-bold"
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{ background: '#13022199', border: `1px solid ${border}`, borderTop: `1px solid ${border}40`, borderRadius: '0 0 12px 12px' }}
        className="flex-1 p-3 space-y-2.5 min-h-[400px]"
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <span style={{ color: '#3d2557' }} className="text-xs">No tasks</span>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const totalTasks = SAMPLE_TASKS.length
  const doneTasks = SAMPLE_TASKS.filter(t => t.status === 'done').length
  const blockedTasks = SAMPLE_TASKS.filter(t => t.status === 'blocked').length
  const criticalTasks = SAMPLE_TASKS.filter(t => t.priority === 'critical').length

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f0e6ff' }} className="text-2xl font-bold tracking-tight">Work Board</h1>
        <p style={{ color: '#7c5fa0' }} className="text-sm mt-1">Kanban board across all agents and projects</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {[
          { label: 'Total', value: totalTasks, color: '#c084fc' },
          { label: 'Completed', value: doneTasks, color: '#4ade80' },
          { label: 'Blocked', value: blockedTasks, color: '#f87171' },
          { label: 'Critical', value: criticalTasks, color: '#ef4444' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{ background: '#1a0533', border: '1px solid #2d1054' }}
            className="rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <span style={{ color: '#7c5fa0' }} className="text-sm">{stat.label}</span>
            <span style={{ color: stat.color }} className="text-sm font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            {...col}
            tasks={SAMPLE_TASKS.filter(t => t.status === col.status)}
          />
        ))}
      </div>
    </div>
  )
}
