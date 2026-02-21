'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface SubscriptionConfig<T extends Record<string, unknown>> {
  table: string
  event?: PostgresEvent
  schema?: string
  filter?: string
  onInsert?: (record: T) => void
  onUpdate?: (record: T, old: Partial<T>) => void
  onDelete?: (old: Partial<T>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void
}

export interface SubscriptionOptions {
  /** Extra deps that trigger re-subscription (e.g. [agentId] when filter changes) */
  deps?: unknown[]
  /** Called immediately and every `fallbackInterval`ms when WebSocket is not connected */
  onFallbackRefresh?: () => void
  /** Interval in ms for fallback polling. Default: 60_000 */
  fallbackInterval?: number
}

/**
 * Reusable hook for Supabase Realtime postgres_changes subscriptions.
 *
 * Returns:
 *   - `connectionStatus`: 'connected' | 'reconnecting' | 'disconnected'
 *   - `isConnected`: boolean shorthand for connectionStatus === 'connected'
 *
 * When WebSocket is not connected, `onFallbackRefresh` is called immediately
 * then every `fallbackInterval`ms (default 60s) until the socket reconnects.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  configs: SubscriptionConfig<T>[],
  options: SubscriptionOptions = {},
) {
  const { deps = [], onFallbackRefresh, fallbackInterval = 60_000 } = options

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Keep a stable ref so the fallback interval always calls the latest version
  const onFallbackRefreshRef = useRef(onFallbackRefresh)
  onFallbackRefreshRef.current = onFallbackRefresh

  useEffect(() => {
    let wasConnected = false
    const channelName = `realtime-${configs.map(c => `${c.table}-${c.event ?? '*'}`).join('-')}-${Date.now()}`
    let channel = supabase.channel(channelName)

    for (const config of configs) {
      const filterObj: Record<string, string> = {
        event: config.event ?? '*',
        schema: config.schema ?? 'public',
        table: config.table,
      }
      if (config.filter) {
        filterObj.filter = config.filter
      }

      channel = channel.on(
        'postgres_changes' as never,
        filterObj as never,
        (payload: RealtimePostgresChangesPayload<T>) => {
          config.onChange?.(payload)
          if (payload.eventType === 'INSERT' && config.onInsert) {
            config.onInsert(payload.new as T)
          } else if (payload.eventType === 'UPDATE' && config.onUpdate) {
            config.onUpdate(payload.new as T, payload.old as Partial<T>)
          } else if (payload.eventType === 'DELETE' && config.onDelete) {
            config.onDelete(payload.old as Partial<T>)
          }
        },
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        wasConnected = true
        setConnectionStatus('connected')
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        setConnectionStatus(wasConnected ? 'reconnecting' : 'disconnected')
      } else if (status === 'CLOSED') {
        setConnectionStatus('disconnected')
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      setConnectionStatus('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Fallback poll: fires immediately when not connected, then every fallbackInterval ms
  useEffect(() => {
    if (connectionStatus === 'connected' || !onFallbackRefreshRef.current) return
    onFallbackRefreshRef.current()
    const id = setInterval(() => onFallbackRefreshRef.current?.(), fallbackInterval)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, fallbackInterval])

  return { connectionStatus, isConnected: connectionStatus === 'connected' }
}

/**
 * Convenience: subscribe to a single table.
 */
export function useTableSubscription<T extends Record<string, unknown>>(
  table: string,
  callbacks: {
    onInsert?: (record: T) => void
    onUpdate?: (record: T, old: Partial<T>) => void
    onDelete?: (old: Partial<T>) => void
  },
  options: SubscriptionOptions = {},
) {
  return useRealtimeSubscription<T>([{ table, ...callbacks }], options)
}
