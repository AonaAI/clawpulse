'use client'

import { useEffect, useState, useCallback, memo, useRef } from 'react'
import Link from 'next/link'
import type { ConnectionStatus } from '@/lib/useRealtimeSubscription'
import { AGENTS } from '@/lib/data'
import { supabase, fetchTasks, fetchActivityLog, fetchSetting, fetchAgentLiveStatus, fetchAgentSparklines, fetchTokenStatsByAgent, fetchAgentActivity, fetchAgentTodayTokens, fetchSessions } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import type { AgentStatus, AgentLive, MergedAgent, Task } from '@/lib/types'
import { WidgetConfig, loadWidgetLayout, saveWidgetLayout } from '@/lib/widget-config'
import { APP_NAME } from '@/lib/config'
import dynamic from 'next/dynamic'
import ExportButton, { exportToCSV, exportToJSON } from '@/components/ExportButton'
import { useProject } from '@/components/ProjectProvider'
import DraggableWidget from '@/components/widgets/DraggableWidget'

const CustomizePanel = dynamic(() => import('@/components/widgets/CustomizePanel'), { ssr: false })
const SpawnModal = dynamic(() => import('@/components/SpawnModal'), { ssr: false })
const QuickActionsWidget = dynamic(() => import('@/components/widgets/QuickActionsWidget'), { ssr: false })
const CostSummaryWidget = dynamic(() => import('@/components/widgets/CostSummaryWidget'), { ssr: false })
const BudgetStatusWidget = dynamic(() => import('@/components/widgets/BudgetStatusWidget'), { ssr: false })
const RecentDeploymentsWidget = dynamic(() => import('@/components/widgets/RecentDeploymentsWidget'), { ssr: false })
const LiveActivityPanel = dynamic(() => import('@/components/LiveActivityPanel'), { ssr: false })
const Sparkline = dynamic(() => import('@/components/Sparkline'), { ssr: false })

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

