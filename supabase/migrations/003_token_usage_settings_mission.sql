-- Migration 003: Token Usage, Settings, and Agent Missions

-- Add mission column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS mission TEXT;

-- Update agent missions
UPDATE agents SET mission = 'Orchestrate and coordinate all agents to deliver maximum value, ensuring seamless collaboration and strategic alignment across every project.' WHERE id = 'aloa';
UPDATE agents SET mission = 'Write clean, production-ready code that ships fast and stands the test of time, translating product vision into elegant technical solutions.' WHERE id = 'dev';
UPDATE agents SET mission = 'Drive projects to completion on time and on scope, bridging the gap between technical teams and business objectives with clarity and precision.' WHERE id = 'pm';
UPDATE agents SET mission = 'Maximize organic reach and authority through data-driven content strategies that connect authentically with our target audience.' WHERE id = 'seo';
UPDATE agents SET mission = 'Create visual identities and user experiences that inspire trust, delight users, and differentiate our products in the market.' WHERE id = 'design';
UPDATE agents SET mission = 'Surface competitive insights and market intelligence that give our team an unfair advantage and inform every major strategic decision.' WHERE id = 'research';
UPDATE agents SET mission = 'Accelerate growth through creative, scalable marketing initiatives that turn prospects into loyal customers and advocates.' WHERE id = 'growth';
UPDATE agents SET mission = 'Build genuine relationships and create value for every prospect, transforming cold outreach into warm conversations and closed deals.' WHERE id = 'sales';
UPDATE agents SET mission = 'Continuously improve ClawPulse to become the definitive agent operations platform, shipping features that agents and operators love.' WHERE id = 'pulse';

-- settings table (key-value store for app configuration)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed company mission and vision
INSERT INTO settings (key, value) VALUES
  ('company_mission', 'Build the operating system for autonomous AI agents — enabling businesses to deploy, coordinate, and scale intelligent agents that work tirelessly toward human goals.'),
  ('company_vision', 'A world where every organization has a tireless, intelligent team of AI agents working in perfect coordination — amplifying human creativity, accelerating progress, and making the impossible routine.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- token_usage table
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_id ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_recorded_at ON token_usage(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id);

-- RLS for new tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON settings FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON settings FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON token_usage FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON token_usage FOR INSERT WITH CHECK (true);

-- Seed token_usage data: 9 agents × 7 days = realistic usage patterns
-- Prices: Claude Opus $15/$75 per 1M tokens, Claude Sonnet $3/$15, GPT-4o $5/$15
-- Format: agent_id, input_tokens, output_tokens, model, recorded_at, cost

DO $$
DECLARE
  agents_data TEXT[][] := ARRAY[
    ARRAY['aloa', 'claude-opus-4'],
    ARRAY['dev', 'claude-sonnet-4-5'],
    ARRAY['pm', 'gpt-4o'],
    ARRAY['seo', 'claude-sonnet-4-5'],
    ARRAY['design', 'gpt-4o'],
    ARRAY['research', 'claude-sonnet-4-5'],
    ARRAY['growth', 'gpt-4o'],
    ARRAY['sales', 'claude-sonnet-4-5'],
    ARRAY['pulse', 'claude-opus-4']
  ];
  agent_row TEXT[];
  agent_id TEXT;
  model TEXT;
  day_offset INTEGER;
  session_num INTEGER;
  sessions_per_day INTEGER;
  inp INTEGER;
  outp INTEGER;
  total INTEGER;
  cost NUMERIC;
  input_price NUMERIC;
  output_price NUMERIC;
  rec_time TIMESTAMPTZ;
BEGIN
  FOR i IN 1..array_length(agents_data, 1) LOOP
    agent_row := agents_data[i];
    agent_id := agent_row[1];
    model := agent_row[2];

    -- Set pricing per million tokens
    IF model = 'claude-opus-4' THEN
      input_price := 15.0;
      output_price := 75.0;
    ELSIF model = 'claude-sonnet-4-5' THEN
      input_price := 3.0;
      output_price := 15.0;
    ELSE -- gpt-4o
      input_price := 5.0;
      output_price := 15.0;
    END IF;

    -- Generate sessions for past 7 days
    FOR day_offset IN 0..6 LOOP
      -- Vary sessions per day (1-4 sessions)
      sessions_per_day := 1 + (i + day_offset) % 4;

      FOR session_num IN 1..sessions_per_day LOOP
        -- Random-ish token counts based on agent index and day
        inp := 2000 + ((i * 3 + day_offset * 7 + session_num * 13) % 8000);
        outp := 500 + ((i * 5 + day_offset * 11 + session_num * 17) % 3000);
        total := inp + outp;
        cost := (inp::NUMERIC / 1000000.0 * input_price) + (outp::NUMERIC / 1000000.0 * output_price);

        -- Spread timestamps throughout the day
        rec_time := (NOW() - (day_offset || ' days')::INTERVAL)
                    - INTERVAL '12 hours'
                    + ((session_num * 3 + i) || ' hours')::INTERVAL
                    + ((day_offset * 17) || ' minutes')::INTERVAL;

        INSERT INTO token_usage (agent_id, input_tokens, output_tokens, total_tokens, cost_usd, model, recorded_at)
        VALUES (agent_id, inp, outp, total, cost, model, rec_time);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
