import { fetchProjects } from '@/lib/supabase-client'
import ProjectDetailClient from './ProjectDetailClient'

export async function generateStaticParams() {
  try {
    const projects = await fetchProjects()
    return projects.map(p => ({ id: p.id }))
  } catch {
    return []
  }
}

export default function ProjectDetailPage() {
  return <ProjectDetailClient />
}
