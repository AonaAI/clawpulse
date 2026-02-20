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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}
