CREATE TABLE IF NOT EXISTS public.spawn_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  task TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spawn_requests_status ON public.spawn_requests (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_spawn_requests_agent ON public.spawn_requests (agent_id, created_at DESC);

ALTER TABLE public.spawn_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.spawn_requests FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON public.spawn_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "service_all" ON public.spawn_requests FOR ALL TO service_role USING (true);
