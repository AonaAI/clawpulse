import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Adaptive storage: when 'cp_no_persist' is set in sessionStorage (login without
// "Remember me"), Supabase tokens are stored in sessionStorage so they're cleared
// when the browser tab is closed. Otherwise uses localStorage (survives restarts).
const adaptiveStorage = typeof window !== 'undefined'
  ? {
      getItem: (key: string): string | null => {
        if (sessionStorage.getItem('cp_no_persist') === '1') {
          return sessionStorage.getItem(key)
        }
        return localStorage.getItem(key)
      },
      setItem: (key: string, value: string): void => {
        if (sessionStorage.getItem('cp_no_persist') === '1') {
          sessionStorage.setItem(key, value)
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, value)
        }
      },
      removeItem: (key: string): void => {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      },
    }
  : undefined

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: adaptiveStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})

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

export async function fetchTasks(from?: string, to?: string) {
  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to)   query = query.lte('created_at', `${to}T23:59:59.999Z`)
  
  const { data, error } = await query
  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  
  return data || []
}

export async function fetchActivityLog(limit = 10, from?: string, to?: string) {
  let query = supabase
    .from('activity_log')
    .select('*, agent:agents(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to)   query = query.lte('created_at', `${to}T23:59:59.999Z`)
  const { data, error } = await query
  
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

export async function fetchTokenUsage(limit = 100, from?: string, to?: string) {
  let query = supabase
    .from('token_usage')
    .select('*, agent:agents(name)')
    .order('recorded_at', { ascending: false })
    .limit(limit)
  if (from) query = query.gte('recorded_at', `${from}T00:00:00.000Z`)
  if (to)   query = query.lte('recorded_at', `${to}T23:59:59.999Z`)
  const { data, error } = await query
  if (error) { console.error('Error fetching token usage:', error); return [] }
  return (data || []).map(r => ({
    ...r,
    agent_name: r.agent?.name || r.agent_id,
  }))
}

export async function fetchTokenStatsByAgent(from?: string, to?: string) {
  let query = supabase
    .from('token_usage')
    .select('agent_id, total_tokens, cost_usd, model, agent:agents!agent_id(name)')
  if (from) query = query.gte('recorded_at', `${from}T00:00:00.000Z`)
  if (to)   query = query.lte('recorded_at', `${to}T23:59:59.999Z`)
  const { data, error } = await query
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

export async function fetchDailyTokenStats(from?: string, to?: string) {
  let query = supabase
    .from('token_usage')
    .select('total_tokens, cost_usd, recorded_at')
    .order('recorded_at', { ascending: true })
  if (from) query = query.gte('recorded_at', `${from}T00:00:00.000Z`)
  else query = query.gte('recorded_at', new Date(Date.now() - 7 * 86400000).toISOString())
  if (to) query = query.lte('recorded_at', `${to}T23:59:59.999Z`)
  const { data, error } = await query
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

export async function fetchTokenSummary(from?: string, to?: string) {
  let query = supabase
    .from('token_usage')
    .select('total_tokens, cost_usd, recorded_at')
  if (from) query = query.gte('recorded_at', `${from}T00:00:00.000Z`)
  if (to)   query = query.lte('recorded_at', `${to}T23:59:59.999Z`)
  if (!from) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    query = query.gte('recorded_at', monthStart)
  }
  const { data, error } = await query
  if (error) return { today: { tokens: 0, cost: 0 }, week: { tokens: 0, cost: 0 }, month: { tokens: 0, cost: 0 } }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString()

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
  // Fetch messages without FK join to avoid PGRST200 error
  const { data, error } = await supabase
    .from('slack_messages')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('Error fetching slack messages:', error); return [] }

  // Fetch agent names separately
  const agentIds = [...new Set((data || []).map((r: Record<string, unknown>) => r.agent_id as string).filter(Boolean))]
  let agentMap: Record<string, string> = {}
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds)
    if (agents) {
      agentMap = Object.fromEntries(agents.map((a: { id: string; name: string }) => [a.id, a.name]))
    }
  }

  return (data || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    agent_id: r.agent_id as string,
    agent_name: agentMap[r.agent_id as string] || (r.agent_id as string),
    channel: r.channel as string,
    message: r.message as string,
    sent_at: r.sent_at as string,
    session_id: (r.session_id as string | null) ?? null,
    created_at: r.created_at as string,
  }))
}

// ── Spawn Requests ──────────────────────────────────────────────────────────

export async function fetchSpawnRequests(agentId: string, limit = 10) {
  const { data, error } = await supabase
    .from('spawn_requests')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('Error fetching spawn requests:', error); return [] }
  return data || []
}

export async function createSpawnRequest(req: { agent_id: string; task: string; model?: string }) {
  const { data, error } = await supabase
    .from('spawn_requests')
    .insert([req])
    .select()
    .single()
  if (error) { console.error('Error creating spawn request:', error); return null }
  return data
}

// ── Agent Sparklines ────────────────────────────────────────────────────────

/**
 * Returns 24-bucket hourly activity counts per agent for the last 24 hours.
 * Index 0 = 23 hours ago, index 23 = the current (most recent) hour.
 */
export async function fetchAgentSparklines(): Promise<Record<string, number[]>> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('activity_log')
    .select('agent_id, created_at')
    .gte('created_at', since)

  if (error || !data) return {}

  const now = Date.now()
  const result: Record<string, number[]> = {}

  for (const row of data) {
    const agentId = row.agent_id
    if (!result[agentId]) result[agentId] = new Array(24).fill(0)
    const msSince = now - new Date(row.created_at).getTime()
    const hoursAgo = Math.floor(msSince / 3_600_000)
    const bucket = 23 - hoursAgo // 0 = oldest hour, 23 = most recent
    if (bucket >= 0 && bucket < 24) result[agentId][bucket]++
  }

  return result
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

// ── Audit Log ──

export interface AuditLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  changes: Record<string, unknown>
  actor: string
  created_at: string
}

export async function fetchAuditLog(opts: {
  limit?: number
  offset?: number
  action?: string
  entity_type?: string
  actor?: string
  from?: string
  to?: string
}): Promise<{ items: AuditLogEntry[]; total: number }> {
  const { limit = 50, offset = 0, action, entity_type, actor, from, to } = opts

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action && action !== 'all') query = query.eq('action', action)
  if (entity_type && entity_type !== 'all') query = query.eq('entity_type', entity_type)
  if (actor && actor !== 'all') query = query.eq('actor', actor)
  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`)

  const { data, error, count } = await query
  if (error) {
    console.error('Error fetching audit log:', error)
    return { items: [], total: 0 }
  }
  return { items: (data || []) as AuditLogEntry[], total: count || 0 }
}

export async function fetchAuditStats(): Promise<{
  todayCount: number
  topActor: string
  topEntityType: string
}> {
  const today = new Date().toISOString().slice(0, 10)

  const { count: todayCount } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00.000Z`)

  const { data: actorData } = await supabase
    .from('audit_log')
    .select('actor')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: entityData } = await supabase
    .from('audit_log')
    .select('entity_type')
    .order('created_at', { ascending: false })
    .limit(200)

  const actorCounts: Record<string, number> = {}
  for (const r of actorData || []) actorCounts[r.actor] = (actorCounts[r.actor] || 0) + 1
  const topActor = Object.entries(actorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  const entityCounts: Record<string, number> = {}
  for (const r of entityData || []) entityCounts[r.entity_type] = (entityCounts[r.entity_type] || 0) + 1
  const topEntityType = Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  return { todayCount: todayCount || 0, topActor, topEntityType }
}
