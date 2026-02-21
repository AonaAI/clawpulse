'use client'

import { ErrorFallback } from '@/components/ErrorBoundary'

export default function UsageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} title="Failed to load Token Usage" />
}
