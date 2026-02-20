import { AGENTS } from '@/lib/data'
import AgentDetailClient from './AgentDetailClient'

export function generateStaticParams() {
  return AGENTS.map(a => ({ id: a.id }))
}

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AgentDetailClient id={id} />
}
