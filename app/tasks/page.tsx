'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { AGENTS } from '@/lib/data'
import { fetchTasks, createTask, updateTask, deleteTask } from '@/lib/supabase-client'
import { useTableSubscription } from '@/lib/useRealtimeSubscription'
import type { Task, TaskStatus, TaskPriority } from '@/lib/types'
import { useProject } from '@/components/ProjectProvider'

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: 'todo',        label: 'To Do',        color: 'var(--cp-text-secondary)', bg: 'rgba(107, 114, 128, 0.06)', border: 'rgba(107, 114, 128, 0.18)' },
  { status: 'in_progress', label: 'In Progress',  color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.06)',  border: 'rgba(96, 165, 250, 0.18)'  },
  { status: 'done',        label: 'Done',          color: '#34d399', bg: 'rgba(52, 211, 153, 0.06)',  border: 'rgba(52, 211, 153, 0.18)'  },
  { status: 'blocked',     label: 'Blocked',       color: '#f87171', bg: 'rgba(248, 113, 113, 0.06)', border: 'rgba(248, 113, 113, 0.18)' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:      { label: 'Low',      color: 'var(--cp-text-muted)' },
  medium:   { label: 'Medium',   color: '#3b82f6' },
  high:     { label: 'High',     color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' },
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']
const PROJECTS = ['ClawPulse', 'Infrastructure', 'Strategy', 'Content', 'Research', 'Growth', 'Sales', 'Design']

// ── Small components ───────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span
      style={{ color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
    >
      <span style={{ background: cfg.color }} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />
      {cfg.label}
    </span>
  )
}

function IconButton({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      className="p-1 rounded-md transition-colors"
      style={{
        color: danger ? '#f87171' : '#6b7280',
        background: 'transparent',
      }}
      onMouseEnter={e => { (e.target as HTMLElement).style.background = danger ? 'rgba(248,113,113,0.12)' : 'rgba(139,92,246,0.12)' }}
      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ── Task Card ──────────────────────────────────────────────────────────────

const TaskCard = memo(function TaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: (t: Task) => void; onDelete: (t: Task) => void }) {
  const agent = AGENTS.find(a => a.id === task.assigned_agent)
  const priorityColor = PRIORITY_CONFIG[task.priority].color

  return (
    <div
      style={{
        background: 'var(--cp-card-bg)',
        border: '1px solid var(--cp-border)',
        borderLeft: `2px solid ${priorityColor}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-lg p-3.5 space-y-2.5 group"
    >
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-2">
        <p style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <IconButton onClick={() => onEdit(task)} title="Edit">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </IconButton>
          <IconButton onClick={() => onDelete(task)} title="Delete" danger>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </IconButton>
        </div>
      </div>

      {task.description && (
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-xs leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <PriorityBadge priority={task.priority} />
        <span
          style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-tag-bg)', border: '1px solid var(--cp-border-subtle)', fontSize: '10px', fontWeight: 600 }}
          className="px-2 py-0.5 rounded-md"
        >{task.project}</span>
      </div>

      {agent && (
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--cp-divider)' }}>
          <div
            style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.2)', width: 20, height: 20, minWidth: 20, fontSize: 9, color: '#8b5cf6' }}
            className="rounded-md flex items-center justify-center font-bold"
          >{agent.name.slice(0, 2).toUpperCase()}</div>
          <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-medium">{agent.name}</span>
          <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 11 }} className="ml-auto">{agent.role}</span>
        </div>
      )}
    </div>
  )
})

// ── Modal / Form ───────────────────────────────────────────────────────────

interface TaskFormData {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  project: string
  assigned_agent: string
}

const emptyForm: TaskFormData = { title: '', description: '', priority: 'medium', status: 'todo', project: 'ClawPulse', assigned_agent: '' }

function TaskModal({
  open, task, onClose, onSave,
}: {
  open: boolean; task: Task | null; onClose: () => void; onSave: (data: TaskFormData, id?: string) => void
}) {
  const [form, setForm] = useState<TaskFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({ title: task.title, description: task.description || '', priority: task.priority, status: task.status, project: task.project, assigned_agent: task.assigned_agent || '' })
    } else {
      setForm(emptyForm)
    }
  }, [task, open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await onSave(form, task?.id)
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
        className="rounded-2xl w-full max-w-lg p-6"
      >
        <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-xl font-bold mb-5">{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title…" required />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}>
                {STATUSES.map(s => <option key={s} value={s}>{COLUMNS.find(c => c.status === s)!.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Project</label>
              <select style={inputStyle} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assigned Agent</label>
              <select style={inputStyle} value={form.assigned_agent} onChange={e => setForm(f => ({ ...f, assigned_agent: e.target.value }))}>
                <option value="">Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} — {a.role}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">Cancel</button>
            <button type="submit" disabled={saving || !form.title.trim()} style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', opacity: saving ? 0.6 : 1 }} className="px-5 py-2 rounded-lg text-sm font-semibold shadow-lg hover:opacity-90 transition-opacity">{saving ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirmation ────────────────────────────────────────────────────

function DeleteConfirm({ task, onClose, onConfirm }: { task: Task | null; onClose: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false)
  if (!task) return null
  return (
    <div style={{ background: 'var(--cp-overlay)', backdropFilter: 'blur(4px)' }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--cp-panel-bg)', border: '1px solid rgba(248,113,113,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} className="rounded-2xl w-full max-w-sm p-6">
        <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold mb-2">Delete Task</h2>
        <p style={{ color: 'var(--cp-text-secondary)' }} className="text-sm mb-5">Are you sure you want to delete <strong style={{ color: 'var(--cp-text-card-title)' }}>&quot;{task.title}&quot;</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} style={{ color: 'var(--cp-text-secondary)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">Cancel</button>
          <button disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }} style={{ background: '#dc2626', color: '#fff', opacity: deleting ? 0.6 : 1 }} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  const loadTasks = useCallback(async () => {
    const data = await fetchTasks()
    setTasks(data)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Realtime subscriptions for tasks
  useTableSubscription<Record<string, unknown>>(
    'tasks',
    {
      onInsert: useCallback((record: any) => {
        setTasks(prev => {
          if (prev.some(t => t.id === record.id)) return prev
          return [record, ...prev]
        })
      }, []),
      onUpdate: useCallback((record: any) => {
        setTasks(prev => prev.map(t => t.id === record.id ? { ...t, ...record } : t))
      }, []),
      onDelete: useCallback((old: any) => {
        if (old.id) setTasks(prev => prev.filter(t => t.id !== old.id))
      }, []),
    },
  )

  // ── Drag end ─────────────────────────────────────────────────────────────
  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination, source } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return

    const newStatus = destination.droppableId as TaskStatus

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t))

    const updated = await updateTask(draggableId, { status: newStatus })
    if (!updated) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: source.droppableId as TaskStatus } : t))
    }
  }, [])

  // ── CRUD handlers ────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data: TaskFormData, id?: string) => {
    if (id) {
      const updated = await updateTask(id, { title: data.title, description: data.description || null, priority: data.priority, status: data.status, project: data.project, assigned_agent: data.assigned_agent || null })
      if (updated) setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
    } else {
      const created = await createTask({ title: data.title, description: data.description || null, status: data.status, priority: data.priority, project: data.project, assigned_agent: data.assigned_agent || null, created_by: 'main' })
      if (created) setTasks(prev => [created, ...prev])
    }
    setModalOpen(false)
    setEditingTask(null)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deletingTask) return
    const ok = await deleteTask(deletingTask.id)
    if (ok) setTasks(prev => prev.filter(t => t.id !== deletingTask.id))
    setDeletingTask(null)
  }, [deletingTask])

  const { selectedProjectId, agentIdsForProject } = useProject()
  const projectAgentIds = selectedProjectId ? new Set(agentIdsForProject(selectedProjectId)) : null
  const visibleTasks = projectAgentIds ? tasks.filter(t => t.assigned_agent && projectAgentIds.has(t.assigned_agent)) : tasks

  const totalTasks = visibleTasks.length
  const doneTasks = visibleTasks.filter(t => t.status === 'done').length
  const blockedTasks = visibleTasks.filter(t => t.status === 'blocked').length
  const criticalTasks = visibleTasks.filter(t => t.priority === 'critical').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Work Board</h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Kanban board across all agents and projects</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setModalOpen(true) }}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          New Task
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {[
          { label: 'Total',     value: totalTasks,    color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.18)' },
          { label: 'Completed', value: doneTasks,     color: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.18)'  },
          { label: 'Blocked',   value: blockedTasks,  color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.18)' },
          { label: 'Critical',  value: criticalTasks, color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.18)'  },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.border}`, backdropFilter: 'blur(12px)' }} className="rounded-xl px-4 py-2 flex items-center gap-2.5">
            <span style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">{stat.label}</span>
            <span style={{ color: stat.color }} className="text-sm font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Kanban board with DnD */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = visibleTasks.filter(t => t.status === col.status)
            return (
              <div key={col.status} className="flex flex-col min-w-0">
                {/* Column header */}
                <div
                  style={{ background: col.bg, border: `1px solid ${col.border}`, borderBottom: 'none', borderRadius: '12px 12px 0 0', backdropFilter: 'blur(12px)' }}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span style={{ background: col.color, boxShadow: `0 0 6px ${col.color}55` }} className="w-2 h-2 rounded-full inline-block" />
                    <span style={{ color: col.color }} className="text-sm font-semibold">{col.label}</span>
                  </div>
                  <span style={{ color: col.color, background: `${col.color}18`, border: `1px solid ${col.color}35` }} className="text-xs px-2 py-0.5 rounded-full font-bold">{colTasks.length}</span>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        background: snapshot.isDraggingOver ? `${col.color}08` : 'rgba(10, 1, 24, 0.55)',
                        border: `1px solid ${snapshot.isDraggingOver ? col.color + '30' : col.border}`,
                        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '0 0 12px 12px',
                        backdropFilter: 'blur(12px)',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                      className="flex-1 p-3 space-y-2.5 min-h-[400px]"
                    >
                      {colTasks.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex items-center justify-center h-24">
                          <span style={{ color: 'var(--cp-text-faint)' }} className="text-xs font-medium">No tasks</span>
                        </div>
                      ) : (
                        colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  opacity: dragSnapshot.isDragging ? 0.85 : 1,
                                  transform: dragProvided.draggableProps.style?.transform,
                                }}
                              >
                                <TaskCard
                                  task={task}
                                  onEdit={(t) => { setEditingTask(t); setModalOpen(true) }}
                                  onDelete={(t) => setDeletingTask(t)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Modals */}
      <TaskModal open={modalOpen} task={editingTask} onClose={() => { setModalOpen(false); setEditingTask(null) }} onSave={handleSave} />
      <DeleteConfirm task={deletingTask} onClose={() => setDeletingTask(null)} onConfirm={handleDelete} />
    </div>
  )
}
