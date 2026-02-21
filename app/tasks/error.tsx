'use client'

import { ErrorFallback } from '@/components/ErrorBoundary'

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} title="Failed to load Work Board" />
}
