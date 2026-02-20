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
