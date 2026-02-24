import { normalizeModelName } from '../model-utils'

describe('normalizeModelName', () => {
  it('returns null for falsy input', () => {
    expect(normalizeModelName(null)).toBeNull()
    expect(normalizeModelName(undefined)).toBeNull()
    expect(normalizeModelName('')).toBeNull()
  })

  it('normalizes anthropic model IDs', () => {
    expect(normalizeModelName('anthropic/claude-opus-4-20250514')).toBe('Claude Opus')
    expect(normalizeModelName('anthropic/claude-sonnet-4-20250514')).toBe('Claude Sonnet')
    expect(normalizeModelName('claude-3-haiku-20240307')).toBe('Claude Haiku')
  })

  it('normalizes OpenAI model IDs', () => {
    expect(normalizeModelName('openai/gpt-4o-2024-08-06')).toBe('GPT-4o')
    expect(normalizeModelName('azure-openai-responses/gpt-5.2')).toBe('GPT-5')
  })

  it('passes through already-friendly names', () => {
    expect(normalizeModelName('Claude Opus')).toBe('Claude Opus')
    expect(normalizeModelName('Claude Sonnet')).toBe('Claude Sonnet')
    expect(normalizeModelName('GPT-4o')).toBe('GPT-4o')
  })

  it('handles gemini models', () => {
    expect(normalizeModelName('google/gemini-2.0-flash')).toBe('Gemini 2')
  })
})
