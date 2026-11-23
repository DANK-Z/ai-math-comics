import type { SkinKey } from '../api'
import { useAccount } from '../account'
import { PORTRAITS, type Rect } from '../art/sheet'
import { SheetCrop } from './SheetCrop'

// Pifik with the skin the signed-in student wears (glasses, racer helmet or yellow backpack).
// Accessories are drawn in style-sheet pixel coordinates, so the same drawing lines up with any
// crop of Pifik from the sheet (the face avatar or the larger portrait).

const INK = 'var(--color-ink)'

function Glasses() {
  return (
    <g>
      <circle cx="561" cy="277" r="14" fill="rgb(255 255 255 / 0.18)" stroke={INK} strokeWidth="3.5" />
      <circle cx="601" cy="270" r="14" fill="rgb(255 255 255 / 0.18)" stroke={INK} strokeWidth="3.5" />
      <path d="M575 275 Q581 266 587 271" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M547 279 L538 276 M615 267 L626 262" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M553 269 q4 -5 10 -4 M593 262 q4 -5 10 -4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Helmet() {
  return (
    <g>
      <path d="M537 254 C533 208 570 184 605 184 C642 184 672 208 668 254 Z" fill="#e5383b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M598 185 C601 208 602 232 602 254 L612 254 C612 232 611 208 608 185 Z" fill="#fff" />
      <path d="M585 186 C587 208 588 232 588 254" stroke="var(--color-sun)" strokeWidth="5" fill="none" />
      <path d="M533 254 L672 254" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M552 214 q10 -16 28 -20" stroke="rgb(255 255 255 / 0.7)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Backpack({ face }: { face: boolean }) {
  if (face) {
    // The face crop has no shoulders: show the backpack as a badge in the corner.
    return (
      <g>
        <rect x="611" y="279" width="26" height="25" rx="6" fill="var(--color-sun)" stroke={INK} strokeWidth="3" />
        <path d="M616 287 h16 M618 279 q6 -6 12 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      {/* The pack peeks out behind the right shoulder, next to its strap. */}
      <rect x="641" y="298" width="30" height="46" rx="9" fill="var(--color-sun)" stroke={INK} strokeWidth="3.5" />
      <path d="M643 314 h26" stroke={INK} strokeWidth="3" />
      <path d="M554 314 L566 314 L560 341 L548 341 Z M624 311 L636 312 L643 341 L631 341 Z" fill="var(--color-sun)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </g>
  )
}

export function SkinLayer({ skin, rect }: { skin: SkinKey; rect: Rect }) {
  const face = rect === PORTRAITS.pifikFace
  return (
    <svg aria-hidden viewBox={`${rect.x} ${rect.y} ${rect.w} ${rect.h}`} className="pointer-events-none absolute inset-0 size-full">
      {skin === 'smart-glasses' && <Glasses />}
      {skin === 'racer-helmet' && <Helmet />}
      {skin === 'yellow-backpack' && <Backpack face={face} />}
    </svg>
  )
}

/** Pifik's face (default) or portrait, wearing the student's skin. `skin` overrides it (shop previews). */
export function PifikSprite({
  rect = PORTRAITS.pifikFace,
  skin,
  className = '',
  eager = false,
  alt = '',
  expression,
}: {
  rect?: Rect
  skin?: SkinKey | null
  className?: string
  eager?: boolean
  alt?: string
  expression?: ReactNode
}) {
  const account = useAccount()
  const worn = skin === undefined ? account.skin : skin
  return (
    <SheetCrop rect={rect} className={className} eager={eager} alt={alt}>
      {expression}
      {worn && <SkinLayer skin={worn} rect={rect} />}
    </SheetCrop>
  )
}
import type { ReactNode } from 'react'
