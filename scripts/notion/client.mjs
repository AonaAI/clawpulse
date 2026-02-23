/**
 * Notion API client for ClawPulse
 * Minimal client using native fetch (Node 18+)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';
const DATABASE_ID = '30e5b789-1a52-81bf-9b5e-e91c26512d47';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getApiKey() {
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;
  try {
    return readFileSync(join(homedir(), '.config', 'notion', 'api_key'), 'utf-8').trim();
  } catch {
    throw new Error('NOTION_API_KEY not set and ~/.config/notion/api_key not found');
  }
}

async function notionFetch(path, options = {}) {
  const apiKey = getApiKey();
  const url = `${NOTION_BASE}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get('retry-after');
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API ${res.status}: ${body}`);
    }

    return res.json();
  }
}

// Priority sort order
const PRIORITY_ORDER = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

/**
 * Query tasks from the database, optionally filtered by status/priority.
 */
export async function queryTasks({ status, priority, excludeStatuses } = {}) {
  const filters = [];

  if (status) {
    filters.push({ property: 'Status', select: { equals: status } });
  }
  if (priority) {
    filters.push({ property: 'Priority', select: { equals: priority } });
  }
  if (excludeStatuses?.length) {
    for (const s of excludeStatuses) {
      filters.push({ property: 'Status', select: { does_not_equal: s } });
    }
  }

  const body = {
    page_size: 100,
    ...(filters.length === 1 ? { filter: filters[0] } :
        filters.length > 1 ? { filter: { and: filters } } : {}),
    sorts: [{ property: 'Priority', direction: 'ascending' }],
  };

  const data = await notionFetch(`/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.results.map(parseTask).sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
}

/**
 * Update a task's Status and/or Notes.
 */
export async function updateTask(pageId, { status, notes } = {}) {
  const properties = {};
  if (status) {
    properties.Status = { select: { name: status } };
  }
  if (notes !== undefined) {
    properties.Notes = { rich_text: [{ text: { content: notes } }] };
  }

  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Create a new task in the database.
 */
export async function createTask({ title, status = 'Not Started', priority, notes }) {
  const properties = {
    Task: { title: [{ text: { content: title } }] },
    Status: { select: { name: status } },
  };
  if (priority) {
    properties.Priority = { select: { name: priority } };
  }
  if (notes) {
    properties.Notes = { rich_text: [{ text: { content: notes } }] };
  }

  return notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: DATABASE_ID },
      properties,
    }),
  });
}

/**
 * Find the next actionable task (highest priority, not Done/Blocked/Cancelled).
 */
export async function findNextTask() {
  const tasks = await queryTasks({
    excludeStatuses: ['Done', 'Blocked', 'Cancelled', 'In Progress'],
  });
  return tasks[0] || null;
}

function parseTask(page) {
  const props = page.properties;
  return {
    id: page.id,
    title: props.Task?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || '(untitled)',
    status: props.Status?.select?.name || null,
    priority: props.Priority?.select?.name || null,
    notes: props.Notes?.rich_text?.map(r => r.plain_text).join('') || null,
    owner: props.Owner?.select?.name || null,
    area: props.Area?.select?.name || null,
    url: page.url,
  };
}
