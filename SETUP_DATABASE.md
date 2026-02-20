# Database Setup Instructions

## Step 1: Run SQL Migration (MANUAL)

1. Go to: https://supabase.com/dashboard/project/naxbzqsecohogbkbhgti/sql/new
2. Copy the contents of `supabase/migrations/001_create_tables.sql`
3. Paste into the SQL editor
4. Click "Run"

## Step 2: Seed Data

After running the migration SQL, run:

```bash
node scripts/setup-database.js
```

This will populate all tables with realistic seed data.

## Done!

The database is now ready and the app can be wired to use real Supabase data.
