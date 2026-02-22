'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <ErrorFallback
          error={this.state.error}
          reset={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}

export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  compact = false,
}: {
  error?: Error | null
  reset?: () => void
  title?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <div
        style={{
          background: 'rgba(248, 113, 113, 0.06)',
          border: '1px solid rgba(248, 113, 113, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
        className="rounded-xl px-4 py-3 flex items-center gap-3"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f87171"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ color: '#f87171' }} className="text-sm font-medium flex-1">
          {error?.message || title}
        </span>
        {reset && (
          <button
            onClick={reset}
            style={{
              color: '#f87171',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.2)',
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div
        style={{
          background: 'var(--cp-page-gradient)',
          border: '1px solid rgba(100, 18, 166, 0.3)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(100, 18, 166, 0.1)',
          backdropFilter: 'blur(20px)',
          maxWidth: '480px',
          width: '100%',
        }}
        className="rounded-2xl p-8 text-center"
      >
        {/* Error icon */}
        <div
          style={{
            background: 'rgba(248, 113, 113, 0.08)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            width: 64,
            height: 64,
          }}
          className="rounded-2xl flex items-center justify-center mx-auto mb-5"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f87171"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2
          style={{ color: '#f0ebff' }}
          className="text-xl font-bold mb-2"
        >
          {title}
        </h2>

        {error?.message && (
          <p
            style={{
              color: '#6b7280',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
            className="rounded-lg px-4 py-2.5 mt-3 mb-5 text-left leading-relaxed"
          >
            {error.message}
          </p>
        )}

        <p style={{ color: '#9ca3af' }} className="text-sm mb-6 mt-3">
          An unexpected error occurred. Try refreshing the page or clicking retry below.
        </p>

        <div className="flex items-center justify-center gap-3">
          {reset && (
            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg, #6412A6, #4c0d7a)',
                color: '#f0ebff',
                boxShadow: '0 4px 16px rgba(100, 18, 166, 0.35)',
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
              </svg>
              Retry
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              color: '#9ca3af',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
