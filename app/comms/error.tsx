'use client'

import { ErrorFallback } from '@/components/ErrorBoundary'

export default function CommsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} title="Failed to load Communications" />
}
