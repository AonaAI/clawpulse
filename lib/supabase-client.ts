import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fetch functions for client-side use
export async function fetchAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching agents:', error)
    return []
  }
  
  return data || []
}

export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  
  return data || []
}

export async function fetchActivityLog(limit = 10) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, agent:agents(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching activity log:', error)
    return []
  }
  
  // Transform to match expected format
  return (data || []).map(item => ({
    id: item.id,
    agent_id: item.agent_id,
    agent_name: item.agent?.name || item.agent_id,
    action: item.action,
    details: item.details || '',
    time: formatTimeAgo(new Date(item.created_at)),
  }))
}

// ── Task CRUD ──────────────────────────────────────────────────────────────

export async function createTask(task: {
  title: string
  description?: string | null
  status: string
  priority: string
  project: string
  assigned_agent?: string | null
  created_by: string
}) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...task,
      assigned_agent: task.assigned_agent || null,
      description: task.description || null,
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating task:', error)
    return null
  }
  return data
}

export async function updateTask(id: string, updates: Partial<{
  title: string
  description: string | null
  status: string
  priority: string
  project: string
  assigned_agent: string | null
}>) {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  }
  if ('assigned_agent' in updates) {
    payload.assigned_agent = updates.assigned_agent || null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating task:', error)
    return null
  }
  return data
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting task:', error)
    return false
  }
  return true
}

// ── Knowledge CRUD ─────────────────────────────────────────────────────────

export async function fetchKnowledge() {
  const { data, error } = await supabase
    .from('knowledge')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching knowledge:', error)
    return []
  }
  return data || []
}

export async function createKnowledge(entry: {
  title: string
  content: string
  category: string
  tags: string[]
  source_agent: string
}) {
  const { data, error } = await supabase
    .from('knowledge')
    .insert([entry])
    .select()
    .single()

  if (error) {
    console.error('Error creating knowledge entry:', error)
    return null
  }
  return data
}

export async function updateKnowledge(id: string, updates: Partial<{
  title: string
  content: string
  category: string
  tags: string[]
}>) {
  const { data, error } = await supabase
    .from('knowledge')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating knowledge entry:', error)
    return null
  }
  return data
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('knowledge')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting knowledge entry:', error)
    return false
  }
  return true
}

export async function upsertKnowledge(entries: Array<{
  id?: string
  title: string
  content: string
  category: string
  tags: string[]
  source_agent: string
}>): Promise<number> {
  const { data, error } = await supabase
    .from('knowledge')
    .upsert(entries.map(e => ({ ...e, updated_at: new Date().toISOString() })), { onConflict: 'id' })
    .select()

  if (error) {
    console.error('Error upserting knowledge entries:', error)
    return 0
  }
  return data?.length ?? 0
}

// ── Handoffs (blocked tasks) ────────────────────────────────────────────────

export async function fetchHandoffs() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'blocked')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching handoffs:', error)
    return []
  }
  return data || []
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function fetchSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single()
  if (error) return null
  return data?.value ?? null
}

export async function fetchSettings(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', keys)
  if (error) return {}
  return Object.fromEntries((data || []).map(r => [r.key, r.value]))
}

export async function upsertSetting(key: string, value: string): Promise<boolean> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) { console.error('Error upserting setting:', error); return false }
  return true
}

// ── Token Usage ─────────────────────────────────────────────────────────────

