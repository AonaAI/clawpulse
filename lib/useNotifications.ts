'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

export interface Notification {
  id: string
  type: 'agent_status' | 'task_complete' | 'error' | 'slack_message'
  title: string
  message: string
  timestamp: string
  read: boolean
}

const STORAGE_KEY = 'clawpulse_notifications'
const READ_KEY = 'clawpulse_notifications_read'
const SOUND_KEY = 'clawpulse_notifications_sound'
const MAX_NOTIFICATIONS = 50

function loadReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'))
  } catch { return new Set() }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(0, 200)))
}

function loadNotifications(): Notification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveNotifications(notifs: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFICATIONS)))
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts, setToasts] = useState<Notification[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications())
    setReadIds(loadReadIds())
    setSoundEnabled(localStorage.getItem(SOUND_KEY) === 'true')
  }, [])

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS)
      saveNotifications(updated)
      return updated
    })
    // Show toast
    setToasts(prev => [...prev, newNotif])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newNotif.id))
    }, 5000)
    // Play sound
    if (localStorage.getItem(SOUND_KEY) === 'true') {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('data:audio/wav;base64,UklGRlQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTAFAACAgICAgICAgICHj5eTkIuIhoiLj5OVlZKNiISBgIKGi4+Sk5GPioWBf4CDh4uOkJCOioaCgIGEiIuNjo2LiIWDgoOFh4mLi4qIhoSDg4SFh4iJiYiHhYSEhIWGh4iIh4aFhISEhYaHh4eGhYSEhIWFhoaGhoWEhISEhYWGhoaFhISEhIWFhYWFhYSEhISFhYWFhYWEhISEhYWFhYWFhISEhIWFhYWFhYSEhISEhYWFhYSEhISEhISFhYWFhISEhISEhIWFhYSEhISEhISEhYSEhISEhISEhISEhISEhISEhISEhISEhISEhA==')
          audioRef.current.volume = 0.3
        }
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      } catch {}
    }
  }, [])

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev)
      notifications.forEach(n => next.add(n.id))
      saveReadIds(next)
      return next
    })
  }, [notifications])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev
      localStorage.setItem(SOUND_KEY, String(next))
      return next
    })
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Subscribe to realtime
  useRealtimeSubscription([
    {
      table: 'activity_log',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const action = record.action as string || ''
        const details = record.details as string || ''
        const isError = action?.toLowerCase().includes('error') || details?.toLowerCase().includes('error')
        addNotification({
          type: isError ? 'error' : 'task_complete',
          title: isError ? '⚠️ Error' : '📋 Activity',
          message: `${action}${details ? ': ' + details : ''}`.slice(0, 120),
        })
      },
    },
    {
      table: 'agents',
      event: 'UPDATE',
      onUpdate: (record: Record<string, unknown>, old: Partial<Record<string, unknown>>) => {
        const oldStatus = old.status as string
        const newStatus = record.status as string
        const name = (record.name as string) || (record.id as string) || 'Agent'
        if (oldStatus && newStatus && oldStatus !== newStatus) {
          addNotification({
            type: 'agent_status',
            title: '🤖 Agent Status',
            message: `${name}: ${oldStatus} → ${newStatus}`,
          })
        }
      },
    },
    {
      table: 'slack_messages',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const channel = record.channel as string || ''
        const message = record.message as string || ''
        addNotification({
          type: 'slack_message',
          title: `💬 ${channel}`,
          message: message.slice(0, 120),
        })
      },
    },
  ])

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length

  return {
    notifications: notifications.map(n => ({ ...n, read: readIds.has(n.id) })),
    unreadCount,
    toasts,
    soundEnabled,
    markAsRead,
    markAllRead,
    toggleSound,
    dismissToast,
  }
}
