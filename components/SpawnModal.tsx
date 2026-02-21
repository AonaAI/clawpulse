'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'

interface SpawnModalProps {
  agentId: string
  agentName: string
  onClose: () => void
  onSpawned?: () => void
}

export default function SpawnModal({ agentId, agentName, onClose, onSpawned }: SpawnModalProps) {
  const [task, setTask] = useState('')
  const [model, setModel] = useState('default')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSpawn() {
    if (!task.trim()) { setError('Task description is required'); return }
    setSubmitting(true)
    setError('')

    const { error: err } = await supabase.from('spawn_requests').insert([{
      agent_id: agentId,
      task: task.trim(),
      model,
      status: 'pending',
    }])

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSpawned?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl p-6"
        style={{
          background: 'var(--cp-card-bg, #1a1a2e)',
          border: '1px solid var(--cp-border-stronger, rgba(139,92,246,0.3))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: 'var(--cp-text-primary)' }} className="text-lg font-bold">Spawn Task</h2>
          <button onClick={onClose} style={{ color: 'var(--cp-text-dim)' }} className="hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Agent name */}
        <div className="mb-4">
          <label style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Agent</label>
          <div
            style={{ background: 'var(--cp-input-bg, rgba(255,255,255,0.05))', border: '1px solid var(--cp-border-subtle)', color: 'var(--cp-text-muted)' }}
            className="rounded-lg px-3 py-2 text-sm font-medium"
          >
            {agentName}
          </div>
        </div>

        {/* Task */}
        <div className="mb-4">
          <label style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Task Description</label>
          <textarea
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Describe the task for this agent..."
            rows={4}
            style={{
              background: 'var(--cp-input-bg, rgba(255,255,255,0.05))',
              border: '1px solid var(--cp-border-subtle)',
              color: 'var(--cp-text-primary)',
            }}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Model */}
        <div className="mb-5">
          <label style={{ color: 'var(--cp-text-dim)' }} className="text-xs font-semibold uppercase tracking-wider block mb-1.5">Model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{
              background: 'var(--cp-input-bg, rgba(255,255,255,0.05))',
              border: '1px solid var(--cp-border-subtle)',
              color: 'var(--cp-text-primary)',
            }}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="default">Default</option>
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
          </select>
        </div>

        {/* Error */}
        {error && <div style={{ color: '#f87171' }} className="text-xs mb-4">{error}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            style={{ color: 'var(--cp-text-muted)', border: '1px solid var(--cp-border-subtle)' }}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSpawn}
            disabled={submitting}
            style={{
              background: submitting ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
            }}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Spawning…' : '▶ Spawn'}
          </button>
        </div>
      </div>
    </div>
  )
}
