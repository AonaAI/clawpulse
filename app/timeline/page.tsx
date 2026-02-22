'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'
import { AGENTS } from '@/lib/data'
import { DateRangePicker } from '@/components/DateRangePicker'

// ── Types ────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
}

type ActionType = 'deploy' | 'commit' | 'tool_call' | 'system' | 'message' | 'error' | 'task' | 'other'

// ── Agent colors ─────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  main: '#a78bfa',
  dev: '#38bdf8',
  pm: '#34d399',
  seo: '#fbbf24',
  design: '#f472b6',
  research: '#fb923c',
  growth: '#22d3ee',
  sales: '#e879f9',
  pulse: '#818cf8',
}

function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId] || '#8b5cf6'
}

// ── Action type detection ────────────────────────────────────────────────────

function detectActionType(action: string): ActionType {
  const a = action.toLowerCase()
  if (a.includes('deploy') || a.includes('publish') || a.includes('release') || a.includes('ship')) return 'deploy'
  if (a.includes('commit') || a.includes('push') || a.includes('merge') || a.includes('pr')) return 'commit'
  if (a.includes('tool') || a.includes('function') || a.includes('invoke') || a.includes('call')) return 'tool_call'
  if (a.includes('system') || a.includes('cron') || a.includes('heartbeat') || a.includes('schedule')) return 'system'
  if (a.includes('message') || a.includes('slack') || a.includes('send') || a.includes('notify') || a.includes('comm')) return 'message'
  if (a.includes('error') || a.includes('fail') || a.includes('crash')) return 'error'
  if (a.includes('task') || a.includes('start') || a.includes('complet') || a.includes('done')) return 'task'
  return 'other'
}

