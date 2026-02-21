export interface WidgetConfig {
  id: string
  label: string
  enabled: boolean
  compact: boolean
  order: number
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-bar', label: 'Stats Bar', enabled: true, compact: false, order: 0 },
  { id: 'quick-actions', label: 'Quick Actions', enabled: true, compact: false, order: 1 },
  { id: 'agent-grid', label: 'Agent Status Grid', enabled: true, compact: false, order: 2 },
  { id: 'cost-summary', label: 'Cost Summary', enabled: true, compact: false, order: 3 },
  { id: 'active-tasks', label: 'Active Tasks', enabled: true, compact: false, order: 4 },
  { id: 'activity-feed', label: 'Activity Feed', enabled: true, compact: false, order: 5 },
  { id: 'recent-deployments', label: 'Recent Deployments', enabled: true, compact: false, order: 6 },
]

const STORAGE_KEY = 'clawpulse-widget-layout'

export function loadWidgetLayout(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WIDGETS
    const saved: WidgetConfig[] = JSON.parse(raw)
    // Merge with defaults to pick up any new widgets
    const savedMap = new Map(saved.map(w => [w.id, w]))
    const merged = DEFAULT_WIDGETS.map(dw => savedMap.get(dw.id) ?? dw)
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
