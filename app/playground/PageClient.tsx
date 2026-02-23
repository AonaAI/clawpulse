'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlaygroundState {
  systemPrompt: string
  userMessage: string
  model: string
  temperature: number
  maxTokens: number
}

interface HistoryEntry {
  id: string
  timestamp: string
  state: PlaygroundState
  response: string
}

// ── Templates ──────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, PlaygroundState> = {
  'Agent System Prompt': {
    systemPrompt: `You are a helpful AI agent. You have access to tools and can perform actions on behalf of the user.

## Your Capabilities
- Search the web for information
- Read and write files
- Execute shell commands
- Send messages

## Guidelines
- Always confirm before destructive actions
- Be concise but thorough
- Ask clarifying questions when the task is ambiguous`,
    userMessage: 'What can you help me with today?',
    model: 'claude-sonnet-4-5',
    temperature: 0.7,
    maxTokens: 2048,
  },
  'Task Decomposer': {
    systemPrompt: `You are a task decomposition specialist. Given a complex task, break it down into smaller, actionable subtasks.

## Output Format
For each subtask, provide:
1. **Title** — short name
2. **Description** — what needs to be done
3. **Dependencies** — which subtasks must complete first
4. **Estimated effort** — small / medium / large
5. **Priority** — critical / high / medium / low`,
    userMessage: 'Build a user authentication system with OAuth, email verification, and role-based access control.',
    model: 'claude-opus-4-6',
    temperature: 0.3,
    maxTokens: 4096,
  },
  'Error Handler': {
    systemPrompt: `You are an error analysis agent. When given an error message or stack trace, you:

1. Identify the root cause
2. Explain what went wrong in plain English
3. Suggest 2-3 potential fixes, ordered by likelihood
4. Provide code snippets for the most likely fix
5. Note any related issues to watch for

Be direct and actionable. Skip obvious explanations.`,
    userMessage: 'TypeError: Cannot read properties of undefined (reading \'map\')\n    at UserList (app/components/UserList.tsx:24:18)',
    model: 'claude-sonnet-4-5',
    temperature: 0.2,
    maxTokens: 2048,
  },
  'Code Reviewer': {
    systemPrompt: `You are a senior code reviewer. Review code for:

## Checklist
- **Bugs** — logic errors, off-by-one, null safety
- **Security** — injection, XSS, auth issues
- **Performance** — unnecessary re-renders, N+1 queries, memory leaks
- **Readability** — naming, structure, comments
- **Best practices** — error handling, typing, testing

Rate severity: 🔴 Critical | 🟡 Warning | 🔵 Suggestion

Be specific. Reference line numbers. Suggest fixes.`,
    userMessage: 'Please review this React component:\n\nfunction UserProfile({ id }) {\n  const [user, setUser] = useState(null)\n  useEffect(() => {\n    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser)\n  })\n  return <div>{user.name}</div>\n}',
    model: 'claude-sonnet-4-5',
    temperature: 0.1,
    maxTokens: 4096,
  },
}

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-5',
  'gpt-4',
  'gpt-4o',
  'gpt-3.5-turbo',
  'gemini-pro',
]

const MOCK_RESPONSES: Record<string, string> = {
  'claude-opus-4-6': `I'd be happy to help! Based on your prompt, here's what I'd suggest:

**Analysis**
Your system prompt is well-structured with clear guidelines and capabilities. The temperature setting allows for creative but focused responses.

**Recommendations**
1. Consider adding specific output format instructions
2. Include error handling guidelines
3. Add examples for edge cases

*This is a mock response. Connect your API key to enable live testing.*`,
  'claude-sonnet-4-5': `Here's my analysis of your request:

## Key Points
- The prompt is clear and actionable
- Temperature is appropriate for this task type
- Token limit provides enough room for detailed responses

## Suggested Improvements
- Add few-shot examples to guide output format
- Consider adding a "think step by step" instruction
- Include constraints on response length

*This is a mock response. Connect your API key to enable live testing.*`,
  'default': `## Mock Response

This is a simulated response for testing purposes. In production, this would be replaced with actual LLM output based on your system prompt and user message.

**Your Configuration:**
- Model selected with appropriate temperature
- Token limit set for the response length
- System prompt provides context and guidelines

*Connect your API key to enable live testing.*`,
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_STATE: PlaygroundState = {
  systemPrompt: '',
  userMessage: '',
  model: 'claude-sonnet-4-5',
  temperature: 0.7,
  maxTokens: 2048,
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadState(): PlaygroundState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const saved = localStorage.getItem('cp-playground-state')
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE
  } catch { return DEFAULT_STATE }
}

