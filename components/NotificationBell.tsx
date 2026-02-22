'use client'

import { useState, useRef, useEffect } from 'react'
import type { Notification } from '@/lib/useNotifications'

interface Props {
  notifications: (Notification & { read: boolean })[]
  unreadCount: number
  soundEnabled: boolean
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onToggleSound: () => void
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const typeColors: Record<string, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  info: '#8b5cf6',
  agent_status: '#8b5cf6',
  deploy: '#10b981',
  task: '#3b82f6',
  task_complete: '#10b981',
  session: '#6366f1',
  system: '#8b5cf6',
  slack_message: '#3b82f6',
}

export default function NotificationBell({ notifications, unreadCount, soundEnabled, onMarkRead, onMarkAllRead, onToggleSound }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        style={{
          color: 'var(--cp-text-nav)',
          background: open ? 'rgba(109,40,217,0.15)' : 'transparent',
          border: '1px solid transparent',
        }}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ef4444',
              fontSize: '10px',
              lineHeight: '16px',
              minWidth: '16px',
              boxShadow: '0 0 8px rgba(239,68,68,0.5)',
            }}
            className="absolute -top-1 -right-1 text-white font-bold rounded-full px-1 text-center animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            background: 'var(--cp-panel-bg)',
            border: '1px solid var(--cp-border-stronger)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            width: '360px',
            maxHeight: '480px',
          }}
          className="absolute right-0 top-12 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div
            style={{ borderBottom: '1px solid var(--cp-divider-accent)' }}
            className="px-4 py-3 flex items-center justify-between"
          >
            <span style={{ color: 'var(--cp-text-primary)' }} className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleSound}
                style={{ color: soundEnabled ? '#8b5cf6' : '#4a3660' }}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
                title={soundEnabled ? 'Mute notifications' : 'Enable notification sound'}
              >
                {soundEnabled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  style={{ color: '#8b5cf6' }}
                  className="text-xs font-medium hover:underline px-1"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
            {notifications.length === 0 ? (
              <div style={{ color: 'var(--cp-text-notification-dim)' }} className="py-12 text-center text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 30).map(notif => (
                <button
                  key={notif.id}
                  onClick={() => onMarkRead(notif.id)}
                  style={{
                    background: notif.read ? 'transparent' : 'rgba(109,40,217,0.06)',
                    borderBottom: '1px solid var(--cp-divider-accent)',
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex gap-3"
                >
                  <div
                    style={{ background: typeColors[notif.type] || '#6b7280', opacity: notif.read ? 0.3 : 1 }}
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{ color: notif.read ? '#5a4478' : '#ddd6fe' }}
                        className="text-xs font-semibold truncate"
                      >
                        {notif.title}
                      </span>
                      <span style={{ color: 'var(--cp-text-notification-dim)' }} className="text-[10px] flex-shrink-0">
                        {timeAgo(notif.timestamp)}
                      </span>
                    </div>
                    <p
                      style={{ color: notif.read ? '#3b1d6e' : '#7c5fa0' }}
                      className="text-xs mt-0.5 truncate"
                    >
                      {notif.message}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
