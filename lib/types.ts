export type AgentStatus = 'working' | 'idle' | 'offline' | 'unknown'

export interface Agent {
  id: string
  name: string
  role: string
  model: string
  workspace: string
  slack_channels: string[]
  spawn_permissions: string[]
  created_at: string
  /** OpenClaw agent directory name — defaults to id when not set */
  dir?: string
}

export interface AgentLive {
  status: AgentStatus
  sessionCount: number
  lastActive: number | null
  totalTokens: number
}

export type MergedAgent = Agent & AgentLive

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  project: string
  assigned_agent: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  agent_id: string
  action: string
  details: string
  metadata: Record<string, unknown>
  created_at: string
}

export type KnowledgeCategory = 'lesson' | 'skill' | 'document' | 'protocol'

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  tags: string[]
  source_agent: string
  created_at: string
  updated_at: string
}

export interface TokenUsage {
  id: string
  agent_id: string
  task_id: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  model: string
  recorded_at: string
}

export interface AgentTokenStats {
  agent_id: string
  agent_name: string
  total_tokens: number
  total_cost: number
  model: string
}

export interface DailyTokenStats {
  date: string
  total_tokens: number
  total_cost: number
}

export type SessionStatus = 'active' | 'completed' | 'failed'

export interface Session {
  id: string
  agent_id: string
  session_key: string
  kind: string
  status: SessionStatus
  started_at: string
  last_active: string | null
  model: string | null
  token_count: number
  created_at: string
  // Computed client-side
  duration_minutes?: number | null
  tokens_used?: number
  cost_usd?: number
  summary?: string | null
}
