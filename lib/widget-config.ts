export type WidgetSize = 'full' | 'half'

export interface WidgetConfig {
  id: string
  label: string
  enabled: boolean
  compact: boolean
  order: number
  collapsed: boolean
  size: WidgetSize
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-bar', label: 'Stats Bar', enabled: true, compact: false, order: 0, collapsed: false, size: 'full' },
  { id: 'quick-actions', label: 'Quick Actions', enabled: true, compact: false, order: 1, collapsed: false, size: 'full' },
  { id: 'agent-grid', label: 'Agent Status Grid', enabled: true, compact: false, order: 2, collapsed: false, size: 'full' },
  { id: 'budget-status', label: 'Budget Status', enabled: true, compact: false, order: 3, collapsed: false, size: 'half' },
  { id: 'cost-summary', label: 'Cost Summary', enabled: true, compact: false, order: 4, collapsed: false, size: 'half' },
  { id: 'active-tasks', label: 'Active Tasks', enabled: true, compact: false, order: 5, collapsed: false, size: 'half' },
  { id: 'activity-feed', label: 'Activity Feed', enabled: true, compact: false, order: 6, collapsed: false, size: 'half' },
  { id: 'recent-deployments', label: 'Recent Deployments', enabled: true, compact: false, order: 7, collapsed: false, size: 'half' },
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
      return s ? { ...dw, ...s, collapsed: s.collapsed ?? false, size: s.size ?? dw.size } : dw
    })
    return merged.sort((a, b) => a.order - b.order)
  } catch {
    return DEFAULT_WIDGETS
  }
}

export function saveWidgetLayout(widgets: WidgetConfig[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
}
