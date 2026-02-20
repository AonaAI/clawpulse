'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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

/**
 * Reusable hook for Supabase Realtime postgres_changes subscriptions.
 * Returns `isConnected` boolean for UI indicators.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
  configs: SubscriptionConfig<T>[],
  deps: unknown[] = [],
) {
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
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
      setIsConnected(status === 'SUBSCRIBED')
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      setIsConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { isConnected }
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
  deps: unknown[] = [],
) {
  return useRealtimeSubscription<T>([{ table, ...callbacks }], deps)
}