export async function fetchTokenUsage(limit = 100) {
  const { data, error } = await supabase
    .from('token_usage')
    .select('*, agent:agents(name)')
    .order('recorded_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('Error fetching token usage:', error); return [] }
  return (data || []).map(r => ({
    ...r,
    agent_name: r.agent?.name || r.agent_id,
  }))
}

export async function fetchTokenStatsByAgent() {
  const { data, error } = await supabase
    .from('token_usage')
    .select('agent_id, total_tokens, cost_usd, model, agent:agents!agent_id(name)')
  if (error) { console.error('Error fetching token stats by agent:', error); return [] }

  const map = new Map<string, { agent_id: string; agent_name: string; total_tokens: number; total_cost: number; model: string }>()
  for (const r of data || []) {
    const agentRow = r.agent as unknown as { name: string } | null
    const key = r.agent_id
    if (!map.has(key)) {
      map.set(key, { agent_id: r.agent_id, agent_name: agentRow?.name || r.agent_id, total_tokens: 0, total_cost: 0, model: r.model })
    }
    const entry = map.get(key)!
    entry.total_tokens += r.total_tokens
    entry.total_cost += Number(r.cost_usd)
  }
  return Array.from(map.values()).sort((a, b) => b.total_tokens - a.total_tokens)
}

export async function fetchDailyTokenStats() {
  const { data, error } = await supabase
    .from('token_usage')
    .select('total_tokens, cost_usd, recorded_at')
    .gte('recorded_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('recorded_at', { ascending: true })
  if (error) { console.error('Error fetching daily token stats:', error); return [] }

  const map = new Map<string, { date: string; total_tokens: number; total_cost: number }>()
  for (const r of data || []) {
    const d = r.recorded_at.slice(0, 10)
    if (!map.has(d)) map.set(d, { date: d, total_tokens: 0, total_cost: 0 })
    const entry = map.get(d)!
    entry.total_tokens += r.total_tokens
    entry.total_cost += Number(r.cost_usd)
  }
  return Array.from(map.values())
}

export async function fetchTokenSummary() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data, error } = await supabase
    .from('token_usage')
    .select('total_tokens, cost_usd, recorded_at')
    .gte('recorded_at', monthStart)
  if (error) return { today: { tokens: 0, cost: 0 }, week: { tokens: 0, cost: 0 }, month: { tokens: 0, cost: 0 } }

  const summary = { today: { tokens: 0, cost: 0 }, week: { tokens: 0, cost: 0 }, month: { tokens: 0, cost: 0 } }
  for (const r of data || []) {
    const t = r.total_tokens
    const c = Number(r.cost_usd)
    summary.month.tokens += t
    summary.month.cost += c
    if (r.recorded_at >= weekStart) { summary.week.tokens += t; summary.week.cost += c }
    if (r.recorded_at >= todayStart) { summary.today.tokens += t; summary.today.cost += c }
  }
  return summary
}

// ── Activity Log (enhanced) ─────────────────────────────────────────────────

export async function fetchFullActivityLog(limit = 50, offset = 0) {
  const { data, error, count } = await supabase
    .from('activity_log')
    .select('*, agent:agents(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) { console.error('Error fetching activity log:', error); return { items: [], total: 0 } }
  const items = (data || []).map(item => ({
    id: item.id,
    agent_id: item.agent_id,
    agent_name: item.agent?.name || item.agent_id,
    action: item.action,
    details: item.details || '',
    metadata: item.metadata || {},
    created_at: item.created_at,
    time: formatTimeAgo(new Date(item.created_at)),
  }))
  return { items, total: count ?? 0 }
}

// ── Cron Jobs ───────────────────────────────────────────────────────────────

export async function fetchCronJobs() {
  const { data, error } = await supabase
    .from('cron_jobs')
    .select('*')
    .order('name', { ascending: true })
  if (error) { console.error('Error fetching cron jobs:', error); return [] }
  return data || []
}

// ── Agent missions ──────────────────────────────────────────────────────────

export async function updateAgentMission(agentId: string, mission: string): Promise<boolean> {
  const { error } = await supabase
    .from('agents')
    .update({ mission })
    .eq('id', agentId)
  if (error) { console.error('Error updating agent mission:', error); return false }
  return true
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function fetchSessions(agentId: string, limit = 20) {
  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('agent_id', agentId)
    .order('last_active', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
  // Map agent_sessions columns to Session interface
  return (data || []).map(r => {
    const durationMs = r.last_active && r.started_at
      ? new Date(r.last_active).getTime() - new Date(r.started_at).getTime()
      : null
    return {
      ...r,
      tokens_used: r.token_count ?? 0,
      duration_minutes: durationMs !== null ? Math.round(durationMs / 60000) : null,
      cost_usd: 0,
      summary: null,
    }
  })
}

// ── Live Agent Status ──────────────────────────────────────────────────────

export async function fetchAgentLiveStatus() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, status, last_activity, current_task')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching agent live status:', error)
    return []
  }

  return (data || []).map(a => {
    // current_task stores JSON metadata: { sessionCount, totalTokens }
    let sessionCount = 0
    let totalTokens = 0
    try {
      const meta = JSON.parse(a.current_task || '{}')
      sessionCount = meta.sessionCount || 0
      totalTokens = meta.totalTokens || 0
    } catch { /* not JSON, ignore */ }

    return {
      dir: a.id,
      status: a.status || 'offline',
      sessionCount,
      lastActive: a.last_activity ? new Date(a.last_activity).getTime() : null,
      totalTokens,
    }
  })
}

// ── Slack Messages ──────────────────────────────────────────────────────────

export async function fetchSlackMessages(limit = 100) {
  const { data, error } = await supabase
    .from('slack_messages')
    .select('*, agent:agents(name)')
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('Error fetching slack messages:', error); return [] }
  return (data || []).map((r: Record<string, unknown> & { agent?: { name: string } | null }) => ({
    id: r.id as string,
    agent_id: r.agent_id as string,
    agent_name: r.agent?.name || (r.agent_id as string),
    channel: r.channel as string,
    message: r.message as string,
    sent_at: r.sent_at as string,
    session_id: (r.session_id as string | null) ?? null,
    created_at: r.created_at as string,
  }))
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}
