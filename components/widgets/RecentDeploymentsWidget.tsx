'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'

interface Deployment {
  id: string
  agent_name: string
  action: string
  details: string
  time: string
}

interface Props {
  compact?: boolean
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

export default function RecentDeploymentsWidget({ compact }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*, agent:agents(name)')
        .or('action.ilike.%deploy%,action.ilike.%commit%,action.ilike.%push%,action.ilike.%build%')
        .order('created_at', { ascending: false })
        .limit(compact ? 5 : 8)

      if (error) { setLoading(false); return }
      setDeployments((data || []).map(r => ({
        id: r.id,
        agent_name: r.agent?.name || r.agent_id,
        action: r.action,
        details: r.details || '',
        time: formatTimeAgo(new Date(r.created_at)),
      })))
      setLoading(false)
    }
    load()
  }, [compact])

  if (loading) {
    return <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm py-4 text-center">Loading...</div>
  }

  if (deployments.length === 0) {
    return <div style={{ color: 'var(--cp-text-dim)' }} className="text-sm py-4 text-center">No recent deployments</div>
  }

  return (
    <div className="space-y-0">
      {deployments.map((d, i) => (
        <div
          key={d.id}
          className={`flex items-start gap-3 ${compact ? 'py-2' : 'py-3'}`}
          style={{ borderBottom: i < deployments.length - 1 ? '1px solid var(--cp-divider)' : 'none' }}
        >
          <div
            style={{
              background: 'rgba(34, 211, 238, 0.12)',
              border: '1px solid rgba(34, 211, 238, 0.2)',
              color: '#22d3ee',
              width: '24px',
              height: '24px',
              minWidth: '24px',
            }}
            className="rounded-md flex items-center justify-center flex-shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span style={{ color: 'var(--cp-text-card-title)' }} className="text-xs font-semibold truncate">{d.action}</span>
              <span style={{ color: 'var(--cp-text-dimmer)', fontSize: '10px', fontWeight: 600 }} className="flex-shrink-0">{d.time}</span>
            </div>
            {!compact && <div style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-0.5 truncate">{d.details}</div>}
            <div style={{ color: '#8b5cf6' }} className="text-[10px] font-semibold mt-0.5">{d.agent_name}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
