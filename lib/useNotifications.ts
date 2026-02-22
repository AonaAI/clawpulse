'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import type { Notification } from './NotificationContext'

export type { Notification }

const STORAGE_KEY = 'clawpulse_notifications_v2'
const READ_KEY = 'clawpulse_notifications_read_v2'
const SOUND_KEY = 'clawpulse_notifications_sound'
const MAX_NOTIFICATIONS = 60

function loadReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'))
  } catch { return new Set() }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(0, 300)))
}

function generateSeedNotifications(): Omit<Notification, 'read'>[] {
  const now = Date.now()
  return [
    {
      id: 'seed-1',
      type: 'success',
      title: 'Agent Status Changed',
      message: 'claude-agent-01: idle → active',
      timestamp: new Date(now - 5 * 60000).toISOString(),
    },
    {
      id: 'seed-2',
      type: 'success',
      title: 'Deploy Completed',
      message: 'ClawPulse v3.3 deployed to Firebase successfully',
      timestamp: new Date(now - 22 * 60000).toISOString(),
    },
    {
      id: 'seed-3',
      type: 'info',
      title: 'Task Completed',
      message: 'Build dashboard widgets: done',
      timestamp: new Date(now - 45 * 60000).toISOString(),
    },
    {
      id: 'seed-4',
      type: 'info',
      title: 'New Session Started',
      message: 'Agent claude-agent-01 started session #847',
      timestamp: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'seed-5',
      type: 'error',
      title: 'Error Alert',
      message: 'Agent deploy-bot crashed: OOM kill on build step',
      timestamp: new Date(now - 3 * 3600000).toISOString(),
    },
    {
      id: 'seed-6',
      type: 'warning',
      title: 'Agent Status Changed',
      message: 'deploy-bot: active → offline',
      timestamp: new Date(now - 4 * 3600000).toISOString(),
    },
  ]
}

function loadNotifications(): Omit<Notification, 'read'>[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Seed with mock data if empty (first visit)
    if (stored.length === 0) {
      const seed = generateSeedNotifications()
      saveNotifications(seed)
      return seed
    }
    return stored
  } catch { return generateSeedNotifications() }
}

function saveNotifications(notifs: Omit<Notification, 'read'>[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFICATIONS)))
}

export function useNotifications() {
  const [rawNotifications, setRawNotifications] = useState<Omit<Notification, 'read'>[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts, setToasts] = useState<Notification[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    setRawNotifications(loadNotifications())
    setReadIds(loadReadIds())
    setSoundEnabled(localStorage.getItem(SOUND_KEY) === 'true')
  }, [])

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotif: Omit<Notification, 'read'> = {
      ...notif,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    }
    setRawNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS)
      saveNotifications(updated)
      return updated
    })
    // Show toast (with read: false for the toast type)
    const toastNotif: Notification = { ...newNotif, read: false }
    setToasts(prev => [...prev, toastNotif])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newNotif.id))
    }, 5500)
    // Play sound
    if (localStorage.getItem(SOUND_KEY) === 'true') {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('data:audio/wav;base64,UklGRlQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTAFAACAgICAgICAgICHj5eTkIuIhoiLj5OVlZKNiISBgIKGi4+Sk5GPioWBf4CDh4uOkJCOioaCgIGEiIuNjo2LiIWDgoOFh4mLi4qIhoSDg4SFh4iJiYiHhYSEhIWGh4iIh4aFhISEhYaHh4eGhYSEhIWFhoaGhoWEhISEhYWGhoaFhISEhIWFhYWFhYSEhISFhYWFhYWEhISEhYWFhYWFhISEhIWFhYWFhYSEhISEhYWFhYSEhISEhISFhYWFhISEhISEhIWFhYSEhISEhISEhYSEhISEhISEhISEhISEhISEhISEhISEhISEhA==')
          audioRef.current.volume = 0.25
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
      rawNotifications.forEach(n => next.add(n.id))
      saveReadIds(next)
      return next
    })
  }, [rawNotifications])

  const dismissAll = useCallback(() => {
    setRawNotifications([])
    saveNotifications([])
    setReadIds(new Set())
    saveReadIds(new Set())
  }, [])

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

  // Subscribe to realtime changes
  useRealtimeSubscription([
    {
      table: 'activity_log',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const action = record.action as string || ''
        const details = record.details as string || ''
        const isError = action?.toLowerCase().includes('error') || details?.toLowerCase().includes('error')
        addNotification({
          type: isError ? 'error' : 'success',
          title: isError ? 'Error Detected' : 'Activity',
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
          const isError = newStatus === 'error' || newStatus === 'crashed'
          const isIdle = newStatus === 'idle' || newStatus === 'done'
          addNotification({
            type: isError ? 'error' : isIdle ? 'info' : 'success',
            title: 'Agent Status Changed',
            message: `${name}: ${oldStatus} → ${newStatus}`,
          })
        }
      },
    },
    {
      table: 'tasks',
      event: '*',
      onInsert: (record: Record<string, unknown>) => {
        const title = (record.title as string) || (record.name as string) || 'New task'
        addNotification({
          type: 'info',
          title: 'Task Created',
          message: title.slice(0, 120),
        })
      },
      onUpdate: (record: Record<string, unknown>, old: Partial<Record<string, unknown>>) => {
        const oldStatus = old.status as string
        const newStatus = record.status as string
        const title = (record.title as string) || (record.name as string) || 'Task'
        if (oldStatus && newStatus && oldStatus !== newStatus) {
          const isDone = newStatus === 'done' || newStatus === 'completed'
          const isFailed = newStatus === 'failed' || newStatus === 'error'
          addNotification({
            type: isDone ? 'success' : isFailed ? 'error' : 'info',
            title: isDone ? 'Task Completed' : isFailed ? 'Task Failed' : 'Task Updated',
            message: `${title}: ${oldStatus} → ${newStatus}`.slice(0, 120),
          })
        }
      },
    },
    {
      table: 'slack_messages',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const channel = record.channel as string || 'Slack'
        const message = record.message as string || ''
        addNotification({
          type: 'info',
          title: `#${channel}`,
          message: message.slice(0, 120),
        })
      },
    },
  ])

  const notifications: Notification[] = rawNotifications.map(n => ({
    ...n,
    read: readIds.has(n.id),
  }))

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    toasts,
    soundEnabled,
    addNotification,
    markAsRead,
    markAllRead,
    dismissAll,
    toggleSound,
    dismissToast,
  }
}
