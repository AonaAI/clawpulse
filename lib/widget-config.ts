export interface WidgetConfig {
  id: string
  label: string
  enabled: boolean
  compact: boolean
  order: number
  collapsed: boolean
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-bar', label: 'Stats Bar', enabled: true, compact: false, order: 0, collapsed: false },
  { id: 'quick-actions', label: 'Quick Actions', enabled: true, compact: false, order: 1, collapsed: false },
  { id: 'agent-grid', label: 'Agent Status Grid', enabled: true, compact: false, order: 2, collapsed: false },
  { id: 'cost-summary', label: 'Cost Summary', enabled: true, compact: false, order: 3, collapsed: false },
  { id: 'active-tasks', label: 'Active Tasks', enabled: true, compact: false, order: 4, collapsed: false },
  { id: 'activity-feed', label: 'Activity Feed', enabled: true, compact: false, order: 5, collapsed: false },
  { id: 'recent-deployments', label: 'Recent Deployments', enabled: true, compact: false, order: 6, collapsed: false },
]

const STORAGE_KEY = 'clawpulse-widget-layout'

export function loadWidgetLayout(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const saved: WidgetConfig[] = JSON.parse(raw)
    // Merge with defaults to pick up any new widgets and missing fields
    const savedMap = new Map(saved.map(w => [w.id, w]))
    const merged = DEFAULT_WIDGETS.map(dw => {
      const s = savedMap.get(dw.id)
      return s ? { ...dw, ...s, collapsed: s.collapsed ?? false } : dw
    })
    // Add any saved widgets not in defaults (shouldn't happen but safe)
    return merged.sort((a, b) => a.order - b.order)
  } catch {
    return DEFAULT_WIDGETS
  }
}

export function saveWidgetLayout(widgets: WidgetConfig[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
}
