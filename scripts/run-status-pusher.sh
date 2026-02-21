#!/bin/bash
# Continuously push agent status to Supabase every 30 seconds
cd "$(dirname "$0")/.."
while true; do
  /opt/homebrew/bin/npx tsx scripts/push-agent-status.ts 2>&1
  sleep 30
done
