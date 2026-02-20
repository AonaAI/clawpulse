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

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}
