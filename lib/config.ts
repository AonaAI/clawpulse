// Central application configuration.
// All values are read from environment variables with sensible defaults.
// Set NEXT_PUBLIC_* vars in .env.local to customise for your deployment.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ClawPulse'
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Agent Operations Dashboard'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'clawpulse.web.app'
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'My Company'

// Supabase — also consumed directly by lib/supabase-client.ts and lib/supabase.ts.
// Exported here so other modules can import from a single location if preferred.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
