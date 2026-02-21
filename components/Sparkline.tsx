'use client'

import { useId } from 'react'

const WIDTH = 80
const HEIGHT = 24
const PAD_TOP = 3
const PAD_BOTTOM = 2

interface SparklineProps {
  /** 24 values, index 0 = 23h ago, index 23 = most recent hour */
  data: number[]
}

export default function Sparkline({ data }: SparklineProps) {
  const gradId = useId()
  const points = data.length === 24 ? data : new Array(24).fill(0)
  const max = Math.max(...points)

  const toY = (v: number) => {
    if (max === 0) return HEIGHT - PAD_BOTTOM
    return PAD_TOP + (1 - v / max) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  }

  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * WIDTH,
    y: toY(v),
  }))

  const linePath = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  const fillPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ flexShrink: 0, opacity: max === 0 ? 0.3 : 1 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6412A6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6412A6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="#6412A6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
