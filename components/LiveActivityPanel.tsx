'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'

// ── Event type helpers ────────────────────────────────────────────────────────

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
  task_completed: { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  label: 'Completed' },
  task_started:   { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', label: 'Started' },
  error:          { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Error' },
  deployment:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Deployed' },
  message_sent:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  label: 'Message' },
  warning:        { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  label: 'Warning' },
  analysis:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', label: 'Analysis' },
  info:           { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  label: 'Info' },
}

function formatTimeAgoShort(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

// ── ActivityIcon SVG ──────────────────────────────────────────────────────────

function ActivityIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string
  agent_id: string
  agent_name: string
  action: string
  details: string
  created_at: string
  isNew?: boolean
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveActivityPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const newIdsRef = useRef<Set<string>>(new Set())

  // Fetch initial events when panel opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setUnreadCount(0)
    supabase
      .from('activity_log')
      .select('*, agent:agents(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const mapped: ActivityEvent[] = (data || []).map((item: Record<string, unknown> & { agent?: { name?: string } | null }) => ({
          id: item.id as string,
          agent_id: item.agent_id as string,
          agent_name: item.agent?.name || (item.agent_id as string),
          action: item.action as string,
          details: (item.details as string) || '',
          created_at: item.created_at as string,
        }))
        setEvents(mapped)
        setLoading(false)
      })
  }, [isOpen])

  // Realtime subscription — always active so unread count works when closed
  useEffect(() => {
    const channel = supabase
      .channel('live-activity-panel-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        async (payload) => {
          const row = payload.new as Record<string, unknown>
          // Fetch agent name
          const { data: agentData } = await supabase
            .from('agents')
            .select('name')
            .eq('id', row.agent_id as string)
            .single()

          const newEvent: ActivityEvent = {
            id: row.id as string,
            agent_id: row.agent_id as string,
            agent_name: agentData?.name || (row.agent_id as string),
            action: (row.action as string) || '',
            details: (row.details as string) || '',
            created_at: (row.created_at as string) || new Date().toISOString(),
            isNew: true,
          }

          newIdsRef.current.add(newEvent.id)
          setTimeout(() => {
            newIdsRef.current.delete(newEvent.id)
            setEvents(prev => prev.map(e => e.id === newEvent.id ? { ...e, isNew: false } : e))
          }, 2000)

          setEvents(prev => [newEvent, ...prev].slice(0, 50))
          setIsOpen(open => {
            if (!open) setUnreadCount(c => c + 1)
            return open
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setUnreadCount(0)
  }

  return (
    <>
      {/* Floating trigger button — visible when panel is closed */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Open live activity panel"
          title="Live Activity"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 36,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(79,46,220,0.9) 100%)',
            border: '1px solid rgba(139,92,246,0.5)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, transform 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
        >
          <ActivityIcon size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#f87171',
              border: '2px solid #0a0118',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 44,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Side panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            maxWidth: 320,
            zIndex: 46,
            background: '#0d0621',
            borderLeft: '1px solid rgba(109,40,217,0.28)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'lapSlideIn 0.22s ease',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 16px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8b5cf6' }}>
                <ActivityIcon size={16} />
              </span>
              <span style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: 14 }}>
                Live Activity
              </span>
              {/* Live indicator */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: 999, padding: '2px 8px',
              }} className="realtime-live-badge">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span style={{ color: '#34d399', fontSize: 10, fontWeight: 600 }}>Live</span>
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close live activity panel"
              title="Close"
              style={{
                color: 'var(--cp-text-dim)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Events list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: '16px' }} className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }} className="animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div style={{ color: 'var(--cp-text-dim)', fontSize: 13, padding: '32px 16px', textAlign: 'center', fontStyle: 'italic' }}>
                No activity yet
              </div>
            ) : (
              events.map((event, i) => {
                const evType = detectEventType(event.action)
                const evCfg = EVENT_CONFIG[evType]
                const initials = event.agent_name.slice(0, 2).toUpperCase()
                return (
                  <div
                    key={event.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: event.isNew ? 'rgba(139,92,246,0.04)' : 'transparent',
                      transition: 'background 0.4s',
                    }}
                    className={event.isNew ? 'realtime-fade-in' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 28, height: 28, minWidth: 28, borderRadius: 8,
                        background: 'rgba(109,40,217,0.15)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        color: '#8b5cf6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, flexShrink: 0,
                      }}>
                        {initials}
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                          <span style={{ color: 'var(--cp-text-card-title)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                            {event.agent_name}
                          </span>
                          <span style={{ color: 'var(--cp-text-dimmer)', fontSize: 10, flexShrink: 0 }}>
                            {formatTimeAgoShort(event.created_at)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            color: evCfg.color, background: evCfg.bg, border: `1px solid ${evCfg.border}`,
                            fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                            flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {evCfg.label}
                          </span>
                          <span style={{ color: 'var(--cp-text-muted)', fontSize: 11, fontWeight: 500 }} className="truncate">
                            {event.action}
                          </span>
                        </div>
                        {event.details && (
                          <div style={{ color: 'var(--cp-text-dim)', fontSize: 10, marginTop: 3, lineHeight: 1.5 }} className="truncate">
                            {event.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--cp-text-dim)', fontSize: 11 }}>
              {events.length} events
            </span>
            <a
              href="/activity"
              style={{
                color: '#8b5cf6', fontSize: 11, fontWeight: 600,
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Full log
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes lapSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
