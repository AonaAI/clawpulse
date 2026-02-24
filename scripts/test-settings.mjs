// scripts/test-settings.mjs
// Regression check: asserts env vars needed by Settings page are present
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

let failed = false;

if (!url) { console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL is missing"); failed = true; }
if (!anonKey) { console.error("FAIL: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"); failed = true; }
if (!serviceKey) { console.error("FAIL: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is missing"); failed = true; }

if (!failed) {
  try {
    const client = createClient(url, anonKey);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    console.log("PASS: Both supabase clients initialized without throwing");
  } catch (e) {
    console.error("FAIL: Client creation threw:", e.message);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
