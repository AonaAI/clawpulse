'use client'

import type { Notification } from '@/lib/useNotifications'

const typeColors: Record<string, string> = {
  error: '#ef4444',
  agent_status: '#8b5cf6',
  task_complete: '#10b981',
  slack_message: '#3b82f6',
}

interface Props {
  toasts: Notification[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '340px' }}>
      {toasts.slice(-5).map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-right-5 fade-in duration-300"
          style={{
            background: 'var(--cp-panel-bg)',
            border: `1px solid ${typeColors[toast.type] || '#6b7280'}33`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${typeColors[toast.type] || '#6b7280'}15`,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{ background: typeColors[toast.type] || '#6b7280' }}
            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div style={{ color: 'var(--cp-text-notification-unread)' }} className="text-xs font-semibold truncate">
              {toast.title}
            </div>
            <p style={{ color: 'var(--cp-text-nav)' }} className="text-xs mt-0.5 truncate">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            style={{ color: 'var(--cp-text-notification-dim)' }}
            className="flex-shrink-0 hover:text-white/50 transition-colors mt-0.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
