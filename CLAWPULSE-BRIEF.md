# Clawpulse — Agent Operations Dashboard

## Project Overview
A web dashboard to manage and monitor a multi-agent AI system running on OpenClaw.

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Firebase Hosting
- **UI**: Dark theme, Aona brand colors (dark purple #11021d, #1a0533, #2d1054, accent #6412A6)

## Credentials (in .env.local)
- Supabase URL: https://naxbzqsecohogbkbhgti.supabase.co
- Supabase anon key: in .env.local
- Supabase service role key: in .env.local
- Firebase project: clawpulse
- GitHub repo: https://github.com/AonaAI/clawpulse

## Dashboard Sections

### 1. Overview (Home)
- Agent Status Grid — 8 agents with live status (idle/working/waiting), last activity, current task
- Activity Feed — live stream across all agents
- Active Tasks Count

### 2. Agents Registry
- Name, Role, Model (Opus/Sonnet/GPT), Workspace path
- Slack channels connected
- Spawn permissions (who can spawn whom)
- Recent activity per agent

### 3. Work Board
- Kanban view: To Do → In Progress → Done → Blocked
- Tasks tagged by agent, priority, project
- Ability to assign/reassign between agents

### 4. Knowledge Base
- Lessons Learned — searchable
- Skills Registry — installed skills per agent
- Shared documents reference

### 5. Comms & Coordination
- Cron Jobs overview — all scheduled jobs, next run times
- Slack Channel Map — which agent owns which channel
- Pending handoffs between agents

### 6. Metrics
- Tasks completed per agent (daily/weekly)
- Token usage / cost per agent
- Response times

## Agent Data (seed data for the Agents table)

| ID | Name | Role | Model | Workspace | Slack Channels |
|----|------|------|-------|-----------|----------------|
| main | Aloa | Orchestrator & Personal Assistant | Opus | ~/.openclaw/workspace | #aloa-setup, #aloa-random, #aloa-ai-empowerment, #openclaw-work |
| dev | Dev | Developer | Sonnet | ~/.openclaw/workspace-dev | #aloa-code, #aloa-aona-website |
| pm | PM | Project Manager | GPT | ~/.openclaw/workspace-pm | #alona-projects-updates, #aloa-presos |
| seo | SEO | SEO & Content | Sonnet | ~/.openclaw/workspace-seo | #aloa-seo |
| design | Design | Design & Brand | GPT | ~/.openclaw/workspace-design | #aloa-design |
| research | Research | Competitive Intel | Sonnet | ~/.openclaw/workspace-research | #aloa-aisecuritybenchmark, #aloa-interns-rd |
| growth | Growth | Marketing & Outreach | GPT | ~/.openclaw/workspace-growth | #aloa-b2c, #aloa-wander, #aloa-wanderbuddies |
| sales | Aaron | Sales Development | Sonnet | ~/.openclaw/workspace-sales | #aloa-sales-bdm |

## Database Schema (create in Supabase)

### agents
- id (text, PK)
- name (text)
- role (text)
- model (text)
- workspace (text)
- slack_channels (text[])
- spawn_permissions (text[])
- status (text: idle/working/waiting)
- last_activity (timestamptz)
- current_task (text)
- created_at (timestamptz)

### tasks
- id (uuid, PK)
- title (text)
- description (text)
- status (text: todo/in_progress/done/blocked)
- priority (text: low/medium/high/critical)
- project (text)
- assigned_agent (text, FK → agents.id)
- created_by (text)
- created_at (timestamptz)
- updated_at (timestamptz)

### knowledge
- id (uuid, PK)
- title (text)
- content (text)
- category (text: lesson/skill/document/protocol)
- tags (text[])
- source_agent (text)
- created_at (timestamptz)
- updated_at (timestamptz)

### activity_log
- id (uuid, PK)
- agent_id (text, FK → agents.id)
- action (text)
- details (text)
- metadata (jsonb)
- created_at (timestamptz)

### cron_jobs
- id (text, PK)
- name (text)
- schedule (text)
- agent_id (text)
- last_run (timestamptz)
- next_run (timestamptz)
- status (text)
- payload (jsonb)

## Deployment
- `npm run build` → static export or SSR
- `firebase deploy --only hosting`
- Firebase project: clawpulse
- firebase.json should configure hosting with public dir pointing to build output

## Design Notes
- Dark UI matching Aona brand
- Font: Manrope (Google Fonts)
- Responsive but desktop-first
- Clean, modern, professional
- Card-based layouts
- Sidebar navigation
