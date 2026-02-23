import SessionDetailClient from './SessionDetailClient'

// Static export: session IDs are unknown at build time.
// A single placeholder page is pre-rendered; Firebase rewrites /sessions/* to it.
// The client component reads the actual session ID from the URL via useParams().
export function generateStaticParams() {
  return [{ id: '__placeholder__' }]
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SessionDetailClient id={id} />
}
