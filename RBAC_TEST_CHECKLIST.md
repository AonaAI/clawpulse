# RBAC Manual Test Checklist

## Setup
1. Open the app, go to Settings → Dev Tools section
2. Use the role switcher to change roles

## Tests per Role

### Viewer
- [ ] Can access: /, /agents, /agents/[id], /metrics, /timeline, /activity, /sessions, /compare, /benchmarks, /comms, /knowledge
- [ ] Cannot access (redirects to / with "Access restricted" toast): /tasks, /workflows, /playground, /cron, /alerts, /errors, /usage, /mission, /api-docs, /audit, /settings
- [ ] Sidebar hides restricted nav items

### Operator
- [ ] Can access everything viewer can, plus: /tasks, /workflows, /playground, /cron, /alerts, /errors, /usage, /mission, /api-docs, /audit
- [ ] Cannot access /settings (redirects with toast)
- [ ] Sidebar hides Settings

### Admin
- [ ] Can access all routes including /settings
- [ ] All nav items visible in sidebar

## Edge Cases
- [ ] Role persists across page reload (localStorage)
- [ ] Direct URL navigation to restricted route shows toast and redirects
- [ ] Switching role immediately updates sidebar visibility
