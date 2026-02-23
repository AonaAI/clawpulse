#!/usr/bin/env node
/**
 * Pulse CLI — Notion task triage for ClawPulse
 *
 * Usage:
 *   node scripts/notion/pulse.mjs next [--dry-run]
 *   node scripts/notion/pulse.mjs list [--status <status>]
 *   node scripts/notion/pulse.mjs update <id> --status <status> [--notes <notes>] [--dry-run]
 *   node scripts/notion/pulse.mjs create <title> [--priority <p>] [--status <s>] [--notes <n>]
 */

import { queryTasks, updateTask, createTask, findNextTask } from './client.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'next';

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}
const dryRun = args.includes('--dry-run');

async function main() {
  switch (command) {
    case 'next': {
      const task = await findNextTask();
      if (!task) {
        console.log(JSON.stringify({ message: 'No actionable tasks found' }));
        return;
      }
      if (dryRun) {
        console.log(JSON.stringify({ dryRun: true, wouldStart: task }, null, 2));
        return;
      }
      await updateTask(task.id, { status: 'In Progress' });
      task.status = 'In Progress';
      console.log(JSON.stringify(task, null, 2));
      break;
    }

    case 'list': {
      const status = flag('status');
      const priority = flag('priority');
      const tasks = await queryTasks({ status, priority });
      console.log(JSON.stringify(tasks, null, 2));
      break;
    }

    case 'update': {
      const id = args[1];
      if (!id) { console.error('Usage: update <page-id> --status <s>'); process.exit(1); }
      const status = flag('status');
      const notes = flag('notes');
      if (dryRun) {
        console.log(JSON.stringify({ dryRun: true, id, status, notes }));
        return;
      }
      await updateTask(id, { status, notes });
      console.log(JSON.stringify({ updated: id, status, notes }));
      break;
    }

    case 'create': {
      const title = args[1];
      if (!title) { console.error('Usage: create <title> [--priority <p>]'); process.exit(1); }
      const priority = flag('priority');
      const status = flag('status');
      const notes = flag('notes');
      if (dryRun) {
        console.log(JSON.stringify({ dryRun: true, title, priority, status, notes }));
        return;
      }
      const page = await createTask({ title, priority, status, notes });
      console.log(JSON.stringify({ created: page.id, url: page.url }));
      break;
    }

    default:
      console.error(`Unknown command: ${command}\nUsage: pulse.mjs [next|list|update|create]`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
