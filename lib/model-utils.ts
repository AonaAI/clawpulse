/**
 * Normalize raw model identifiers into friendly display names.
 * Handles provider-prefixed IDs (e.g. "anthropic/claude-opus-4-20250514")
 * and various common model strings.
 */
export function normalizeModelName(raw: string | null | undefined): string | null {
  if (!raw) return null

  const s = raw.toLowerCase()

  // Claude models
  if (s.includes('opus')) return 'Claude Opus'
  if (s.includes('sonnet')) return 'Claude Sonnet'
  if (s.includes('haiku')) return 'Claude Haiku'

  // OpenAI models
  if (s.includes('gpt-5')) return 'GPT-5'
  if (s.includes('gpt-4o')) return 'GPT-4o'
  if (s.includes('gpt-4-turbo') || s.includes('gpt-4-1')) return 'GPT-4'
  if (s.includes('o3')) return 'o3'
  if (s.includes('o1')) return 'o1'

  // Gemini
  if (s.includes('gemini-2')) return 'Gemini 2'
  if (s.includes('gemini')) return 'Gemini'

  // If already a friendly name (no slashes, short), return as-is
  if (!s.includes('/') && raw.length < 30) return raw

  // Strip provider prefix and return
  const parts = raw.split('/')
  return parts[parts.length - 1]
}
