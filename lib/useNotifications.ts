'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useAuth } from '@/components/AuthProvider'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import type { Notification } from './NotificationContext'

export type { Notification }

const SOUND_KEY = 'clawpulse_notifications_sound'
const MAX_NOTIFICATIONS = 50

// Map a Supabase row to our in-memory Notification shape
function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    type: (row.type as string) || 'info',
    title: (row.title as string) || '',
    message: (row.description as string) || '',
    timestamp: (row.created_at as string) || new Date().toISOString(),
    read: Boolean(row.read),
  }
}

export function useNotifications() {
  const { user } = useAuth()
  // Stable ref so stale realtime callbacks can always access the current user
  const userRef = useRef(user)
  userRef.current = user

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [toasts, setToasts] = useState<Notification[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load sound preference
  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) === 'true')
  }, [])

  // ── Fetch from Supabase ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${currentUser.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS)
    if (error) {
      console.error('Error fetching notifications:', error)
      return
    }
    setNotifications((data || []).map(rowToNotification))
  }, [])

  useEffect(() => {
    if (user) fetchNotifications()
  }, [user, fetchNotifications])

  // ── Sound ──────────────────────────────────────────────────────────────────
  const playSound = useCallback(() => {
    if (localStorage.getItem(SOUND_KEY) !== 'true') return
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRlQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTAFAACAgICAgICAgICHj5eTkIuIhoiLj5OVlZKNiISBgIKGi4+Sk5GPioWBf4CDh4uOkJCOioaCgIGEiIuNjo2LiIWDgoOFh4mLi4qIhoSDg4SFh4iJiYiHhYSEhIWGh4iIh4aFhISEhYaHh4eGhYSEhIWFhoaGhoWEhISEhYWGhoaFhISEhIWFhYWFhYSEhISFhYWFhYWEhISEhYWFhYWFhISEhIWFhYWFhYSEhISEhYWFhYSEhISEhISFhYWFhISEhISEhIWFhYSEhISEhISEhYSEhISEhISEhISEhISEhISEhISEhISEhISEhA==')
        audioRef.current.volume = 0.25
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }, [])

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((notif: Notification) => {
    setToasts(prev => [...prev, notif])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== notif.id))
    }, 5500)
  }, [])

  // ── INSERT notification into Supabase ──────────────────────────────────────
  // Uses ref so it's safe to call from stale realtime callbacks
  const addNotification = useCallback(async (notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const currentUser = userRef.current
    if (!currentUser) return
    await supabase.from('notifications').insert([{
      type: notif.type,
      title: notif.title,
      description: notif.message,
      read: false,
      user_id: currentUser.id,
    }])
    // The realtime INSERT subscription on `notifications` will update state + toast
  }, [])

  // ── Mark single notification read ──────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const currentUser = userRef.current
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    if (!currentUser) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUser.id)
      .eq('read', false)
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
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

  // ── Realtime: incoming notifications ───────────────────────────────────────
  useRealtimeSubscription([
    {
      table: 'notifications',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const userId = record.user_id as string | null
        const currentUserId = userRef.current?.id
        if (userId !== null && userId !== currentUserId) return
        const notif = rowToNotification(record)
        setNotifications(prev => {
          if (prev.find(n => n.id === notif.id)) return prev
          return [notif, ...prev].slice(0, MAX_NOTIFICATIONS)
        })
        showToast(notif)
        playSound()
      },
    },
  ])

  // ── Realtime: write notifications from system events ───────────────────────
  useRealtimeSubscription([
    {
      table: 'activity_log',
      event: 'INSERT',
      onInsert: (record: Record<string, unknown>) => {
        const action = (record.action as string) || ''
        const details = (record.details as string) || ''
        const isError = action.toLowerCase().includes('error') || details.toLowerCase().includes('error')
        const isDeploy = action.toLowerCase().includes('deploy')
        if (!isError && !isDeploy) return
        addNotification({
          type: isError ? 'error' : 'success',
          title: isError ? 'Error Detected' : 'Deploy',
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
        const channel = (record.channel as string) || 'Slack'
        const message = (record.message as string) || ''
        addNotification({
          type: 'info',
          title: `#${channel}`,
          message: message.slice(0, 120),
        })
      },
    },
  ])

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
