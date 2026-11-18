import type { ReactNode } from 'react'

// Local illustrations keyed by the API's `imageKey`. Unknown keys render a placeholder.

const CRUST = '#d97706'
const CHEESE = '#fcd34d'
const PEPPERONI = '#dc2626'
const INK = '#1c1917'

function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a0))
  const y0 = cy + r * Math.sin(rad(a0))
  const x1 = cx + r * Math.cos(rad(a1))
  const y1 = cy + r * Math.sin(rad(a1))
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`
}

/** A pizza; `cuts` draws slice lines, `quarters` limits to that many quarter wedges. */
function Pizza({ cx, cy, r, cuts = 0, quarters }: { cx: number; cy: number; r: number; cuts?: number; quarters?: number }) {
  if (quarters !== undefined) {
    return (
      <g stroke={INK} strokeWidth={2.5}>
        {Array.from({ length: quarters }, (_, i) => (
          <g key={i}>
            <path d={wedgePath(cx, cy, r, i * 90, (i + 1) * 90)} fill={CRUST} />
            <path d={wedgePath(cx, cy, r * 0.82, i * 90 + 4, (i + 1) * 90 - 4)} fill={CHEESE} stroke="none" />
          </g>
        ))}
      </g>
    )
  }
  const dots = [
    [-0.4, -0.3],
    [0.35, -0.4],
    [0.1, 0.1],
    [-0.3, 0.4],
    [0.45, 0.35],
  ]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={CRUST} stroke={INK} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={r * 0.82} fill={CHEESE} />
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx * r} cy={cy + dy * r} r={r * 0.11} fill={PEPPERONI} />
      ))}
      {Array.from({ length: cuts }, (_, i) => {
        const a = (i * 2 * Math.PI) / cuts - Math.PI / 2
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(a)}
            y2={cy + r * Math.sin(a)}
            stroke={INK}
            strokeWidth={2.5}
          />
        )
      })}
    </g>
  )
}

function Plate({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.9} fill="#f5f5f4" stroke={INK} strokeWidth={2.5} />
}

/** Pifik: the round, friendly pi-mascot. */
function Pifik({ x, y, s = 1, wave = false, think = false }: { x: number; y: number; s?: number; wave?: boolean; think?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} stroke={INK} strokeWidth={3} strokeLinecap="round">
      {wave && <path d="M34,-10 Q55,-35 50,-55" fill="none" />}
      {wave && <circle cx={50} cy={-58} r={7} fill="#34d399" />}
      <ellipse cx={0} cy={0} rx={40} ry={44} fill="#34d399" />
      <circle cx={-14} cy={-12} r={8} fill="#fff" />
      <circle cx={14} cy={-12} r={8} fill="#fff" />
      <circle cx={think ? -11 : -13} cy={think ? -15 : -11} r={3.5} fill={INK} stroke="none" />
      <circle cx={think ? 17 : 15} cy={think ? -15 : -11} r={3.5} fill={INK} stroke="none" />
      <path d={think ? 'M-8,8 L8,8' : 'M-12,6 Q0,18 12,6'} fill="none" />
      <text x={0} y={34} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK} stroke="none">
        π
      </text>
      {think && (
        <text x={46} y={-36} fontSize={36} fontWeight={800} fill={INK} stroke="none">
          ?
        </text>
      )}
    </g>
  )
}

function Kid({ x, y, color, hair }: { x: number; y: number; color: string; hair: string }) {
  return (
    <g transform={`translate(${x},${y})`} stroke={INK} strokeWidth={2.5} strokeLinecap="round">
      <path d="M-26,60 Q-26,22 0,22 Q26,22 26,60 Z" fill={color} />
      <circle cx={0} cy={0} r={22} fill="#fde2c4" />
      <path d="M-22,-4 Q-20,-26 0,-24 Q20,-26 22,-4 Q10,-14 -22,-4 Z" fill={hair} />
      <circle cx={-7} cy={2} r={2.5} fill={INK} stroke="none" />
      <circle cx={7} cy={2} r={2.5} fill={INK} stroke="none" />
      <path d="M-6,10 Q0,15 6,10" fill="none" />
    </g>
  )
}

const KIDS = [
  { color: '#60a5fa', hair: '#292524' },
  { color: '#f472b6', hair: '#78350f' },
  { color: '#a78bfa', hair: '#1c1917' },
  { color: '#fb923c', hair: '#a16207' },
]

function Table() {
  return <rect x={10} y={150} width={300} height={30} rx={6} fill="#a16207" stroke={INK} strokeWidth={2.5} />
}

const SCENES: Record<string, ReactNode> = {
  'pizza-01': (
    <>
      {[
        [40, 30, '#f472b6'],
        [270, 40, '#60a5fa'],
        [60, 150, '#fbbf24'],
        [250, 160, '#a78bfa'],
        [160, 20, '#34d399'],
      ].map(([x, y, c], i) => (
        <rect key={i} x={x as number} y={y as number} width={10} height={10} fill={c as string} transform={`rotate(25 ${x} ${y})`} />
      ))}
      <Pifik x={160} y={105} s={1.2} wave />
    </>
  ),
  'pizza-02': (
    <>
      <Table />
      <Pizza cx={70} cy={130} r={38} />
      <Pizza cx={160} cy={130} r={38} />
      <Pizza cx={250} cy={130} r={38} />
      <Kid x={160} y={40} {...KIDS[1]} />
    </>
  ),
  'pizza-03': (
    <>
      {KIDS.map((k, i) => (
        <Kid key={i} x={50 + i * 73} y={55} {...k} />
      ))}
      <Table />
      <Pizza cx={95} cy={150} r={24} />
      <Pizza cx={160} cy={150} r={24} />
      <Pizza cx={225} cy={150} r={24} />
      <text x={290} y={40} fontSize={34} fontWeight={800} fill={INK}>
        ?
      </text>
    </>
  ),
  'pizza-04': (
    <>
      <Pifik x={60} y={80} s={0.9} think />
      <Pizza cx={160} cy={55} r={26} />
      <Pizza cx={220} cy={55} r={26} />
      <Pizza cx={280} cy={55} r={26} />
      {[0, 1, 2, 3].map((i) => (
        <Plate key={i} cx={130 + i * 52} cy={150} r={22} />
      ))}
      <path d="M220,88 L220,118" stroke={INK} strokeWidth={3} markerEnd="url(#arrow)" />
    </>
  ),
  'pizza-05': (
    <>
      <Table />
      <Pizza cx={70} cy={115} r={40} cuts={4} />
      <Pizza cx={160} cy={115} r={40} cuts={4} />
      <Pizza cx={250} cy={115} r={40} cuts={4} />
      <Kid x={160} y={30} {...KIDS[2]} />
    </>
  ),
  'pizza-06': (
    <>
      {KIDS.map((k, i) => (
        <g key={i}>
          <Kid x={45 + i * 77} y={45} {...k} />
          <Plate cx={45 + i * 77} cy={150} r={30} />
          <Pizza cx={45 + i * 77} cy={150} r={22} quarters={3} />
        </g>
      ))}
    </>
  ),
}

export function PanelArt({ imageKey, label }: { imageKey: string; label: string }) {
  const scene = SCENES[imageKey]
  return (
    <svg viewBox="0 0 320 190" role="img" aria-label={label} className="h-full w-full">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={INK} />
        </marker>
        <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#fde68a" />
        </pattern>
      </defs>
      <rect width="320" height="190" fill="#fffbeb" />
      <rect width="320" height="190" fill="url(#dots)" />
      {scene ?? (
        <g>
          <rect x={20} y={20} width={280} height={150} rx={10} fill="#f5f5f4" stroke="#a8a29e" strokeDasharray="8 6" strokeWidth={2} />
          <text x={160} y={100} textAnchor="middle" fontSize={16} fill="#78716c">
            {imageKey}
          </text>
        </g>
      )}
    </svg>
  )
}