const ACTION_CONFIG: Record<ActionType, { color: string; label: string; icon: React.ReactNode }> = {
  deploy: {
    color: '#f59e0b', label: 'Deploy',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  },
  commit: {
    color: '#34d399', label: 'Commit',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" /></svg>,
  },
  tool_call: {
    color: '#818cf8', label: 'Tool Call',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  },
  system: {
    color: '#60a5fa', label: 'System',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  },
  message: {
    color: '#22d3ee', label: 'Message',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  error: {
    color: '#f87171', label: 'Error',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  },
  task: {
    color: '#a78bfa', label: 'Task',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  },
  other: {
    color: '#94a3b8', label: 'Other',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  },
}

const ALL_ACTION_TYPES: ActionType[] = ['deploy', 'commit', 'tool_call', 'system', 'message', 'error', 'task', 'other']

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFullTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  }
}

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Page Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<ActionType[]>([])
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Expanded events
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Animation refs
  const observerRef = useRef<IntersectionObserver | null>(null)
  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchEvents = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      let query = supabase
        .from('activity_log')
        .select('*, agent:agents(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)
      if (selectedAgents.length > 0) query = query.in('agent_id', selectedAgents)

      const { data, error, count } = await query

      if (error) {
        console.error('Error fetching timeline:', error)
        return
      }

      let items: TimelineEvent[] = (data || []).map(item => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent?.name || item.agent_id,
        action: item.action,
        details: item.details || '',
        metadata: item.metadata || {},
        created_at: item.created_at,
      }))

      // Client-side type filter
      if (selectedTypes.length > 0) {
        items = items.filter(e => selectedTypes.includes(detectActionType(e.action)))
      }

      setTotal(count ?? 0)
      setHasMore((data?.length ?? 0) === PAGE_SIZE)

      if (append) {
        setEvents(prev => [...prev, ...items])
      } else {
        setEvents(items)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [dateFrom, dateTo, selectedAgents, selectedTypes])

  useEffect(() => {
    fetchEvents(0, false)
  }, [fetchEvents])

  // Scroll animation observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('timeline-visible')
            observerRef.current?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    eventRefs.current.forEach((el) => {
      observerRef.current?.observe(el)
    })
  }, [events])

  const handleLoadMore = () => {
    fetchEvents(events.length, true)
  }

  const handleDateChange = (range: { from: string; to: string }) => {
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]
    )
  }

  const toggleType = (type: ActionType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // Group events by date
  const groupedEvents: { date: string; events: TimelineEvent[] }[] = []
  let currentDate = ''
  for (const event of events) {
    const { date } = formatFullTimestamp(event.created_at)
    if (date !== currentDate) {
      currentDate = date
      groupedEvents.push({ date, events: [] })
    }
    groupedEvents[groupedEvents.length - 1].events.push(event)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <style jsx global>{`
        .timeline-event {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .timeline-event-anim {
          opacity: 0;
          transform: translateY(12px);
        }
        .timeline-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .timeline-details-enter {
          animation: detailsSlideIn 0.25s ease forwards;
        }
        @keyframes detailsSlideIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-2xl sm:text-3xl font-bold tracking-tight">
          Timeline
        </h1>
        <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1">
          Visual history of all agent actions over time
        </p>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: 'rgba(17, 2, 29, 0.6)',
          border: '1px solid rgba(109, 40, 217, 0.14)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl p-4 mb-6 space-y-3"
      >
        {/* Date range */}
        <DateRangePicker onChange={handleDateChange} />

        {/* Agent filter */}
        <div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider mb-2">Agents</div>
          <div className="flex flex-wrap gap-1.5">
            {AGENTS.map(agent => {
              const isSelected = selectedAgents.includes(agent.id)
              const color = getAgentColor(agent.id)
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  style={{
                    background: isSelected ? `${color}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? `${color}60` : 'rgba(255,255,255,0.08)'}`,
                    color: isSelected ? color : 'var(--cp-text-muted)',
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-125"
                >
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, marginRight: 6, opacity: isSelected ? 1 : 0.4 }} />
                  {agent.name}
                </button>
              )
            })}
            {selectedAgents.length > 0 && (
              <button
                onClick={() => setSelectedAgents([])}
                style={{ color: '#6b7280' }}
                className="px-2 py-1 text-xs hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Event type filter */}
        <div>
          <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider mb-2">Event Type</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ACTION_TYPES.map(type => {
              const cfg = ACTION_CONFIG[type]
              const isSelected = selectedTypes.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  style={{
                    background: isSelected ? `${cfg.color}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? `${cfg.color}60` : 'rgba(255,255,255,0.08)'}`,
                    color: isSelected ? cfg.color : 'var(--cp-text-muted)',
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 hover:brightness-125"
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              )
            })}
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                style={{ color: '#6b7280' }}
                className="px-2 py-1 text-xs hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Event count */}
      <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mb-4">
        {loading ? 'Loading…' : `${events.length} of ${total} events`}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton-shimmer" style={{ width: 60, height: 14, borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ width: 12, height: 12, borderRadius: '50%' }} />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer" style={{ width: '60%', height: 16, borderRadius: 6 }} />
                <div className="skeleton-shimmer" style={{ width: '90%', height: 12, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            background: 'rgba(17, 2, 29, 0.6)',
            border: '1px solid rgba(109, 40, 217, 0.14)',
            borderRadius: 12,
          }}
          className="text-center py-16 px-6"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(109,40,217,0.4)" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <line x1="12" y1="2" x2="12" y2="22" />
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
            <line x1="14" y1="6" x2="20" y2="6" />
            <line x1="14" y1="12" x2="20" y2="12" />
            <line x1="14" y1="18" x2="20" y2="18" />
          </svg>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: 14, fontWeight: 600 }}>No events found</div>
          <div style={{ color: 'var(--cp-text-dim)', fontSize: 12, marginTop: 6, maxWidth: 320, margin: '6px auto 0' }}>
            {selectedAgents.length > 0 || selectedTypes.length > 0 || dateFrom || dateTo
              ? 'Try clearing some filters to see more events.'
              : 'Agent activity events will appear here as agents run tasks and log actions.'}
          </div>
          {(selectedAgents.length > 0 || selectedTypes.length > 0) && (
            <button
              onClick={() => { setSelectedAgents([]); setSelectedTypes([]) }}
              style={{
                marginTop: 12,
                background: 'rgba(109,40,217,0.15)',
                border: '1px solid rgba(109,40,217,0.3)',
                color: '#c4b5fd',
                borderRadius: 8,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Timeline connecting line */}
          <div
            style={{
              position: 'absolute',
              left: 89,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'var(--cp-badge-bg)',
              zIndex: 0,
            }}
          />

          {groupedEvents.map((group) => (
            <div key={group.date} className="mb-6">
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div
                  style={{
                    background: 'rgba(109, 40, 217, 0.15)',
                    border: '1px solid rgba(109, 40, 217, 0.3)',
                    color: '#c4b5fd',
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                >
                  {group.date}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(109,40,217,0.12)' }} />
              </div>

              {/* Events */}
              <div className="space-y-0">
                {group.events.map((event) => {
                  const { time } = formatFullTimestamp(event.created_at)
                  const actionType = detectActionType(event.action)
                  const actionCfg = ACTION_CONFIG[actionType]
                  const agentColor = getAgentColor(event.agent_id)
                  const isExpanded = expandedIds.has(event.id)
                  const hasDetails = event.details || (event.metadata && Object.keys(event.metadata).length > 0)

                  return (
                    <div
                      key={event.id}
                      ref={(el) => { if (el) eventRefs.current.set(event.id, el) }}
                      className="timeline-event flex items-start gap-0 relative"
                      style={{ minHeight: 56, paddingBottom: 4, opacity: 1 }}
                    >
                      {/* Timestamp */}
                      <div
                        style={{ color: 'var(--cp-text-dim)', width: 76, flexShrink: 0, textAlign: 'right', paddingRight: 12 }}
                        className="text-xs font-mono pt-1.5"
                      >
                        {time}
                      </div>

                      {/* Agent-colored dot on the line */}
                      <div
                        style={{
                          width: 28,
                          flexShrink: 0,
                          display: 'flex',
                          justifyContent: 'center',
                          position: 'relative',
                          zIndex: 1,
                        }}
                        className="pt-1"
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: agentColor,
                            border: '2px solid #0f0520',
                            boxShadow: `0 0 8px ${agentColor}60`,
                          }}
                        />
                      </div>

                      {/* Event content */}
                      <div
                        onClick={() => hasDetails && toggleExpanded(event.id)}
                        style={{
                          background: isExpanded ? 'rgba(109, 40, 217, 0.08)' : 'transparent',
                          borderRadius: 10,
                          cursor: hasDetails ? 'pointer' : 'default',
                          transition: 'background 0.2s',
                        }}
                        className="flex-1 py-1 px-3 hover:bg-white/[0.02] min-w-0"
                      >
                        {/* Top row: agent + action type */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Agent avatar */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: `${agentColor}25`,
                              border: `1.5px solid ${agentColor}60`,
                              color: agentColor,
                              fontSize: 9,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(event.agent_name)}
                          </div>
                          <span style={{ color: agentColor, fontWeight: 600, fontSize: 13 }}>
                            {event.agent_name}
                          </span>

                          {/* Action type badge */}
                          <span
                            style={{
                              background: `${actionCfg.color}15`,
                              border: `1px solid ${actionCfg.color}40`,
                              color: actionCfg.color,
                              fontSize: 10,
                              padding: '1px 7px',
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: 600,
                            }}
                          >
                            {actionCfg.icon}
                            {actionCfg.label}
                          </span>
                        </div>

                        {/* Action description */}
                        <p style={{ color: 'var(--cp-text-secondary, #c4b5fd)', fontSize: 13, marginTop: 2 }} className="leading-snug">
                          {event.action}
                        </p>

                        {/* Expandable details */}
                        {isExpanded && hasDetails && (
                          <div className="timeline-details-enter mt-2 overflow-hidden">
                            {event.details && (
                              <p style={{ color: 'var(--cp-text-muted)', fontSize: 12, lineHeight: 1.5 }} className="mb-2 whitespace-pre-wrap">
                                {event.details}
                              </p>
                            )}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <pre
                                style={{
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(109,40,217,0.15)',
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  fontSize: 11,
                                  color: '#94a3b8',
                                  overflow: 'auto',
                                  maxHeight: 200,
                                }}
                              >
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}

                        {/* Expand hint */}
                        {hasDetails && !isExpanded && (
                          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, marginTop: 2, opacity: 0.5 }}>
                            Click to expand
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-6 relative z-10">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  background: 'rgba(109, 40, 217, 0.15)',
                  border: '1px solid rgba(109, 40, 217, 0.3)',
                  color: '#c4b5fd',
                }}
                className="px-6 py-2 rounded-lg text-sm font-medium hover:brightness-125 transition-all disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
