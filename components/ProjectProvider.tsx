'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { fetchProjects, fetchProjectAgents } from '@/lib/supabase-client'

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  mission: string | null
  vision: string | null
  color: string
  icon: string
  status: string
  created_at: string
  updated_at: string
}

export interface ProjectAgent {
  project_id: string
  agent_id: string
  role: string
}

interface ProjectContextValue {
  projects: Project[]
  projectAgents: ProjectAgent[]
  selectedProjectId: string | null // null = "All Projects"
  selectedProject: Project | null
  setSelectedProjectId: (id: string | null) => void
  agentIdsForProject: (projectId: string) => string[]
  loading: boolean
  refresh: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  projectAgents: [],
  selectedProjectId: null,
  selectedProject: null,
  setSelectedProjectId: () => {},
  agentIdsForProject: () => [],
  loading: true,
  refresh: async () => {},
})

export function useProject() {
  return useContext(ProjectContext)
}

const STORAGE_KEY = 'cp-selected-project'

export default function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectAgents, setProjectAgents] = useState<ProjectAgent[]>([])
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const refresh = useCallback(async () => {
    const [p, pa] = await Promise.all([fetchProjects(), fetchProjectAgents()])
    setProjects(p)
    setProjectAgents(pa)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setSelectedProjectIdState(stored)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  const agentIdsForProject = useCallback(
    (projectId: string) =>
      projectAgents.filter(pa => pa.project_id === projectId).map(pa => pa.agent_id),
    [projectAgents]
  )

  return (
    <ProjectContext.Provider
      value={{
        projects,
        projectAgents,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
        agentIdsForProject,
        loading,
        refresh,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}
