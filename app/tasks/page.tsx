'use client'

import { useEffect, useState } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchTasks } from '@/lib/supabase-client'
import type { Task, TaskStatus, TaskPriority } from '@/lib/types'

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: 'todo',        label: 'To Do',       color: '#9ca3af', bg: 'rgba(107, 114, 128, 0.06)', border: 'rgba(107, 114, 128, 0.18)' },
  { status: 'in_progress', label: 'In Progress',  color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.06)',  border: 'rgba(96, 165, 250, 0.18)'  },
  { status: 'done',        label: 'Done',         color: '#34d399', bg: 'rgba(52, 211, 153, 0.06)',  border: 'rgba(52, 211, 153, 0.18)'  },
  { status: 'blocked',     label: 'Blocked',      color: '#f87171', bg: 'rgba(248, 113, 113, 0.06)', border: 'rgba(248, 113, 113, 0.18)' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:      { label: 'Low',      color: '#6b7280' },
  medium:   { label: 'Medium',   color: '#3b82f6' },
  high:     { label: 'High',     color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' },
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span
      style={{
        color: cfg.color,
        background: `${cfg.color}12`,
        border: `1px solid ${cfg.color}30`,
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
    >
      <span style={{ background: cfg.color }} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />
      {cfg.label}
    </span>
  )
}

function TaskCard({ task }: { task: Task }) {
  const agent = AGENTS.find(a => a.id === task.assigned_agent)
  const priorityColor = PRIORITY_CONFIG[task.priority].color

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.025)',
        border: '1px solid rgba(109, 40, 217, 0.14)',
        borderLeft: `2px solid ${priorityColor}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-lg p-3.5 space-y-2.5 cursor-default"
    >
      <p style={{ color: '#e9e2ff' }} className="text-sm font-medium leading-snug">{task.title}</p>

      {task.description && (
        <p style={{ color: '#6b7280' }} className="text-xs leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <PriorityBadge priority={task.priority} />
        <span
          style={{
            color: '#6b7280',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '10px',
            fontWeight: 600,
          }}
          className="px-2 py-0.5 rounded-md"
        >
          {task.project}
        </span>
      </div>

      {agent && (
        <div
          className="flex items-center gap-2 pt-2"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
        >
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.14)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              width: '20px',
              height: '20px',
              minWidth: '20px',
              fontSize: '9px',
              color: '#8b5cf6',
            }}
            className="rounded-md flex items-center justify-center font-bold"
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ color: '#6b7280' }} className="text-xs font-medium">{agent.name}</span>
          <span style={{ color: '#374151', fontSize: '11px' }} className="ml-auto">{agent.role}</span>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  label, color, bg, border, tasks,
}: {
  status: TaskStatus; label: string; color: string; bg: string; border: string; tasks: Task[]
}) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          backdropFilter: 'blur(12px)',
        }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span
            style={{ background: color, boxShadow: `0 0 6px ${color}55` }}
            className="w-2 h-2 rounded-full inline-block"
          />
          <span style={{ color }} className="text-sm font-semibold">{label}</span>
        </div>
        <span
          style={{
            color,
            background: `${color}18`,
            border: `1px solid ${color}35`,
          }}
          className="text-xs px-2 py-0.5 rounded-full font-bold"
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          background: 'rgba(10, 1, 24, 0.55)',
          border: `1px solid ${border}`,
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '0 0 12px 12px',
          backdropFilter: 'blur(12px)',
        }}
        className="flex-1 p-3 space-y-2.5 min-h-[400px]"
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <span style={{ color: '#1f2937' }} className="text-xs font-medium">No tasks</span>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    async function loadTasks() {
      const data = await fetchTasks()
      setTasks(data)
    }
    loadTasks()
  }, [])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length
  const criticalTasks = tasks.filter(t => t.priority === 'critical').length

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Work Board</h1>
        <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">Kanban board across all agents and projects</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {[
          { label: 'Total',     value: totalTasks,    color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.06)', border: 'rgba(167, 139, 250, 0.18)' },
          { label: 'Completed', value: doneTasks,     color: '#34d399', bg: 'rgba(52, 211, 153, 0.06)',  border: 'rgba(52, 211, 153, 0.18)'  },
          { label: 'Blocked',   value: blockedTasks,  color: '#f87171', bg: 'rgba(248, 113, 113, 0.06)', border: 'rgba(248, 113, 113, 0.18)' },
          { label: 'Critical',  value: criticalTasks, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.06)',  border: 'rgba(251, 191, 36, 0.18)'  },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: stat.bg,
              border: `1px solid ${stat.border}`,
              backdropFilter: 'blur(12px)',
            }}
            className="rounded-xl px-4 py-2 flex items-center gap-2.5"
          >
            <span style={{ color: '#6b7280' }} className="text-sm font-medium">{stat.label}</span>
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
            tasks={tasks.filter(t => t.status === col.status)}
          />
        ))}
      </div>
    </div>
  )
}
