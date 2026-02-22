'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchAgentLiveStatus } from '@/lib/supabase-client'
import { useRealtimeSubscription } from '@/lib/useRealtimeSubscription'
import type { AgentStatus, AgentLive, MergedAgent } from '@/lib/types'
import type { ConnectionStatus } from '@/lib/useRealtimeSubscription'

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

  const fetchAgents = useCallback(async () => {
    try {
      const live = await fetchAgentLiveStatus()
      setAgents(mergeLiveData(live))
      setLastRefreshed(new Date())
      setError(false)
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
    const id = record.id as string
    const newStatus = record.status as AgentStatus

    setAgents(prev => {
      const agent = prev.find(a => a.id === id || a.dir === id)
      if (agent && agent.status !== newStatus) {
        // Determine pulse type
        const isComingOnline = newStatus === 'working' || newStatus === 'idle'
        const isGoingOffline = newStatus === 'offline'
        if (isComingOnline) triggerPulse(agent.id, 'online')
        else if (isGoingOffline) triggerPulse(agent.id, 'offline')
      }
      return prev.map(a =>
        (a.id === id || a.dir === id)
          ? { ...a, status: newStatus || a.status }
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
