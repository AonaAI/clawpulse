-- Enable Supabase Realtime for the agents table so postgres_changes events are broadcast
-- This fixes stale agent status in the UI (realtime subscription was silently receiving nothing)
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
