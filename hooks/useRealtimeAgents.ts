'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchAgentLiveStatus } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import type { AgentStatus, AgentLive, MergedAgent } from '@/lib/types'
import type { ConnectionStatus } from '@/lib/useRealtimeSubscription'

const isDev = process.env.NODE_ENV === 'development'

function mergeLiveData(live: (AgentLive & { dir: string })[]): MergedAgent[] {
  const liveMap = new Map(live.map(d => [d.dir, d]))
  return AGENTS.map(agent => {
    const lookup = agent.dir ?? agent.id
    const data = liveMap.get(lookup)
    return {
      ...agent,
      status: (data?.status ?? 'offline') as AgentStatus,
      sessionCount: data?.sessionCount ?? 0,
      lastActive: data?.lastActive ?? null,
      totalTokens: data?.totalTokens ?? 0,
    }
  })
}

/** Parse current_task JSON for sessionCount / totalTokens */
function parseTaskMeta(currentTask: unknown): { sessionCount: number; totalTokens: number } {
  try {
    const meta = JSON.parse((currentTask as string) || '{}')
    return { sessionCount: meta.sessionCount || 0, totalTokens: meta.totalTokens || 0 }
  } catch {
    return { sessionCount: 0, totalTokens: 0 }
  }
}

const UNKNOWN_AGENTS: MergedAgent[] = AGENTS.map(a => ({
  ...a,
  status: 'unknown' as AgentStatus,
  sessionCount: 0,
  lastActive: null,
  totalTokens: 0,
}))

export type PulseType = 'online' | 'offline' | null

export interface UseRealtimeAgentsResult {
  agents: MergedAgent[]
  loading: boolean
  error: boolean
  connectionStatus: ConnectionStatus
  isConnected: boolean
  /** Map of agent id → pulse type (set for 2s after a status change) */
  pulses: Map<string, PulseType>
  refresh: () => Promise<void>
  lastRefreshed: Date | null
}

export function useRealtimeAgents(): UseRealtimeAgentsResult {
  const [agents, setAgents] = useState<MergedAgent[]>(UNKNOWN_AGENTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [pulses, setPulses] = useState<Map<string, PulseType>>(new Map())
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Monotonic counter to prevent stale fetch responses from overwriting newer realtime data
  const updateSeqRef = useRef(0)

  const fetchAgents = useCallback(async () => {
    const fetchSeq = ++updateSeqRef.current
    try {
      const live = await fetchAgentLiveStatus()
      // Only apply if no realtime update arrived while we were fetching
      if (updateSeqRef.current === fetchSeq) {
        setAgents(mergeLiveData(live))
        setLastRefreshed(new Date())
        setError(false)
      } else if (isDev) {
        console.debug('[ClawPulse RT] Skipped stale fetch (seq %d < %d)', fetchSeq, updateSeqRef.current)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const triggerPulse = useCallback((agentId: string, type: PulseType) => {
    // Clear existing timer for this agent
    const existing = pulseTimers.current.get(agentId)
    if (existing) clearTimeout(existing)

    setPulses(prev => new Map(prev).set(agentId, type))

    const timer = setTimeout(() => {
      setPulses(prev => {
        const next = new Map(prev)
        next.delete(agentId)
        return next
      })
      pulseTimers.current.delete(agentId)
    }, 2000)

    pulseTimers.current.set(agentId, timer)
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      pulseTimers.current.forEach(t => clearTimeout(t))
    }
  }, [])

  const handleAgentUpdate = useCallback((record: Record<string, unknown>) => {
    // Bump sequence so any in-flight fetch won't overwrite this newer data
    updateSeqRef.current++

    const id = record.id as string
    const newStatus = record.status as AgentStatus
    const lastActivity = record.last_activity as string | null
    const { sessionCount, totalTokens } = parseTaskMeta(record.current_task)

    if (isDev) {
      console.debug('[ClawPulse RT] Agent update:', { id, status: newStatus, lastActivity, sessionCount, totalTokens })
    }

    setAgents(prev => {
      const agent = prev.find(a => a.id === id || a.dir === id)
      if (!agent) {
        if (isDev) console.warn('[ClawPulse RT] Unknown agent id in realtime event:', id)
        return prev
      }

      if (agent.status !== newStatus) {
        const isComingOnline = newStatus === 'working' || newStatus === 'idle'
        const isGoingOffline = newStatus === 'offline'
        if (isComingOnline) triggerPulse(agent.id, 'online')
        else if (isGoingOffline) triggerPulse(agent.id, 'offline')
      }

      return prev.map(a =>
        (a.id === id || a.dir === id)
          ? {
              ...a,
              status: newStatus || a.status,
              ...(lastActivity != null ? { lastActive: new Date(lastActivity).getTime() } : {}),
              ...(record.current_task !== undefined ? { sessionCount, totalTokens } : {}),
            }
          : a
      )
    })
  }, [triggerPulse])

  const { connectionStatus, isConnected } = useRealtimeSubscription([
    { table: 'agents', event: 'UPDATE', onUpdate: handleAgentUpdate },
  ], { onFallbackRefresh: fetchAgents })

  return {
    agents,
    loading,
    error,
    connectionStatus,
    isConnected,
    pulses,
    refresh: fetchAgents,
    lastRefreshed,
  }
}
