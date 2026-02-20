'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchFullActivityLog } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import { supabase } from '@/lib/supabase-client'

type EventType = 'task_started' | 'task_completed' | 'message_sent' | 'error' | 'deployment' | 'info' | 'warning' | 'analysis'

interface ActivityItem {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
  time: string
}

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

const EVENT_CONFIG: Record<EventType, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  task_completed: {
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.25)',
    label: 'Completed',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  task_started: {
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.1)',
    border: 'rgba(129, 140, 248, 0.25)',
    label: 'Started',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  error: {
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.1)',
    border: 'rgba(248, 113, 113, 0.25)',
    label: 'Error',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  deployment: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.25)',
    label: 'Deployed',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    ),
  },
  message_sent: {
    color: '#22d3ee',
    bg: 'rgba(34, 211, 238, 0.1)',
    border: 'rgba(34, 211, 238, 0.25)',
    label: 'Message',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  warning: {
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.25)',
    label: 'Warning',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  analysis: {
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.1)',
    border: 'rgba(167, 139, 250, 0.25)',
    label: 'Analysis',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  info: {
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.1)',
    border: 'rgba(96, 165, 250, 0.25)',
    label: 'Info',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
}

const ALL_TYPES: EventType[] = ['task_completed', 'task_started', 'error', 'deployment', 'message_sent', 'warning', 'analysis', 'info']

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityItem[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFullActivityLog(100).then(data => {
      setEvents(data as ActivityItem[])
      setLoading(false)
    })
  }, [])

  const handleInsert = useCallback((record: Record<string, unknown>) => {
    // Fetch agent name
    supabase.from('agents').select('name').eq('id', record.agent_id).single().then(({ data }) => {
      const newItem: ActivityItem = {
        id: record.id as string,
        agent_id: record.agent_id as string,
        agent_name: data?.name || (record.agent_id as string),
        action: record.action as string,
        details: (record.details as string) || '',
        metadata: (record.metadata as Record<string, unknown>) || {},
        created_at: record.created_at as string,
        time: 'Just now',
      }
      setEvents(prev => [newItem, ...prev])
      setNewIds(prev => new Set(prev).add(newItem.id))
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(newItem.id); return n }), 3000)
    })
  }, [])

  const { isConnected } = useRealtimeSubscription([
    { table: 'activity_log', event: 'INSERT', onInsert: handleInsert as (record: Record<string, unknown>) => void },
  ])

  const agents = Array.from(new Set(events.map(e => e.agent_name))).filter(Boolean)

  const filtered = events.filter(e => {
    const type = detectEventType(e.action)
    if (filterType !== 'all' && type !== filterType) return false
    if (filterAgent !== 'all' && e.agent_name !== filterAgent) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.action.toLowerCase().includes(q) && !e.details.toLowerCase().includes(q) && !e.agent_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by date
  const groups: { date: string; items: ActivityItem[] }[] = []
  for (const event of filtered) {
    const d = formatDate(event.created_at)
    const existing = groups.find(g => g.date === d)
    if (existing) existing.items.push(event)
    else groups.push({ date: d, items: [event] })
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 style={{ color: '#f8f4ff' }} className="text-3xl font-bold tracking-tight">Activity Feed</h1>
          <p style={{ color: '#6b7280' }} className="text-sm mt-1.5 font-medium">Live event stream from all agents</p>
        </div>
        {/* Live indicator */}
        <div
          style={{
            background: isConnected ? 'rgba(52, 211, 153, 0.08)' : 'rgba(107, 114, 128, 0.08)',
            border: `1px solid ${isConnected ? 'rgba(52, 211, 153, 0.3)' : 'rgba(107, 114, 128, 0.2)'}`,
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
        >
          <span className="relative flex h-2 w-2">
            {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
          </span>
          <span style={{ color: isConnected ? '#34d399' : '#6b7280' }} className="text-xs font-bold tracking-wide">
            {isConnected ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl p-4 mb-6 space-y-3"
      >
        {/* Search */}
        <div className="relative">
          <svg
            style={{ color: '#4b5563', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(109, 40, 217, 0.18)',
              color: '#f8f4ff',
              paddingLeft: '36px',
            }}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 placeholder-gray-600"
          />
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            style={{
              background: filterType === 'all' ? 'rgba(124, 58, 237, 0.18)' : 'rgba(255, 255, 255, 0.04)',
              border: filterType === 'all' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.07)',
              color: filterType === 'all' ? '#c4b5fd' : '#6b7280',
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
          >
            All events
          </button>
          {ALL_TYPES.map(type => {
            const cfg = EVENT_CONFIG[type]
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                style={{
                  background: filterType === type ? cfg.bg : 'rgba(255, 255, 255, 0.04)',
                  border: filterType === type ? `1px solid ${cfg.border}` : '1px solid rgba(255, 255, 255, 0.07)',
                  color: filterType === type ? cfg.color : '#6b7280',
                }}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <span style={{ color: filterType === type ? cfg.color : '#6b7280' }}>{cfg.icon}</span>
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Agent filter */}
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterAgent('all')}
              style={{
                background: filterAgent === 'all' ? 'rgba(124, 58, 237, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                border: filterAgent === 'all' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                color: filterAgent === 'all' ? '#c4b5fd' : '#4b5563',
              }}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            >
              All agents
            </button>
            {agents.map(ag => (
              <button
                key={ag}
                onClick={() => setFilterAgent(filterAgent === ag ? 'all' : ag)}
                style={{
                  background: filterAgent === ag ? 'rgba(109, 40, 217, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: filterAgent === ag ? '1px solid rgba(109, 40, 217, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                  color: filterAgent === ag ? '#a78bfa' : '#4b5563',
                }}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              >
                {ag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Count */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: '#4b5563' }} className="text-xs font-medium">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          {filterType !== 'all' || filterAgent !== 'all' || search ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Event groups */}
      {loading ? (
        <div
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)' }}
          className="rounded-xl p-12 text-center"
        >
          <div style={{ color: '#4b5563' }} className="text-sm">Loading events…</div>
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(109,40,217,0.14)' }}
          className="rounded-xl p-12 text-center"
        >
          <div style={{ color: '#4b5563' }} className="text-sm">No events found</div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  style={{
                    background: 'rgba(109, 40, 217, 0.12)',
                    border: '1px solid rgba(109, 40, 217, 0.22)',
                    color: '#7c3aed',
                  }}
                  className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                >
                  {group.date}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(109, 40, 217, 0.1)' }} />
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(109, 40, 217, 0.14)',
                  backdropFilter: 'blur(12px)',
                }}
                className="rounded-xl overflow-hidden"
              >
                {group.items.map((event, i) => {
                  const type = detectEventType(event.action)
                  const cfg = EVENT_CONFIG[type]
                  const isNew = newIds.has(event.id)
                  const isLast = i === group.items.length - 1

                  return (
                    <div
                      key={event.id}
                      className={isNew ? 'realtime-fade-in' : ''}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                        background: isNew ? 'rgba(52, 211, 153, 0.04)' : 'transparent',
                        transition: 'background 0.5s',
                      }}
                    >
                      <div className="px-5 py-4 flex items-start gap-4">
                        {/* Event type icon */}
                        <div
                          style={{
                            background: cfg.bg,
                            border: `1px solid ${cfg.border}`,
                            color: cfg.color,
                            width: '28px',
                            height: '28px',
                            minWidth: '28px',
                          }}
                          className="rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        >
                          {cfg.icon}
                        </div>

                        {/* Agent avatar */}
                        <div
                          style={{
                            background: 'rgba(109, 40, 217, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            color: '#8b5cf6',
                            width: '28px',
                            height: '28px',
                            minWidth: '28px',
                          }}
                          className="rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
                        >
                          {event.agent_name.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ color: '#e9e2ff' }} className="text-sm font-semibold">{event.agent_name}</span>
                              <span
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              >
                                {cfg.label}
                              </span>
                              {isNew && (
                                <span
                                  style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                                >
                                  NEW
                                </span>
                              )}
                            </div>
                            <span style={{ color: '#374151', fontSize: '11px', fontWeight: 600 }} className="flex-shrink-0 font-mono">
                              {formatTimestamp(event.created_at)}
                            </span>
                          </div>
                          <div style={{ color: '#8b5cf6' }} className="text-sm font-semibold mb-0.5">{event.action}</div>
                          {event.details && (
                            <div style={{ color: '#4b5563' }} className="text-xs leading-relaxed">{event.details}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
