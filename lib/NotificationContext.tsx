'use client'

import { createContext, useContext } from 'react'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
}

export interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  toasts: Notification[]
  soundEnabled: boolean
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void
  markAsRead: (id: string) => void
  markAllRead: () => void
  dismissAll: () => void
  toggleSound: () => void
  dismissToast: (id: string) => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotificationContext must be used within NotificationProvider')
  return ctx
}