const AgentCard = memo(function AgentCard({ agent, compact, onSpawn, onSelect, sparkline, pulseType }: { agent: MergedAgent; compact?: boolean; onSpawn?: (agent: MergedAgent) => void; onSelect?: (agent: MergedAgent) => void; sparkline?: number[]; pulseType?: 'online' | 'offline' | null }) {
  const pulseClass = pulseType === 'online' ? 'agent-pulse-online' : pulseType === 'offline' ? 'agent-pulse-offline' : ''
  const initials = agent.name.slice(0, 2).toUpperCase()
  const isWorking = agent.status === 'working'

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(agent)}
        style={{
          background: isWorking ? 'rgba(124, 58, 237, 0.04)' : 'var(--cp-card-bg)',
          border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.28)' : 'var(--cp-border)'}`,
          cursor: onSelect ? 'pointer' : 'default',
        }}
        className={`rounded-lg p-2.5 flex items-center gap-2 ${pulseClass}`}
      >
        <div
          style={{
            background: isWorking ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(79, 46, 220, 0.15) 100%)' : 'var(--cp-separator-bg)',
            border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.45)' : 'var(--cp-border-subtle)'}`,
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
      onClick={() => onSelect?.(agent)}
      style={{
        background: isWorking ? 'rgba(124, 58, 237, 0.04)' : 'var(--cp-card-bg)',
        border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.28)' : 'var(--cp-border)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: isWorking ? '0 0 0 1px rgba(139, 92, 246, 0.06), 0 8px 32px rgba(0, 0, 0, 0.4)' : '0 4px 24px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: onSelect ? 'pointer' : 'default',
      }}
      className={`rounded-xl p-4 flex flex-col gap-3 hover:border-[rgba(139,92,246,0.4)] ${pulseClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              background: isWorking ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(79, 46, 220, 0.15) 100%)' : 'var(--cp-separator-bg)',
              border: `1px solid ${isWorking ? 'rgba(139, 92, 246, 0.45)' : 'var(--cp-border-subtle)'}`,
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onSpawn && (
            <button
              onClick={(e) => { e.stopPropagation(); onSpawn(agent) }}
              title="Spawn task"
              style={{ color: 'var(--cp-text-accent-light)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.22)' }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-purple-500/20 transition-colors text-sm"
            >▶</button>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div style={{ color: 'var(--cp-text-dimmer)' }} className="text-xs">
          {agent.sessionCount > 0 ? `${agent.sessionCount} sessions · last ${formatLastActive(agent.lastActive)}` : 'No sessions'}
        </div>
        {sparkline && <Sparkline data={sparkline} />}
      </div>
    </div>
  )
})

const ActivityItem = memo(function ActivityItem({ item, isLast, isNew }: { item: { id: string; agent_id: string; agent_name: string; action: string; details: string; time: string }; isLast: boolean; isNew?: boolean }) {
  return (
    <div className={`flex items-start gap-3 py-3.5 ${isNew ? 'realtime-fade-in' : ''}`} style={{ borderBottom: isLast ? 'none' : '1px solid var(--cp-input-bg)' }}>
      <div style={{ background: 'rgba(109, 40, 217, 0.15)', border: '1px solid rgba(139, 92, 246, 0.18)', width: '26px', height: '26px', minWidth: '26px', color: 'var(--cp-text-accent-light)' }} className="rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
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
})

function LiveBadge({ connectionStatus }: { connectionStatus: ConnectionStatus }) {
  const cfg = {
    connected: { badge: 'realtime-live-badge', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', color: '#34d399', dot: 'bg-emerald-400', ping: true, label: 'Live' },
    reconnecting: { badge: '', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24', dot: 'bg-amber-400', ping: false, label: 'Reconnecting' },
    disconnected: { badge: '', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', color: '#f87171', dot: 'bg-red-400', ping: false, label: 'Offline' },
  }[connectionStatus]
  return (
    <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full ${cfg.badge}`} style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span className="relative flex h-2 w-2">
        {cfg.ping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      <span style={{ color: cfg.color }} className="text-xs font-semibold">{cfg.label}</span>
    </div>
  )
}

// ── Event type helpers (reused from agent detail) ─────────────────────────

type EventType = 'task_started' | 'task_completed' | 'message_sent' | 'error' | 'deployment' | 'info' | 'warning' | 'analysis'

function detectEventType(action: string): EventType {
  const a = action.toLowerCase()
  if (a.includes('error') || a.includes('fail') || a.includes('crash')) return 'error'
  if (a.includes('complet') || a.includes('done') || a.includes('finish') || a.includes('success')) return 'task_completed'
  if (a.includes('start') || a.includes('begin') || a.includes('initiat') || a.includes('creat')) return 'task_started'
  if (a.includes('deploy') || a.includes('publish') || a.includes('release') || a.includes('ship')) return 'deployment'
  if (a.includes('message') || a.includes('send') || a.includes('notify') || a.includes('slack') || a.includes('comm')) return 'message_sent'
  if (a.includes('warn') || a.includes('caution') || a.includes('alert')) return 'warning'
  if (a.includes('analys') || a.includes('research') || a.includes('review') || a.includes('audit')) return 'analysis'
  return 'info'
}

