'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'

export interface DateRange {
  preset: 'today' | '7d' | '30d' | '90d' | 'custom'
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

export function getPresetDates(preset: string): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case '30d':   return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today }
    case '90d':   return { from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), to: today }
    default:      return { from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), to: today }
  }
}

export function parseDateRangeFromParams(params: URLSearchParams): DateRange {
  const preset = params.get('preset') ?? '7d'
  if (preset === 'custom') {
    const today = new Date().toISOString().slice(0, 10)
    return {
      preset: 'custom',
      from: params.get('from') ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      to: params.get('to') ?? today,
    }
  }
  return { preset: preset as DateRange['preset'], ...getPresetDates(preset) }
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: 'Last 7 Days' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: '90d',   label: 'Last 90 Days' },
  { key: 'custom', label: 'Custom Range' },
] as const

// ── Styles ──────────────────────────────────────────────────────────────────

const BG_DEEP   = 'var(--cp-deep-bg)'
const BG_CARD   = 'var(--cp-card-solid-bg)'
const ACCENT    = '#6412A6'
const ACCENT_HI = '#8b35e8'
const BORDER    = 'rgba(100,18,166,0.35)'
const BORDER_DIM = 'rgba(100,18,166,0.22)'

// ── Inner component (uses useSearchParams) ──────────────────────────────────

interface DateRangePickerProps {
  onChange?: (range: DateRange) => void
}

function DateRangePickerInner({ onChange }: DateRangePickerProps) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const range = parseDateRangeFromParams(searchParams)

  const [customFrom, setCustomFrom] = useState(range.preset === 'custom' ? range.from : getPresetDates('7d').from)
  const [customTo,   setCustomTo]   = useState(range.preset === 'custom' ? range.to   : getPresetDates('7d').to)

  // Notify parent of current range on mount and when it changes
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => {
    onChangeRef.current?.(range)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, range.preset])

  function pushParams(preset: string, from?: string, to?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('preset', preset)
    if (preset === 'custom' && from && to) {
      params.set('from', from)
      params.set('to', to)
    } else {
      params.delete('from')
      params.delete('to')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function selectPreset(key: string) {
    if (key === 'custom') {
      pushParams('custom', customFrom, customTo)
    } else {
      pushParams(key)
    }
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      pushParams('custom', customFrom, customTo)
    }
  }

  return (
    <div
      style={{
        background: BG_DEEP,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 2 }}>
          Range
        </span>
        {PRESETS.map(p => {
          const isActive = range.preset === p.key
          return (
            <button
              key={p.key}
              onClick={() => selectPreset(p.key)}
              style={{
                background: isActive ? ACCENT : BG_CARD,
                border: `1px solid ${isActive ? ACCENT_HI : BORDER_DIM}`,
                color: isActive ? '#fff' : '#a78bfa',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                boxShadow: isActive ? `0 0 12px rgba(100,18,166,0.4)` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(100,18,166,0.22)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = BG_CARD
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Custom date inputs */}
      {range.preset === 'custom' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 10,
            borderLeft: `1px solid ${BORDER_DIM}`,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>From</span>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={e => setCustomFrom(e.target.value)}
            style={{
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              color: '#f8f4ff',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
          <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>To</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            onChange={e => setCustomTo(e.target.value)}
            style={{
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              color: '#f8f4ff',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            style={{
              background: ACCENT,
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (!customFrom || !customTo || customFrom > customTo) ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Active range label */}
      {range.preset !== 'custom' && (
        <span
          style={{
            color: '#6b7280',
            fontSize: 11,
            marginLeft: 'auto',
            fontWeight: 500,
          }}
        >
          {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
        </span>
      )}
    </div>
  )
}

// ── Public export (Suspense boundary) ──────────────────────────────────────

export function DateRangePicker({ onChange }: DateRangePickerProps) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: BG_DEEP,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            height: 46,
          }}
        />
      }
    >
      <DateRangePickerInner onChange={onChange} />
    </Suspense>
  )
}
