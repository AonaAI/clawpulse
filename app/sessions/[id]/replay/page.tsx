import SessionReplayClient from './SessionReplayClient'

// Static export: session IDs are unknown at build time.
// A single placeholder page is pre-rendered; Firebase rewrites /sessions/*/replay to it.
// The client component reads the actual session ID from the URL via useParams().
export function generateStaticParams() {
  return [{ id: '__placeholder__' }]
}

export default async function SessionReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SessionReplayClient id={id} />
}
