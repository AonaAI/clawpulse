'use client'

import { useEffect, useState, useCallback } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchTasks, fetchActivityLog, fetchAgents as fetchAgentsFromDB, fetchSetting, fetchAgentLiveStatus } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import type { AgentStatus, AgentLive, MergedAgent, Task } from '@/lib/types'
import { WidgetConfig, loadWidgetLayout, saveWidgetLayout } from '@/lib/widget-config'
import CustomizePanel from '@/components/widgets/CustomizePanel'
import QuickActionsWidget from '@/components/widgets/QuickActionsWidget'
import CostSummaryWidget from '@/components/widgets/CostSummaryWidget'
import RecentDeploymentsWidget from '@/components/widgets/RecentDeploymentsWidget'

const POLL_INTERVAL = 10_000

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

const UNKNOWN_AGENTS: MergedAgent[] = AGENTS.map(a => ({
  ...a,
  status: 'unknown' as AgentStatus,
  sessionCount: 0,
  lastActive: null,
  totalTokens: 0,
}))

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = {
    working: { dot: '#34d399', text: 'Working', bg: 'rgba(52, 211, 153, 0.08)', color: '#34d399', border: 'rgba(52, 211, 153, 0.25)', pulse: true },
    idle: { dot: '#4b5563', text: 'Idle', bg: 'rgba(75, 85, 99, 0.06)', color: 'var(--cp-text-muted)', border: 'rgba(75, 85, 99, 0.2)', pulse: false },
    offline: { dot: '#374151', text: 'Offline', bg: 'rgba(55, 65, 81, 0.04)', color: 'var(--cp-text-dim)', border: 'rgba(55, 65, 81, 0.15)', pulse: false },
    unknown: { dot: '#6b7280', text: 'Unknown', bg: 'rgba(107, 114, 128, 0.04)', color: 'var(--cp-text-muted)', border: 'rgba(107, 114, 128, 0.15)', pulse: false },
  }[status]

  return (
    <span style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold">
      <span style={{ background: config.dot }} className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${config.pulse ? 'status-glow-working' : ''}`} />
      {config.text}
    </span>
  )
}

function AgentCard({ agent, compact }: { agent: MergedAgent; compact?: boolean }) {
  const initials = agent.name.slice(0, 2).toUpperCase()
  const isWorking = agent.status === 'working'

  if (compact) {
    return (
      <div
        style={{
          background: isWorking ? 'rgba(124, 58, 237, 0.04)' : 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.28)' : 'rgba(109, 40, 217, 0.14)'}`,
        }}
        className="rounded-lg p-2.5 flex items-center gap-2"
      >
        <div
          style={{
            background: isWorking ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(79, 46, 220, 0.15) 100%)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.45)' : 'rgba(255, 255, 255, 0.07)'}`,
            color: isWorking ? '#c4b5fd' : '#6b7280',
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
        >{initials}</div>
        <div className="flex-1 min-w-0">
          <div style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-xs truncate">{agent.name}</div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
    )
  }

  return (
    <div
      style={{
        background: isWorking ? 'rgba(124, 58, 237, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.28)' : 'rgba(109, 40, 217, 0.14)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: isWorking ? '0 0 0 1px rgba(139, 92, 246, 0.06), 0 8px 32px rgba(0, 0, 0, 0.4)' : '0 4px 24px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      className="rounded-xl p-4 flex flex-col gap-3 cursor-default hover:border-[rgba(139,92,246,0.4)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              background: isWorking ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(79, 46, 220, 0.15) 100%)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.45)' : 'rgba(255, 255, 255, 0.07)'}`,
              boxShadow: isWorking ? '0 0 18px rgba(124, 58, 237, 0.22)' : 'none',
              color: isWorking ? '#c4b5fd' : '#6b7280',
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
          >{initials}</div>
          <div className="min-w-0">
            <div style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm leading-tight">{agent.name}</div>
            <div style={{ color: 'var(--cp-text-muted)' }} className="text-xs mt-0.5 truncate">{agent.role}</div>
          </div>
        </div>
        <div className="flex-shrink-0"><StatusBadge status={agent.status} /></div>
      </div>
      <div style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs">
        {agent.sessionCount > 0 ? `${agent.sessionCount} sessions · last ${formatLastActive(agent.lastActive)}` : 'No sessions'}
      </div>
    </div>
  )
}

function ActivityItem({ item, isLast, isNew }: { item: { id: string; agent_id: string; agent_name: string; action: string; details: string; time: string }; isLast: boolean; isNew?: boolean }) {
  return (
    <div className={`flex items-start gap-3 py-3.5 ${isNew ? 'realtime-fade-in' : ''}`} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}>
      <div style={{ background: 'rgba(109, 40, 217, 0.15)', border: '1px solid rgba(139, 92, 246, 0.18)', width: '26px', height: '26px', minWidth: '26px', color: '#8b5cf6' }} className="rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
        {item.agent_name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span style={{ color: 'var(--cp-text-card-title)' }} className="text-xs font-semibold">{item.agent_name}</span>
          <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' }} className="flex-shrink-0">{item.time}</span>
        </div>
        <div style={{ color: '#7c3aed' }} className="text-xs font-semibold">{item.action}</div>
        <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-0.5 truncate">{item.details}</div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const [agents, setAgents] = useState<MergedAgent[]>(UNKNOWN_AGENTS)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set())
  const [apiError, setApiError] = useState(false)
  const [companyMission, setCompanyMission] = useState('')
  const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>([])
  const [showCustomize, setShowCustomize] = useState(false)

  // Load widget layout from localStorage
  useEffect(() => {
    setWidgetLayout(loadWidgetLayout())
  }, [])

  const updateLayout = (newLayout: WidgetConfig[]) => {
    setWidgetLayout(newLayout)
    saveWidgetLayout(newLayout)
  }

  useEffect(() => {
    async function fetchAgentsData() {
      try {
        const live = await fetchAgentLiveStatus()
        setAgents(mergeLiveData(live))
        setApiError(false)
      } catch { setApiError(true) }
    }
    fetchAgentsData()
    const id = setInterval(fetchAgentsData, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function loadData() {
      const [tasksData, activityData, missionValue] = await Promise.all([
        fetchTasks(),
        fetchActivityLog(8),
        fetchSetting('company_mission'),
      ])
      setTasks(tasksData)
      setActivity(activityData)
      if (missionValue) setCompanyMission(missionValue)
    }
    loadData()
  }, [])

  const handleActivityInsert = useCallback((record: any) => {
    const newItem = { id: record.id, agent_id: record.agent_id, agent_name: record.agent_id, action: record.action, details: record.details || '', time: 'Just now' }
    setActivity(prev => [newItem, ...prev].slice(0, 8))
    setNewActivityIds(prev => new Set(prev).add(record.id))
    setTimeout(() => setNewActivityIds(prev => { const next = new Set(prev); next.delete(record.id); return next }), 2000)
  }, [])

  const handleAgentUpdate = useCallback((record: any) => {
    setAgents(prev => prev.map(a => (a.id === record.id || a.dir === record.id) ? { ...a, status: record.status || a.status } : a))
  }, [])

  const handleTaskInsert = useCallback((record: any) => { setTasks(prev => [record, ...prev]) }, [])
  const handleTaskUpdate = useCallback((record: any) => { setTasks(prev => prev.map(t => t.id === record.id ? { ...t, ...record } : t)) }, [])
  const handleTaskDelete = useCallback((old: any) => { if (old.id) setTasks(prev => prev.filter(t => t.id !== old.id)) }, [])

  const { isConnected } = useRealtimeSubscription([
    { table: 'activity_log', event: 'INSERT', onInsert: handleActivityInsert },
    { table: 'agents', event: 'UPDATE', onUpdate: handleAgentUpdate },
    { table: 'tasks', event: 'INSERT', onInsert: handleTaskInsert },
    { table: 'tasks', event: 'UPDATE', onUpdate: handleTaskUpdate },
    { table: 'tasks', event: 'DELETE', onDelete: handleTaskDelete },
  ])

  const activeTasks = tasks.filter(t => t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const workingAgents = agents.filter(a => a.status === 'working')
  const idleAgents = agents.filter(a => a.status === 'idle')

  const stats = [
    { label: 'Total Agents', value: agents.length, color: '#a78bfa', iconColor: 'rgba(167, 139, 250, 0.7)', gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.14) 0%, rgba(109, 40, 217, 0.04) 100%)', border: 'rgba(139, 92, 246, 0.2)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.85" /></svg> },
    { label: 'Active Now', value: workingAgents.length, color: '#34d399', iconColor: 'rgba(52, 211, 153, 0.7)', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)', border: 'rgba(52, 211, 153, 0.2)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> },
    { label: 'Idle', value: idleAgents.length, color: 'var(--cp-text-secondary)', iconColor: 'rgba(156, 163, 175, 0.7)', gradient: 'linear-gradient(135deg, rgba(75, 85, 99, 0.1) 0%, rgba(55, 65, 81, 0.04) 100%)', border: 'rgba(75, 85, 99, 0.2)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
    { label: 'Tasks Done', value: doneTasks.length, color: '#22d3ee', iconColor: 'rgba(34, 211, 238, 0.7)', gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(8, 145, 178, 0.04) 100%)', border: 'rgba(34, 211, 238, 0.2)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> },
  ]

  const priorityConfig = {
    low: { color: 'var(--cp-text-muted)' },
    medium: { color: '#3b82f6' },
    high: { color: '#f59e0b' },
    critical: { color: '#ef4444' },
  }

  const isWidgetEnabled = (id: string) => {
    const w = widgetLayout.find(w => w.id === id)
    return w ? w.enabled : true
  }

  const getWidgetConfig = (id: string) => widgetLayout.find(w => w.id === id)

  // Render a widget by ID
  const renderWidget = (widgetId: string) => {
    const cfg = getWidgetConfig(widgetId)
    if (!cfg || !cfg.enabled) return null
    const compact = cfg.compact

    switch (widgetId) {
      case 'stats-bar':
        return (
          <div key="stats-bar" className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${compact ? '' : ''}`}>
            {apiError ? (
              <div style={{ background: 'var(--cp-card-bg)', border: '1px solid rgba(107, 114, 128, 0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)' }} className="rounded-xl p-5 col-span-2 lg:col-span-4 text-center">
                <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm font-medium">No live data — connect local server</div>
              </div>
            ) : stats.map((stat) => (
              <div key={stat.label} style={{ background: stat.gradient, border: `1px solid ${stat.border}`, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)' }} className={`rounded-xl ${compact ? 'p-3' : 'p-5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider">{stat.label}</span>
                  <span style={{ color: stat.iconColor }}>{stat.icon}</span>
                </div>
                <div style={{ color: stat.color }} className={`${compact ? 'text-2xl' : 'text-4xl'} font-bold tracking-tight`}>{stat.value}</div>
              </div>
            ))}
          </div>
        )

      case 'quick-actions':
        return (
          <div key="quick-actions">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Quick Actions</h2>
            </div>
            <QuickActionsWidget compact={compact} />
          </div>
        )

      case 'agent-grid':
        return (
          <div key="agent-grid">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Agent Status</h2>
              <span style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="text-xs px-2.5 py-0.5 rounded-full font-medium">{agents.length} agents</span>
            </div>
            <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
              {agents.map((agent) => <AgentCard key={agent.id} agent={agent} compact={compact} />)}
            </div>
          </div>
        )

      case 'cost-summary':
        return (
          <div key="cost-summary">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Cost Summary</h2>
              <span style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="text-xs px-2.5 py-0.5 rounded-full font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                tokens
              </span>
            </div>
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className={`rounded-xl overflow-hidden ${compact ? 'p-3' : 'p-4'}`}>
              <CostSummaryWidget compact={compact} />
            </div>
          </div>
        )

      case 'active-tasks':
        return (
          <div key="active-tasks">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Active Tasks</h2>
              <span style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.2)' }} className="text-xs px-2.5 py-0.5 rounded-full font-semibold">{activeTasks.length} in progress</span>
            </div>
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className="rounded-xl overflow-hidden">
              {activeTasks.length === 0 ? (
                <div className="py-6 text-center text-sm" style={{ color: 'var(--cp-text-dim)' }}>No active tasks</div>
              ) : activeTasks.map((task, i) => {
                const agent = agents.find(a => a.id === task.assigned_agent)
                const pColor = priorityConfig[task.priority].color
                return (
                  <div key={task.id} className={`px-4 ${compact ? 'py-2.5' : 'py-3.5'} flex items-start gap-3`} style={{ borderBottom: i < activeTasks.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none' }}>
                    <div style={{ background: pColor, width: '2px', minWidth: '2px', borderRadius: '2px', opacity: 0.75, alignSelf: 'stretch' }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-medium truncate mb-1.5">{task.title}</div>
                      {!compact && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: 600 }}>{agent?.name ?? task.assigned_agent}</span>
                          <span style={{ color: 'var(--cp-text-dim)', fontSize: '11px' }}>{task.project}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )

      case 'activity-feed':
        return (
          <div key="activity-feed">
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Activity Feed</h2>
              <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full ${isConnected ? 'realtime-live-badge' : ''}`} style={{ background: isConnected ? 'rgba(52, 211, 153, 0.08)' : 'rgba(107, 114, 128, 0.08)', border: `1px solid ${isConnected ? 'rgba(52, 211, 153, 0.25)' : 'rgba(107, 114, 128, 0.2)'}` }}>
                <span className="relative flex h-2 w-2">
                  {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
                </span>
                <span style={{ color: isConnected ? '#34d399' : '#6b7280' }} className="text-xs font-semibold">{isConnected ? 'Live' : 'Connecting…'}</span>
              </div>
            </div>
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className="rounded-xl px-4 overflow-hidden">
              {activity.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--cp-text-dim)' }}>No activity yet</div>
              ) : (compact ? activity.slice(0, 4) : activity).map((item, i, arr) => (
                <ActivityItem key={item.id} item={item} isLast={i === arr.length - 1} isNew={newActivityIds.has(item.id)} />
              ))}
            </div>
          </div>
        )

      case 'recent-deployments':
        return (
          <div key="recent-deployments">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Recent Deployments</h2>
            </div>
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className={`rounded-xl overflow-hidden ${compact ? 'px-3' : 'px-4'}`}>
              <RecentDeploymentsWidget compact={compact} />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Sort widgets by order and filter enabled
  const sortedWidgets = [...widgetLayout].sort((a, b) => a.order - b.order)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-3xl font-bold tracking-tight">Overview</h1>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Real-time status of your agent network</p>
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            style={{
              color: 'var(--cp-text-muted)',
              background: 'var(--cp-input-bg)',
              border: '1px solid var(--cp-border-subtle)',
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:border-[rgba(139,92,246,0.3)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Customize
          </button>
        </div>
        {companyMission && (
          <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(109,40,217,0.2)', backdropFilter: 'blur(12px)' }} className="mt-4 rounded-xl px-5 py-3.5 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            <p style={{ color: 'var(--cp-text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              <span style={{ color: '#7c3aed', fontWeight: 700, marginRight: '6px' }}>Mission</span>
              {companyMission}
            </p>
          </div>
        )}
      </div>

      {/* Static mode banner */}
      {apiError && (
        <div style={{ background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.25)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 16px rgba(251, 191, 36, 0.08)' }} className="rounded-xl px-5 py-4 mb-8 flex items-start gap-3">
          <span style={{ color: '#fbbf24', fontSize: '18px' }}>⚠️</span>
          <div className="flex-1">
            <div style={{ color: '#fbbf24' }} className="font-semibold text-sm mb-1">Static mode — agent status unavailable</div>
            <div style={{ color: '#d97706' }} className="text-xs">Run locally (<code className="font-mono bg-black/20 px-1.5 py-0.5 rounded">next dev</code>) for live data from ~/.openclaw/agents</div>
          </div>
        </div>
      )}

      {/* Widgets */}
      <div className="space-y-8">
        {sortedWidgets.map(w => w.enabled ? <div key={w.id}>{renderWidget(w.id)}</div> : null)}
      </div>

      {/* Customize Panel */}
      {showCustomize && (
        <CustomizePanel
          widgets={widgetLayout}
          onChange={updateLayout}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  )
}
