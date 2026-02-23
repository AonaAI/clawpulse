---
name: clawpulse
description: "Agent Ops Dashboard — monitor, manage, and observe AI agents in real time. Track sessions, errors, alerts, workflows, metrics, and more via a web UI backed by Supabase and hosted on Firebase."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
        "requires": { "env": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
        "urls": { "dashboard": "https://clawpulse.web.app", "repo": "https://github.com/bastiencodes/clawpulse" },
      },
  }
---

# ClawPulse — Agent Ops Dashboard

## What This Skill Does

ClawPulse is a real-time operations dashboard for monitoring and managing AI agents. It provides session tracking, error monitoring, alerting, workflow management, metrics, and more — all through a web interface backed by Supabase and hosted on Firebase.

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account and project (free tier works)
- **Firebase** account with Hosting enabled
- **Git** for cloning the repository

## Installation

### 1. Clone and install

```bash
git clone https://github.com/yourusername/clawpulse.git
cd clawpulse
npm install
```

Or run the setup script:

```bash
chmod +x setup.sh
./setup.sh
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your **Project URL** and **anon/public key**
3. Run the database migrations in order:

```bash
# Option A: Supabase CLI
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Option B: Manual — paste each file from supabase/migrations/ into the SQL Editor
# Run them in order: 001_create_tables.sql through 013_mission_hierarchy.sql
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_APP_NAME=ClawPulse
NEXT_PUBLIC_COMPANY_NAME=My Company
```

### 4. Deploy to Firebase Hosting

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools
firebase login

# Build and deploy
npm run build
firebase deploy --only hosting
```

## Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `NEXT_PUBLIC_APP_NAME` | No | Display name (default: ClawPulse) |
| `NEXT_PUBLIC_COMPANY_NAME` | No | Organization name |

## Usage

Once deployed, access the dashboard at your Firebase Hosting URL. The dashboard provides:

- **Agents** — View all connected agents, their status, and activity
- **Sessions** — Browse session history with full timelines
- **Errors** — Track and resolve agent errors
- **Alerts** — Configure notification rules
- **Workflows** — Manage multi-step agent operations
- **Knowledge Base** — Maintain shared agent knowledge
- **Tasks** — Assign and track work items
- **Comms** — Review agent communication logs
- **Metrics** — Monitor token usage, performance, and custom KPIs
- **Mission** — Set mission, vision, and goals hierarchy

Data updates in real time via Supabase Realtime subscriptions.
