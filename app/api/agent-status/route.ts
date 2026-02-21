import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, status, current_task, last_activity } = body

    if (!agent_id || !status) {
      return NextResponse.json({ error: 'agent_id and status are required' }, { status: 400 })
    }

    const validStatuses = ['working', 'idle', 'offline', 'unknown']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const updatePayload: Record<string, unknown> = {
      id: agent_id,
      status,
      updated_at: new Date().toISOString(),
    }
    if (current_task !== undefined) updatePayload.current_task = current_task
    if (last_activity !== undefined) updatePayload.last_activity = last_activity

    const { error } = await supabase
      .from('agents')
      .upsert(updatePayload, { onConflict: 'id' })

    if (error) {
      console.error('Supabase error updating agent status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, agent_id, status })
  } catch (err) {
    console.error('Error in /api/agent-status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/agent-status',
    method: 'POST',
    body: {
      agent_id: 'string (required) — e.g. "main", "dev", "pm"',
      status: 'string (required) — one of: working, idle, offline, unknown',
      current_task: 'string (optional) — description of current task',
      last_activity: 'string (optional) — ISO timestamp of last activity',
    },
  })
}
