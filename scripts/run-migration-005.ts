#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Execute migration SQL by breaking it into individual DDL statements
// We'll try using the REST API's query endpoint
async function runSQL(sql: string) {
  const url = `${SUPABASE_URL}/rest/v1/`
  // Supabase doesn't expose direct SQL via anon/service key — only via psql
  // Instead, let's create the table by calling upsert on a fake record to see if table exists
  // Then use pg REST API
  const { data, error } = await supabase.from('agent_sessions').select('id').limit(1)
  if (error && error.message.includes('does not exist')) {
    console.log('Table does not exist, need to create it')
    return false
  } else if (error) {
    console.log('Other error:', error.message)
    return false
  }
  console.log('Table already exists!')
  return true
}

async function main() {
  const exists = await runSQL('')
  if (!exists) {
    console.log('Need to run migration manually. SQL:')
    console.log('---')
    const { readFileSync } = await import('fs')
    console.log(readFileSync(join(__dirname, '../supabase/migrations/005_agent_sessions.sql'), 'utf-8'))
  }
}

main().catch(console.error)
