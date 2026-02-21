-- Migration 007: Add metadata JSONB column to agents table
-- Used by the webhook endpoint to store arbitrary agent state

ALTER TABLE agents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
