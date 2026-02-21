import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const VALID_STATUSES = ['idle', 'working', 'offline', 'waiting'] as const
type AgentStatus = typeof VALID_STATUSES[number]

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('WEBHOOK_API_KEY')
  if (!apiKey) {
    console.error('WEBHOOK_API_KEY env var is not set')
    return json({ error: 'Server misconfiguration' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (token !== apiKey) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { agent_id, status, current_task, metadata } = body

  if (!agent_id || typeof agent_id !== 'string') {
    return json({ error: 'agent_id is required and must be a string' }, 400)
  }

  if (status !== undefined && (typeof status !== 'string' || !VALID_STATUSES.includes(status as AgentStatus))) {
    return json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400)
  }

  if (current_task !== undefined && typeof current_task !== 'string') {
    return json({ error: 'current_task must be a string' }, 400)
  }

  if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata) || metadata === null)) {
    return json({ error: 'metadata must be a JSON object' }, 400)
  }

  // ── Supabase client (service role to bypass RLS) ──────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // ── Verify agent exists ───────────────────────────────────────────────────
  const { data: agent, error: fetchError } = await supabase
    .from('agents')
    .select('id, status, current_task')
    .eq('id', agent_id)
    .single()

  if (fetchError || !agent) {
    return json({ error: `Agent not found: ${agent_id}` }, 404)
  }

  // ── Build update payload (only include provided fields) ───────────────────
  const updates: Record<string, unknown> = { last_activity: new Date().toISOString() }
  if (status !== undefined) updates.status = status
  if (current_task !== undefined) updates.current_task = current_task
  if (metadata !== undefined) updates.metadata = metadata

  const { error: updateError } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agent_id)

  if (updateError) {
    console.error('Update failed:', updateError)
    return json({ error: 'Failed to update agent', detail: updateError.message }, 500)
  }

  // ── Log to activity_log ───────────────────────────────────────────────────
  const changes: string[] = []
  if (status !== undefined && status !== agent.status) {
    changes.push(`status: ${agent.status} → ${status}`)
  }
  if (current_task !== undefined && current_task !== agent.current_task) {
    changes.push(`task: ${current_task || '(cleared)'}`)
  }

  const actionLabel = status !== undefined ? `webhook:status:${status}` : 'webhook:update'
  const details = changes.length > 0 ? changes.join(', ') : 'metadata updated via webhook'

  await supabase.from('activity_log').insert({
    agent_id,
    action: actionLabel,
    details,
    metadata: { source: 'webhook', ...(metadata as object ?? {}) },
  })

  return json({
    ok: true,
    agent_id,
    updated: Object.keys(updates).filter(k => k !== 'last_activity'),
  })
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
