// Cost calculation utilities for token usage

export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
}

// Pricing per million tokens (as of Feb 2025)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-opus': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-sonnet': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'claude-sonnet-4': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-sonnet-4-5': { inputPerMillion: 3, outputPerMillion: 15 },
  'gpt-4o': { inputPerMillion: 5, outputPerMillion: 15 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4-turbo': { inputPerMillion: 10, outputPerMillion: 30 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'default': { inputPerMillion: 3, outputPerMillion: 15 }, // Use Sonnet pricing as default
}

/**
 * Calculate cost for a given token count and model
 * Assumes 50/50 split between input/output tokens if not specified
 */
export function calculateCost(
  totalTokens: number,
  model: string | null,
  inputTokens?: number,
  outputTokens?: number
): number {
  if (totalTokens === 0) return 0

  // Normalize model name
  const modelKey = normalizeModelName(model || 'default')
  const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING.default

  // If we have specific input/output breakdown, use it
  if (inputTokens !== undefined && outputTokens !== undefined) {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion
    return inputCost + outputCost
  }

  // Otherwise assume 50/50 split (conservative estimate)
  const halfTokens = totalTokens / 2
  const inputCost = (halfTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost = (halfTokens / 1_000_000) * pricing.outputPerMillion
  return inputCost + outputCost
}

/**
 * Normalize model names to match our pricing keys
 */
function normalizeModelName(model: string): string {
  const lower = model.toLowerCase().trim()
  
  // Match Anthropic models
  if (lower.includes('opus')) return 'claude-opus'
  if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5')) return 'claude-sonnet-4-5'
  if (lower.includes('sonnet-4')) return 'claude-sonnet-4'
  if (lower.includes('sonnet')) return 'claude-sonnet'
  if (lower.includes('haiku')) return 'claude-haiku'
  
  // Match OpenAI models
  if (lower.includes('gpt-4o-mini')) return 'gpt-4o-mini'
  if (lower.includes('gpt-4o')) return 'gpt-4o'
  if (lower.includes('gpt-4-turbo')) return 'gpt-4-turbo'
  if (lower.includes('gpt-3.5')) return 'gpt-3.5-turbo'
  
  return 'default'
}

/**
 * Get pricing info for a model
 */
export function getModelPricing(model: string | null): ModelPricing {
  const modelKey = normalizeModelName(model || 'default')
  return MODEL_PRICING[modelKey] || MODEL_PRICING.default
}
