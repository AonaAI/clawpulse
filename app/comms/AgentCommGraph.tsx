'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { AGENTS } from '@/lib/data'
import { fetchAgentLiveStatus, fetchSlackMessages } from '@/lib/supabase-client'

// ── Types ───────────────────────────────────────────────────────────────────

interface AgentNode {
  id: string
  name: string
  role: string
  initials: string
  status: 'working' | 'idle' | 'offline' | 'unknown'
  x: number
  y: number
  vx: number
  vy: number
}

interface Edge {
  source: string
  target: string
  type: 'spawn' | 'channel'
  label: string
  weight: number
}

// ── Status colors ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  working: { fill: '#065f46', stroke: '#34d399', glow: 'rgba(52,211,153,0.4)' },
  idle:    { fill: '#1f2937', stroke: '#6b7280', glow: 'rgba(107,114,128,0.2)' },
  offline: { fill: '#111827', stroke: '#374151', glow: 'rgba(55,65,81,0.1)' },
  unknown: { fill: '#111827', stroke: '#374151', glow: 'rgba(55,65,81,0.1)' },
}

// ── Force-directed layout ───────────────────────────────────────────────────

function runForceLayout(nodes: AgentNode[], edges: Edge[], width: number, height: number, iterations = 120) {
  const cx = width / 2
  const cy = height / 2
  // Place nodes in a circle initially
  const angleStep = (2 * Math.PI) / nodes.length
  nodes.forEach((n, i) => {
    n.x = cx + Math.cos(angleStep * i) * Math.min(width, height) * 0.3
    n.y = cy + Math.sin(angleStep * i) * Math.min(width, height) * 0.3
    n.vx = 0
    n.vy = 0
  })

  const edgeSet = new Set(edges.map(e => `${e.source}-${e.target}`))

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations
    const repulsion = 8000 * alpha
    const attraction = 0.005 * alpha

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x
        let dy = nodes[i].y - nodes[j].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const force = repulsion / (dist * dist)
        dx = (dx / dist) * force
        dy = (dy / dist) * force
        nodes[i].vx += dx
        nodes[i].vy += dy
        nodes[j].vx -= dx
        nodes[j].vy -= dy
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodes.find(n => n.id === edge.source)!
      const b = nodes.find(n => n.id === edge.target)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const force = dist * attraction * edge.weight
      a.vx += (dx / dist) * force
      a.vy += (dy / dist) * force
      b.vx -= (dx / dist) * force
      b.vy -= (dy / dist) * force
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.01
      n.vy += (cy - n.y) * 0.01
    }

    // Apply velocity with damping
    for (const n of nodes) {
      n.vx *= 0.8
      n.vy *= 0.8
      n.x += n.vx
      n.y += n.vy
      // Keep in bounds
      n.x = Math.max(40, Math.min(width - 40, n.x))
      n.y = Math.max(40, Math.min(height - 40, n.y))
    }
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AgentCommGraph() {
  const [nodes, setNodes] = useState<AgentNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDimensions({ width, height: Math.max(350, Math.min(500, width * 0.55)) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Fetch data and compute graph
  useEffect(() => {
    async function load() {
      const [liveStatus, slackMessages] = await Promise.all([
        fetchAgentLiveStatus(),
        fetchSlackMessages(500),
      ])

      const statusMap = new Map(liveStatus.map(s => [s.dir, s.status]))

      // Build nodes
      const agentNodes: AgentNode[] = AGENTS.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        initials: a.name.slice(0, 2).toUpperCase(),
        status: (statusMap.get(a.id) || statusMap.get(a.dir || '') || 'offline') as AgentNode['status'],
        x: 0, y: 0, vx: 0, vy: 0,
      }))

      // Build edges from spawn_permissions
      const edgeList: Edge[] = []
      const edgeKey = (a: string, b: string) => [a, b].sort().join('|')
      const edgeMap = new Map<string, Edge>()

      for (const agent of AGENTS) {
        for (const target of agent.spawn_permissions) {
          const key = `spawn:${agent.id}->${target}`
          edgeList.push({
            source: agent.id,
            target,
            type: 'spawn',
            label: `${agent.name} can spawn ${AGENTS.find(a => a.id === target)?.name || target}`,
            weight: 2,
          })
        }
      }

      // Build edges from shared Slack channels (agents messaging in same channel)
      const channelAgents = new Map<string, Set<string>>()
      for (const msg of slackMessages) {
        if (!channelAgents.has(msg.channel)) channelAgents.set(msg.channel, new Set())
        channelAgents.get(msg.channel)!.add(msg.agent_id)
      }

      // Also add from static AGENTS data
      for (const agent of AGENTS) {
        for (const ch of agent.slack_channels) {
          if (!channelAgents.has(ch)) channelAgents.set(ch, new Set())
          channelAgents.get(ch)!.add(agent.id)
        }
      }

      // Create channel edges between agents sharing channels
      const channelEdgeMap = new Map<string, { channels: string[]; weight: number }>()
      for (const [channel, agents] of channelAgents) {
        const arr = Array.from(agents)
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const key = edgeKey(arr[i], arr[j])
            if (!channelEdgeMap.has(key)) channelEdgeMap.set(key, { channels: [], weight: 0 })
            const entry = channelEdgeMap.get(key)!
            if (!entry.channels.includes(channel)) entry.channels.push(channel)
            entry.weight += 1
          }
        }
      }

      for (const [key, val] of channelEdgeMap) {
        const [source, target] = key.split('|')
        // Don't duplicate if spawn edge exists
        const hasSpawn = edgeList.some(e => 
          (e.source === source && e.target === target) || (e.source === target && e.target === source)
        )
        if (!hasSpawn) {
          edgeList.push({
            source,
            target,
            type: 'channel',
            label: `Shared: ${val.channels.join(', ')}`,
            weight: Math.min(val.weight, 5),
          })
        }
      }

      // Run layout
      runForceLayout(agentNodes, edgeList, dimensions.width, dimensions.height)
      setNodes([...agentNodes])
      setEdges(edgeList)
    }
    load()
  }, [dimensions.width, dimensions.height])

  const nodeRadius = Math.max(20, Math.min(28, dimensions.width / 30))

  const handleNodeHover = useCallback((nodeId: string | null, e?: React.MouseEvent) => {
    setHoveredNode(nodeId)
    setHoveredEdge(null)
    if (nodeId && e) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        const rect = containerRef.current?.getBoundingClientRect()
        setTooltip({
          x: e.clientX - (rect?.left || 0),
          y: e.clientY - (rect?.top || 0) - 10,
          content: `${node.name} — ${node.role}\nStatus: ${node.status}`,
        })
      }
    } else {
      setTooltip(null)
    }
  }, [nodes])

  const handleEdgeHover = useCallback((edgeIdx: string | null, e?: React.MouseEvent) => {
    setHoveredEdge(edgeIdx)
    setHoveredNode(null)
    if (edgeIdx !== null && e) {
      const edge = edges[parseInt(edgeIdx)]
      if (edge) {
        const rect = containerRef.current?.getBoundingClientRect()
        setTooltip({
          x: e.clientX - (rect?.left || 0),
          y: e.clientY - (rect?.top || 0) - 10,
          content: edge.type === 'spawn' ? `⚡ ${edge.label}` : `💬 ${edge.label}`,
        })
      }
    } else {
      setTooltip(null)
    }
  }, [edges])

  return (
    <div ref={containerRef} className="relative w-full">
      <style>{`
        @keyframes pulse-working {
          0%, 100% { r: ${nodeRadius}; opacity: 1; }
          50% { r: ${nodeRadius + 4}; opacity: 0.7; }
        }
        .node-working { animation: pulse-working 2s ease-in-out infinite; }
      `}</style>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 12, border: '1px solid rgba(109,40,217,0.14)' }}
      >
        <defs>
          <marker id="arrow-spawn" viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(139,92,246,0.5)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = nodes.find(n => n.id === edge.source)
          const tgt = nodes.find(n => n.id === edge.target)
          if (!src || !tgt) return null

          const dx = tgt.x - src.x
          const dy = tgt.y - src.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const offsetX = (dx / dist) * nodeRadius
          const offsetY = (dy / dist) * nodeRadius

          const isHovered = hoveredEdge === String(i)
          const isConnected = hoveredNode === edge.source || hoveredNode === edge.target
          const dimmed = (hoveredNode && !isConnected) || (hoveredEdge !== null && !isHovered)

          const strokeWidth = edge.type === 'spawn' ? 2 : Math.max(1, edge.weight * 0.6)

          return (
            <line
              key={i}
              x1={src.x + offsetX}
              y1={src.y + offsetY}
              x2={tgt.x - offsetX}
              y2={tgt.y - offsetY}
              stroke={edge.type === 'spawn' ? 'rgba(139,92,246,0.5)' : 'rgba(107,114,128,0.3)'}
              strokeWidth={isHovered ? strokeWidth + 1.5 : strokeWidth}
              strokeDasharray={edge.type === 'channel' ? '4,4' : undefined}
              markerEnd={edge.type === 'spawn' ? 'url(#arrow-spawn)' : undefined}
              opacity={dimmed ? 0.15 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => handleEdgeHover(String(i), e)}
              onMouseLeave={() => handleEdgeHover(null)}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const colors = STATUS_COLORS[node.status] || STATUS_COLORS.offline
          const isHovered = hoveredNode === node.id
          const dimmed = hoveredNode && !isHovered && !edges.some(
            e => (e.source === hoveredNode && e.target === node.id) || (e.target === hoveredNode && e.source === node.id)
          )

          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              opacity={dimmed ? 0.25 : 1}
              onMouseEnter={(e) => handleNodeHover(node.id, e)}
              onMouseLeave={() => handleNodeHover(null)}
            >
              {/* Glow */}
              {node.status === 'working' && (
                <circle cx={node.x} cy={node.y} r={nodeRadius + 6} fill="none" stroke={colors.glow} strokeWidth={2} className="node-working" />
              )}
              {/* Circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? nodeRadius + 2 : nodeRadius}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isHovered ? 2.5 : 1.5}
                style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
              />
              {/* Initials */}
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.stroke}
                fontSize={nodeRadius * 0.55}
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {node.initials}
              </text>
              {/* Name label */}
              <text
                x={node.x}
                y={node.y + nodeRadius + 14}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize={10}
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {node.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(17,7,30,0.95)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            color: '#e9e2ff',
            fontSize: 12,
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            maxWidth: 220,
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap" style={{ fontSize: 11, color: '#6b7280' }}>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> Working
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} /> Idle
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#374151', display: 'inline-block' }} /> Offline
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="2"><line x1="0" y1="1" x2="16" y2="1" stroke="rgba(139,92,246,0.5)" strokeWidth="2" /></svg> Spawn
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="2"><line x1="0" y1="1" x2="16" y2="1" stroke="rgba(107,114,128,0.3)" strokeWidth="1.5" strokeDasharray="3,3" /></svg> Shared channel
        </span>
      </div>
    </div>
  )
}
