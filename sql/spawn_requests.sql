-- Create spawn_requests table for agent task spawning from dashboard
CREATE TABLE IF NOT EXISTS public.spawn_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  task TEXT NOT NULL,
  model TEXT DEFAULT 'default',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spawn_requests_status ON public.spawn_requests (status);
CREATE INDEX IF NOT EXISTS idx_spawn_requests_agent ON public.spawn_requests (agent_id, created_at DESC);

ALTER TABLE public.spawn_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_spawn" ON public.spawn_requests FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_spawn" ON public.spawn_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "service_all_spawn" ON public.spawn_requests FOR ALL TO service_role USING (true);