function saveState(state: PlaygroundState) {
  try { localStorage.setItem('cp-playground-state', JSON.stringify(state)) } catch {}
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('cp-playground-history')
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function saveHistory(history: HistoryEntry[]) {
  try { localStorage.setItem('cp-playground-history', JSON.stringify(history.slice(0, 50))) } catch {}
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [state, setState] = useState<PlaygroundState>(DEFAULT_STATE)
  const [response, setResponse] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState())
    setHistory(loadHistory())
    setMounted(true)
  }, [])

  // Persist state changes
  useEffect(() => {
    if (mounted) saveState(state)
  }, [state, mounted])

  const updateState = useCallback((patch: Partial<PlaygroundState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const handleRun = useCallback(() => {
    if (!state.systemPrompt.trim() && !state.userMessage.trim()) return
    setIsRunning(true)
    setResponse('')

    // Simulate streaming with a delay
    setTimeout(() => {
      const mockResponse = MOCK_RESPONSES[state.model] || MOCK_RESPONSES['default']
      setResponse(mockResponse)
      setIsRunning(false)

      // Save to history
      const entry: HistoryEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        state: { ...state },
        response: mockResponse,
      }
      setHistory(prev => {
        const updated = [entry, ...prev].slice(0, 50)
        saveHistory(updated)
        return updated
      })
    }, 800 + Math.random() * 700)
  }, [state])

  const loadTemplate = useCallback((name: string) => {
    const template = TEMPLATES[name]
    if (template) {
      setState(template)
      setResponse('')
    }
  }, [])

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    setState(entry.state)
    setResponse(entry.response)
    setShowHistory(false)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  if (!mounted) {
    return (
      <div className="p-6 md:p-8">
        <div style={{ color: 'var(--cp-text-muted)' }} className="text-sm">Loading playground...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)' }} className="text-xl md:text-2xl font-bold tracking-tight">
            Prompt Playground
          </h1>
          <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-1">
            Test and iterate on prompts for your agents
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Template selector */}
          <select
            value=""
            onChange={e => { if (e.target.value) loadTemplate(e.target.value) }}
            style={{
              background: 'var(--cp-card-bg)',
              color: 'var(--cp-text-secondary)',
              border: '1px solid var(--cp-border-strong)',
            }}
            className="px-3 py-2 rounded-lg text-sm cursor-pointer"
          >
            <option value="">Load template...</option>
            {Object.keys(TEMPLATES).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: showHistory ? 'rgba(109, 40, 217, 0.18)' : 'var(--cp-card-bg)',
              color: showHistory ? 'var(--cp-text-accent-light)' : 'var(--cp-text-secondary)',
              border: `1px solid ${showHistory ? 'rgba(109, 40, 217, 0.4)' : 'var(--cp-border-strong)'}`,
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            History {history.length > 0 && <span className="opacity-60">({history.length})</span>}
          </button>
        </div>
      </div>

      {/* API Key Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
          border: '1px solid rgba(109, 40, 217, 0.25)',
        }}
        className="rounded-xl px-4 py-3 flex items-center gap-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ color: 'var(--cp-text-secondary)' }} className="text-sm">
          <strong style={{ color: 'var(--cp-text-accent-light)' }}>Connect your API key</strong> to enable live testing. Responses below are simulated.
        </span>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div
          style={{
            background: 'var(--cp-card-bg)',
            border: '1px solid var(--cp-border-strong)',
          }}
          className="rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">Session History</h3>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                style={{ color: 'var(--cp-text-muted)' }}
                className="text-xs hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm">No sessions yet. Run a prompt to create one.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => loadHistoryEntry(entry)}
                  style={{
                    background: 'rgba(109, 40, 217, 0.06)',
                    border: '1px solid rgba(109, 40, 217, 0.12)',
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: 'var(--cp-text-secondary)' }} className="text-sm font-medium truncate">
                      {entry.state.userMessage.slice(0, 60) || entry.state.systemPrompt.slice(0, 60) || 'Empty prompt'}
                      {(entry.state.userMessage.length > 60 || entry.state.systemPrompt.length > 60) && '...'}
                    </span>
                    <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs flex-shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">{entry.state.model}</span>
                    <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">·</span>
                    <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">temp {entry.state.temperature}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Input */}
        <div className="space-y-4">
          {/* System Prompt */}
          <div
            style={{
              background: 'var(--cp-card-bg)',
              border: '1px solid var(--cp-border-strong)',
            }}
            className="rounded-xl overflow-hidden"
          >
            <div
              style={{ borderBottom: '1px solid var(--cp-border-strong)' }}
              className="px-4 py-3 flex items-center justify-between"
            >
              <label style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">
                System Prompt
              </label>
              <span style={{ color: 'var(--cp-text-muted)' }} className="text-xs">
                {state.systemPrompt.length} chars
              </span>
            </div>
            <textarea
              value={state.systemPrompt}
              onChange={e => updateState({ systemPrompt: e.target.value })}
              placeholder="Enter your system prompt..."
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                color: 'var(--cp-text-primary)',
                caretColor: '#a78bfa',
              }}
              className="w-full px-4 py-3 text-sm font-mono leading-relaxed resize-none focus:outline-none placeholder:text-gray-600"
              rows={12}
              spellCheck={false}
            />
          </div>

          {/* User Message */}
          <div
            style={{
              background: 'var(--cp-card-bg)',
              border: '1px solid var(--cp-border-strong)',
            }}
            className="rounded-xl overflow-hidden"
          >
            <div
              style={{ borderBottom: '1px solid var(--cp-border-strong)' }}
              className="px-4 py-3"
            >
              <label style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">
                User Message
              </label>
            </div>
            <textarea
              value={state.userMessage}
              onChange={e => updateState({ userMessage: e.target.value })}
              placeholder="Enter the user message..."
              style={{
                background: 'rgba(0, 0, 0, 0.15)',
                color: 'var(--cp-text-primary)',
                caretColor: '#a78bfa',
              }}
              className="w-full px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none placeholder:text-gray-600"
              rows={4}
            />
          </div>

          {/* Controls */}
          <div
            style={{
              background: 'var(--cp-card-bg)',
              border: '1px solid var(--cp-border-strong)',
            }}
            className="rounded-xl p-4 space-y-4"
          >
            {/* Model + Max Tokens row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                  Model
                </label>
                <select
                  value={state.model}
                  onChange={e => updateState({ model: e.target.value })}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--cp-text-primary)',
                    border: '1px solid var(--cp-border-strong)',
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer focus:outline-none"
                >
                  {MODELS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={state.maxTokens}
                  onChange={e => updateState({ maxTokens: Math.max(1, Math.min(32000, parseInt(e.target.value) || 1)) })}
                  min={1}
                  max={32000}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--cp-text-primary)',
                    border: '1px solid var(--cp-border-strong)',
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Temperature slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ color: 'var(--cp-text-muted)' }} className="text-xs font-semibold uppercase tracking-wider">
                  Temperature
                </label>
                <span style={{ color: 'var(--cp-text-accent-light)' }} className="text-sm font-mono font-semibold">
                  {state.temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={state.temperature}
                onChange={e => updateState({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-purple-500"
                style={{ height: '6px' }}
              />
              <div className="flex justify-between mt-1">
                <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">Precise</span>
                <span style={{ color: 'var(--cp-text-dim)' }} className="text-xs">Creative</span>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={isRunning || (!state.systemPrompt.trim() && !state.userMessage.trim())}
              style={{
                background: isRunning
                  ? 'rgba(109, 40, 217, 0.3)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                boxShadow: isRunning ? 'none' : '0 0 20px rgba(124, 58, 237, 0.25)',
              }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Run Prompt
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Output */}
        <div
          style={{
            background: 'var(--cp-card-bg)',
            border: '1px solid var(--cp-border-strong)',
          }}
          className="rounded-xl overflow-hidden flex flex-col"
        >
          <div
            style={{ borderBottom: '1px solid var(--cp-border-strong)' }}
            className="px-4 py-3 flex items-center justify-between"
          >
            <h3 style={{ color: 'var(--cp-text-primary)' }} className="text-sm font-semibold">
              Response Output
            </h3>
            {response && (
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined') {
                    navigator.clipboard.writeText(response)
                  }
                }}
                style={{ color: 'var(--cp-text-muted)' }}
                className="text-xs hover:text-white transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            )}
          </div>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              minHeight: '400px',
            }}
            className="flex-1 px-4 py-4 overflow-y-auto"
          >
            {isRunning ? (
              <div className="flex items-center gap-3 py-8">
                <span className="inline-block w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <span style={{ color: 'var(--cp-text-muted)' }} className="text-sm">Generating response...</span>
              </div>
            ) : response ? (
              <div
                style={{ color: 'var(--cp-text-secondary)' }}
                className="text-sm leading-relaxed whitespace-pre-wrap font-mono"
              >
                {response}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(109, 40, 217, 0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <p style={{ color: 'var(--cp-text-muted)' }} className="text-sm mt-4">
                  Configure your prompt and click <strong>Run</strong> to see the response
                </p>
                <p style={{ color: 'var(--cp-text-dim)' }} className="text-xs mt-1">
                  Or select a template to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
