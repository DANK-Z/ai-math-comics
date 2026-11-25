import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PORTRAITS } from '../art/sheet'
import { PifikSprite } from './PifikSprite'

// A short party over the whole screen when the student wins: comic confetti falls, stars burst
// and Pifik (in the student's skin) jumps up from the bottom. Pure CSS (see index.css), about
// three seconds, never blocks clicks, hidden from screen readers (the victory text is there),
// and skipped entirely when the system asks for reduced motion.

const COLORS = ['#ffc83d', '#3366e0', '#e2583e', '#00a6b4', '#8b62d6', '#22c55e']
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 60) / 100,
  duration: 1.9 + ((i * 29) % 90) / 100,
  drift: ((i * 71) % 120) - 60,
  spin: 360 + ((i * 97) % 540),
  color: COLORS[i % COLORS.length],
  shape: i % 3,
}))
const STARS = Array.from({ length: 10 }, (_, i) => ({ angle: i * 36, distance: 26 + (i % 3) * 7 }))
const DURATION_MS = 3200

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Plays once each time `when` turns true while mounted (an already-won screen opened later stays calm). */
export function Celebration({ when }: { when: boolean }) {
  const before = useRef(when)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const started = when && !before.current
    before.current = when
    if (started && !prefersReducedMotion()) setRun((n) => n + 1)
  }, [when])

  useEffect(() => {
    if (!run) return
    const timer = window.setTimeout(() => setRun(0), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [run])

  if (!run) return null
  return (
    <div key={run} aria-hidden className="celebration pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`celebration-piece celebration-shape-${p.shape}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          } as CSSProperties}
        />
      ))}
      <span className="celebration-burst">
        {STARS.map((s, i) => (
          <span key={i} className="celebration-star" style={{ '--angle': `${s.angle}deg`, '--distance': `${s.distance}vmin` } as CSSProperties}>⭐</span>
        ))}
      </span>
      <span className="celebration-pifik">
        {/* A round badge: the default Pifik is cut from the style sheet with its background. */}
        <PifikSprite rect={PORTRAITS.pifik} eager className="aspect-square w-28 overflow-hidden rounded-full border-4 border-ink bg-sky sm:w-36" />
      </span>
    </div>
  )
}