const EVENT_CONFIG: Record<EventType, { color: string; bg: string; border: string; label: string }> = {
  task_completed: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', label: 'Completed' },
  task_started:   { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', label: 'Started' },
  error:          { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Error' },
  deployment:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Deployed' },
  message_sent:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  label: 'Message' },
  warning:        { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  label: 'Warning' },
  analysis:       { color: 'var(--cp-text-accent-light)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', label: 'Analysis' },
  info:           { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  label: 'Info' },
}

function formatTimeAgoShort(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

// ── Agent Live Panel ───────────────────────────────────────────────────────

function AgentLivePanel({ agentId, agents, onClose }: { agentId: string; agents: MergedAgent[]; onClose: () => void }) {
  const agent = agents.find(a => a.id === agentId)
  const staticAgent = AGENTS.find(a => a.id === agentId)
  const [panelActivity, setPanelActivity] = useState<any[]>([])
  const [currentTaskDesc, setCurrentTaskDesc] = useState<string | null>(null)
  const [todayTokens, setTodayTokens] = useState<number | null>(null)
  const [latestSession, setLatestSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchAgentActivity(agentId, 10),
      fetchAgentTodayTokens(agentId),
      fetchSessions(agentId, 1),
      supabase.from('agents').select('current_task').eq('id', agentId).single(),
    ]).then(([acts, tokens, sessions, agentRow]) => {
      setPanelActivity(acts)
      setTodayTokens(tokens)
      setLatestSession(sessions[0] ?? null)
      const raw = (agentRow.data as any)?.current_task ?? null
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          setCurrentTaskDesc(parsed.task ?? parsed.description ?? null)
        } catch {
          setCurrentTaskDesc(typeof raw === 'string' && raw.length < 500 ? raw : null)
        }
      }
      setLoading(false)
    })
  }, [agentId])

  // Realtime subscription: new activity for this agent
  useEffect(() => {
    const channel = supabase.channel(`agent-panel-${agentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `agent_id=eq.${agentId}`,
      }, (payload) => {
        setPanelActivity(prev => [payload.new, ...prev].slice(0, 10))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agentId])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const status = agent?.status ?? 'unknown'
  const statusCfg = {
    working: { dot: '#34d399', label: 'Working', bg: 'rgba(52,211,153,0.08)', color: '#34d399', border: 'rgba(52,211,153,0.25)' },
    idle:    { dot: '#4b5563', label: 'Idle',    bg: 'rgba(75,85,99,0.06)',   color: 'var(--cp-text-muted)', border: 'rgba(75,85,99,0.2)' },
    offline: { dot: '#374151', label: 'Offline', bg: 'rgba(55,65,81,0.04)',   color: 'var(--cp-text-dim)',   border: 'rgba(55,65,81,0.15)' },
    unknown: { dot: '#6b7280', label: 'Unknown', bg: 'rgba(107,114,128,0.04)',color: 'var(--cp-text-muted)', border: 'rgba(107,114,128,0.15)' },
  }[status] ?? { dot: '#6b7280', label: 'Unknown', bg: 'rgba(107,114,128,0.04)', color: 'var(--cp-text-muted)', border: 'rgba(107,114,128,0.15)' }

  function formatRuntime(startedAt: string | null): string {
    if (!startedAt) return '—'
    const ms = Date.now() - new Date(startedAt).getTime()
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  function formatTokenCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return `${n}`
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--cp-code-bg)',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100vw',
          height: '100%',
          background: 'var(--cp-deep-bg)',
          borderLeft: '1px solid rgba(109,40,217,0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.22s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--cp-separator-bg)', flexShrink: 0 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: status === 'working'
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.35) 0%, rgba(79,46,220,0.15) 100%)'
                  : 'var(--cp-separator-bg)',
                border: `1px solid ${status === 'working' ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: status === 'working' ? '#c4b5fd' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
              }}>
                {(staticAgent?.name ?? agentId).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: 15 }} className="truncate">
                  {staticAgent?.name ?? agentId}
                </div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: 12 }} className="truncate">
                  {staticAgent?.role ?? '—'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold">
                <span style={{ background: statusCfg.dot }} className="w-1.5 h-1.5 rounded-full inline-block" />
                {statusCfg.label}
              </span>
              <button
                onClick={onClose}
                style={{ color: 'var(--cp-text-dim)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Model badge */}
          {staticAgent?.model && (
            <div style={{ marginTop: 10 }}>
              <span style={{ color: 'var(--cp-text-accent-light)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                {staticAgent.model}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--cp-card-bg)' }} className="animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Current Task */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Current Task</div>
                {currentTaskDesc ? (
                  <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 8, padding: '10px 12px', color: 'var(--cp-text-muted)', fontSize: 12, lineHeight: 1.6 }}>
                    {currentTaskDesc}
                  </div>
                ) : (
                  <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, fontStyle: 'italic' }}>No active task</div>
                )}
              </div>

              {/* Session Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Session Info</div>
                <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-subtle)', borderRadius: 8, padding: '10px 14px' }} className="grid grid-cols-3 gap-3">
                  <div>
                    <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 10, marginBottom: 3 }}>Tokens Today</div>
                    <div style={{ color: 'var(--cp-text-accent-light)', fontWeight: 700, fontSize: 15 }}>{todayTokens !== null ? formatTokenCount(todayTokens) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 10, marginBottom: 3 }}>Runtime</div>
                    <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: 13 }}>
                      {latestSession?.started_at ? formatRuntime(latestSession.started_at) : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 10, marginBottom: 3 }}>Sessions 7d</div>
                    <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: 13 }}>
                      {agent?.sessionCount ?? 0}
                    </div>
                  </div>
                </div>
                {latestSession?.session_key && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 10, marginBottom: 2 }}>Session ID</div>
                    <code style={{ color: 'var(--cp-text-dim)', fontSize: 10, wordBreak: 'break-all' }}>{latestSession.session_key}</code>
                  </div>
                )}
              </div>

              {/* Live Activity */}
              <div style={{ marginBottom: 16 }}>
                <div className="flex items-center justify-between mb-2">
                  <div style={{ color: 'var(--cp-text-dimmer)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Activity</div>
                  <span style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }} className="realtime-live-badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>
                <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                  {panelActivity.length === 0 ? (
                    <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, padding: '16px', textAlign: 'center', fontStyle: 'italic' }}>No recent activity</div>
                  ) : panelActivity.map((item, i) => {
                    const evType = detectEventType(item.action || '')
                    const evCfg = EVENT_CONFIG[evType]
                    return (
                      <div key={item.id ?? i} style={{ padding: '10px 14px', borderBottom: i < panelActivity.length - 1 ? '1px solid var(--cp-input-bg)' : 'none' }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span style={{ color: evCfg.color, background: evCfg.bg, border: `1px solid ${evCfg.border}`, fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                            {evCfg.label}
                          </span>
                          <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 10 }}>
                            {item.created_at ? formatTimeAgoShort(item.created_at) : ''}
                          </span>
                        </div>
                        <div style={{ color: 'var(--cp-text-card-title)', fontSize: 12, fontWeight: 500 }}>{item.action}</div>
                        {item.details && (
                          <div style={{ color: 'var(--cp-text-dim)', fontSize: 11, marginTop: 2, lineHeight: 1.5 }} className="truncate">{item.details}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: link to full detail */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--cp-separator-bg)', flexShrink: 0 }}>
          <Link
            href={`/agents/${agentId}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '9px 0', borderRadius: 10,
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
              color: 'var(--cp-text-accent-light)', fontWeight: 600, fontSize: 13,
              textDecoration: 'none', transition: 'background 0.15s',
            }}
            onClick={onClose}
          >
            View Full Agent Detail
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function OverviewPage() {
  const [agents, setAgents] = useState<MergedAgent[]>(UNKNOWN_AGENTS)
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set())
  const [agentPulses, setAgentPulses] = useState<Map<string, 'online' | 'offline'>>(new Map())
  const pulseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [apiError, setApiError] = useState(false)
  const [companyMission, setCompanyMission] = useState('')
  const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>([])
  const [showCustomize, setShowCustomize] = useState(false)
  const [spawnAgent, setSpawnAgent] = useState<MergedAgent | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [tokenMap, setTokenMap] = useState<Record<string, { total_tokens: number; total_cost: number }>>({})
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load widget layout from localStorage
  useEffect(() => {
    setWidgetLayout(loadWidgetLayout())
  }, [])

  const updateLayout = (newLayout: WidgetConfig[]) => {
    setWidgetLayout(newLayout)
    saveWidgetLayout(newLayout)
  }

  const handleDragStart = useCallback((id: string) => setDragSourceId(id), [])
  const handleDragOver = useCallback((id: string) => setDragTargetId(id), [])
  const handleDragEnd = useCallback(() => {
    if (dragSourceId && dragTargetId && dragSourceId !== dragTargetId) {
      setWidgetLayout(prev => {
        const sorted = [...prev].sort((a, b) => a.order - b.order)
        const srcIdx = sorted.findIndex(w => w.id === dragSourceId)
        const tgtIdx = sorted.findIndex(w => w.id === dragTargetId)
        if (srcIdx === -1 || tgtIdx === -1) return prev
        const [moved] = sorted.splice(srcIdx, 1)
        sorted.splice(tgtIdx, 0, moved)
        const reordered = sorted.map((w, i) => ({ ...w, order: i }))
        saveWidgetLayout(reordered)
        return reordered
      })
    }
    setDragSourceId(null)
    setDragTargetId(null)
  }, [dragSourceId, dragTargetId])

  const handleToggleCollapse = useCallback((id: string) => {
    setWidgetLayout(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, collapsed: !w.collapsed } : w)
      saveWidgetLayout(updated)
      return updated
    })
  }, [])

  const fetchAgentsData = useCallback(async () => {
    try {
      const live = await fetchAgentLiveStatus()
      setAgents(mergeLiveData(live))
      setLastRefreshed(new Date())
      setApiError(false)
    } catch { setApiError(true) }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    await fetchAgentsData()
    setRefreshing(false)
  }, [refreshing, fetchAgentsData])

  useEffect(() => {
    async function loadData() {
      const [tasksData, activityData, missionValue, sparklinesData, tokenStats] = await Promise.all([
        fetchTasks(),
        fetchActivityLog(8),
        fetchSetting('company_mission'),
        fetchAgentSparklines(),
        fetchTokenStatsByAgent(),
      ])
      setTasks(tasksData)
      setActivity(activityData)
      if (missionValue) setCompanyMission(missionValue)
      setSparklines(sparklinesData)
      const tMap: Record<string, { total_tokens: number; total_cost: number }> = {}
      for (const s of tokenStats) tMap[s.agent_id] = { total_tokens: s.total_tokens, total_cost: s.total_cost }
      setTokenMap(tMap)
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
    setAgents(prev => {
      const agent = prev.find(a => a.id === record.id || a.dir === record.id)
      if (agent && record.status && agent.status !== record.status) {
        const isOnline = record.status === 'working' || record.status === 'idle'
        const isOffline = record.status === 'offline'
        if (isOnline || isOffline) {
          const pulseType = isOnline ? 'online' as const : 'offline' as const
          setAgentPulses(prev => new Map(prev).set(agent.id, pulseType))
          // Clear existing timer
          const existing = pulseTimersRef.current.get(agent.id)
          if (existing) clearTimeout(existing)
          const timer = setTimeout(() => {
            setAgentPulses(prev => { const next = new Map(prev); next.delete(agent.id); return next })
            pulseTimersRef.current.delete(agent.id)
          }, 2000)
          pulseTimersRef.current.set(agent.id, timer)
        }
      }
      return prev.map(a => (a.id === record.id || a.dir === record.id) ? { ...a, status: record.status || a.status } : a)
    })
  }, [])

  const handleTaskInsert = useCallback((record: any) => { setTasks(prev => [record, ...prev]) }, [])
  const handleTaskUpdate = useCallback((record: any) => { setTasks(prev => prev.map(t => t.id === record.id ? { ...t, ...record } : t)) }, [])
  const handleTaskDelete = useCallback((old: any) => { if (old.id) setTasks(prev => prev.filter(t => t.id !== old.id)) }, [])

  const { connectionStatus } = useRealtimeSubscription([
    { table: 'activity_log', event: 'INSERT', onInsert: handleActivityInsert },
    { table: 'agents', event: 'UPDATE', onUpdate: handleAgentUpdate },
    { table: 'tasks', event: 'INSERT', onInsert: handleTaskInsert },
    { table: 'tasks', event: 'UPDATE', onUpdate: handleTaskUpdate },
    { table: 'tasks', event: 'DELETE', onDelete: handleTaskDelete },
  ], { onFallbackRefresh: fetchAgentsData })

  const { selectedProjectId, agentIdsForProject } = useProject()

  // Filter by selected project
  const projectAgentIds = selectedProjectId ? new Set(agentIdsForProject(selectedProjectId)) : null
  const filteredAgents = projectAgentIds ? agents.filter(a => projectAgentIds.has(a.id)) : agents
  const filteredTasks = projectAgentIds ? tasks.filter(t => t.assigned_agent && projectAgentIds.has(t.assigned_agent)) : tasks

  const activeTasks = filteredTasks.filter(t => t.status === 'in_progress')
  const doneTasks = filteredTasks.filter(t => t.status === 'done')
  const workingAgents = filteredAgents.filter(a => a.status === 'working')
  const idleAgents = filteredAgents.filter(a => a.status === 'idle')

  const stats = [
    { label: 'Total Agents', value: filteredAgents.length, color: 'var(--cp-text-accent-light)', iconColor: 'rgba(167, 139, 250, 0.7)', gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.14) 0%, rgba(109, 40, 217, 0.04) 100%)', border: 'rgba(139, 92, 246, 0.2)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.85" /></svg> },
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
              <div className="flex items-center gap-2">
                {lastRefreshed && (
                  <span style={{ color: 'var(--cp-text-dim)', fontSize: '11px' }}>
                    Updated {formatLastActive(lastRefreshed.getTime())}
                  </span>
                )}
                <button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  title="Refresh agent status"
                  style={{ color: refreshing ? 'var(--cp-text-dim)' : '#8b5cf6', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:border-[rgba(139,92,246,0.3)] transition-colors disabled:opacity-50"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 0.6s linear' : 'none' }}>
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                </button>
                <span style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="text-xs px-2.5 py-0.5 rounded-full font-medium">{filteredAgents.length} agents</span>
              </div>
            </div>
            <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
              {filteredAgents.map((agent) => <AgentCard key={agent.id} agent={agent} compact={compact} onSpawn={setSpawnAgent} onSelect={(a) => setSelectedAgentId(a.id)} sparkline={sparklines[agent.id]} pulseType={agentPulses.get(agent.id)} />)}
            </div>
          </div>
        )

      case 'budget-status':
        return (
          <div key="budget-status">
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: 'var(--cp-text-heading)' }} className="font-semibold text-base">Budget Status</h2>
              <span style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-input-bg)', border: '1px solid var(--cp-border-subtle)' }} className="text-xs px-2.5 py-0.5 rounded-full font-medium">
                This Month
              </span>
            </div>
            <div style={{ background: 'var(--cp-card-bg)', border: '1px solid var(--cp-border)', backdropFilter: 'blur(12px)' }} className="rounded-xl overflow-hidden">
              <BudgetStatusWidget compact={compact} />
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
                const agent = filteredAgents.find(a => a.id === task.assigned_agent)
                const pColor = priorityConfig[task.priority].color
                return (
                  <div key={task.id} className={`px-4 ${compact ? 'py-2.5' : 'py-3.5'} flex items-start gap-3`} style={{ borderBottom: i < activeTasks.length - 1 ? '1px solid var(--cp-input-bg)' : 'none' }}>
                    <div style={{ background: pColor, width: '2px', minWidth: '2px', borderRadius: '2px', opacity: 0.75, alignSelf: 'stretch' }} />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: 'var(--cp-text-card-title)' }} className="text-sm font-medium truncate mb-1.5">{task.title}</div>
                      {!compact && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--cp-text-accent-light)', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: 600 }}>{agent?.name ?? task.assigned_agent}</span>
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
              <LiveBadge connectionStatus={connectionStatus} />
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
      {/* Print Header */}
      <div className="print-header" style={{ marginBottom: 24, borderBottom: '2px solid #7c3aed', paddingBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{APP_NAME} — Dashboard Report</h1>
        <p style={{ fontSize: 12, color: 'var(--cp-text-muted)' }}>Generated: {new Date().toLocaleString()}</p>
      </div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">Overview</h1>
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1.5 font-medium">Real-time status of your agent network</p>
          </div>
          <div className="flex items-center gap-2">
          <ExportButton
            onExportCSV={() => {
              const date = new Date().toISOString().slice(0, 10)
              exportToCSV(`clawpulse-agents-${date}`,
                ['Agent Name', 'Role', 'Model', 'Status', 'Sessions (7d)', 'Tokens (7d)', 'Cost (7d)', 'Last Seen'],
                filteredAgents.map(a => [
                  a.name,
                  a.role || '',
                  a.model || '',
                  a.status || '',
                  a.sessionCount,
                  tokenMap[a.id]?.total_tokens || 0,
                  tokenMap[a.id]?.total_cost ? `$${tokenMap[a.id].total_cost.toFixed(3)}` : '$0.000',
                  a.lastActive ? new Date(a.lastActive).toISOString() : 'Never',
                ])
              )
            }}
            onExportJSON={() => {
              const date = new Date().toISOString().slice(0, 10)
              const totalTokens7d = Object.values(tokenMap).reduce((s, t) => s + t.total_tokens, 0)
              const totalCost7d = Object.values(tokenMap).reduce((s, t) => s + t.total_cost, 0)
              exportToJSON(`clawpulse-export-${date}`, {
                agents: filteredAgents.map(a => ({
                  id: a.id,
                  name: a.name,
                  role: a.role,
                  model: a.model,
                  status: a.status,
                  sessionCount: a.sessionCount,
                  lastActive: a.lastActive ? new Date(a.lastActive).toISOString() : null,
                  totalTokens: tokenMap[a.id]?.total_tokens || 0,
                  totalCost: tokenMap[a.id]?.total_cost || 0,
                  workspace: a.workspace,
                })),
                summary: {
                  totalAgents: filteredAgents.length,
                  activeNow: workingAgents.length,
                  totalTokens7d,
                  totalCost7d,
                },
                exportedAt: new Date().toISOString(),
              })
            }}
            onPrintPDF={() => window.print()}
          />
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

      {/* Widgets - grid layout supporting half/full width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ transition: 'all 0.3s ease' }}>
        {sortedWidgets.filter(w => w.enabled).map(w => (
          <div
            key={w.id}
            className={w.size === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'}
            style={{ transition: 'all 0.3s ease' }}
          >
            <DraggableWidget
              widget={w}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onToggleCollapse={handleToggleCollapse}
              isDragTarget={dragTargetId === w.id && dragSourceId !== w.id}
              isDragging={dragSourceId === w.id}
              isMobile={isMobile}
            >
              {renderWidget(w.id)}
            </DraggableWidget>
          </div>
        ))}
      </div>

      {/* Customize Panel */}
      {showCustomize && (
        <CustomizePanel
          widgets={widgetLayout}
          onChange={updateLayout}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {/* Spawn Modal */}
      {spawnAgent && (
        <SpawnModal
          agentId={spawnAgent.id}
          agentName={spawnAgent.name}
          onClose={() => setSpawnAgent(null)}
        />
      )}

      {/* Agent Live Activity Panel */}
      {selectedAgentId && (
        <AgentLivePanel
          agentId={selectedAgentId}
          agents={agents}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {/* Global Live Activity Side Panel */}
      <LiveActivityPanel />
    </div>
  )
}
