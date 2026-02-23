#!/usr/bin/env node
/**
 * Setup script: creates user_roles table and sets first user as admin.
 * Usage: node scripts/setup-roles.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Create table via SQL
  console.log('Creating user_roles table...')
  const { error: sqlErr } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','operator','viewer')),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
      CREATE POLICY "Users can read own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);
    `
  })

  if (sqlErr) {
    // Try direct REST approach if rpc doesn't exist
    console.log('rpc exec_sql not available, trying REST SQL endpoint...')
    const resp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: `
          CREATE TABLE IF NOT EXISTS user_roles (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','operator','viewer')),
            updated_at TIMESTAMPTZ DEFAULT now()
          );
        `
      }),
    })
    if (!resp.ok) {
      console.log('REST SQL also failed. Please run the SQL manually in Supabase dashboard:')
      console.log(`
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','operator','viewer')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);
      `)
    }
  } else {
    console.log('Table created successfully.')
  }

  // List auth users and set first as admin
  console.log('Listing auth users...')
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    console.error('Error listing users:', listErr)
    return
  }

  console.log(`Found ${users.length} user(s)`)
  for (const u of users) {
    console.log(`  - ${u.email} (${u.id})`)
  }

  if (users.length > 0) {
    // Upsert first user as admin
    const firstUser = users[0]
    console.log(`Setting ${firstUser.email} as admin...`)
    const { error: upsertErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: firstUser.id, role: 'admin', updated_at: new Date().toISOString() })
    if (upsertErr) {
      console.error('Error upserting role (table may not exist yet):', upsertErr)
      console.log('Run the SQL above in Supabase dashboard first, then re-run this script.')
    } else {
      console.log('Done! First user set as admin.')
    }
  }
}

main().catch(console.error)
