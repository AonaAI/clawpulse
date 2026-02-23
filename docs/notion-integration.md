# Notion API Integration

ClawPulse uses the Notion API to triage tasks directly, without requiring iframe UI.

## Setup

### API Key

Set `NOTION_API_KEY` via environment variable **or** store it at:

```
~/.config/notion/api_key
```

The key must be a Notion internal integration token with access to the task database.

### Database

The integration targets database `30e5b789-1a52-81bf-9b5e-e91c26512d47`. Ensure your integration has been invited to the database page in Notion.

## Usage

```bash
# Find and start the next highest-priority task
node scripts/notion/pulse.mjs next

# Dry run — see what would happen without changing anything
node scripts/notion/pulse.mjs next --dry-run

# List all tasks (optionally filter)
node scripts/notion/pulse.mjs list
node scripts/notion/pulse.mjs list --status "In Progress"
node scripts/notion/pulse.mjs list --priority "High"

# Update a task
node scripts/notion/pulse.mjs update <page-id> --status "Done"
node scripts/notion/pulse.mjs update <page-id> --status "Done" --notes "Completed sprint 3"

# Create a new task
node scripts/notion/pulse.mjs create "Fix login bug" --priority "High" --status "Not Started"
```

## Architecture

- `scripts/notion/client.mjs` — Notion API client with retry/backoff
- `scripts/notion/pulse.mjs` — CLI entry point

No external dependencies required (uses native `fetch`).

## Error Handling

- Rate limits (429) and server errors (5xx) are retried up to 3 times with exponential backoff.
- The `retry-after` header is respected when present.
