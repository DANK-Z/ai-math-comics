import type { ReactNode } from 'react'
import { PORTRAITS, SHEET, type Rect } from '../art/sheet'
import aldiyarPortrait from '../assets/portraits/aldiyar.webp'
import arunaPortrait from '../assets/portraits/aruna.webp'
import pifikFacePortrait from '../assets/portraits/pifik-face.webp'
import pifikPortrait from '../assets/portraits/pifik.webp'

/**
 * Character portraits come from a comic panel («Флажок на колёсах», panel 1) rather than the
 * style sheet: the heroes are drawn larger and in the same style as the chapters.
 */
const PORTRAIT_ART = new Map<Rect, string>([
  [PORTRAITS.aldiyar, aldiyarPortrait],
  [PORTRAITS.aruna, arunaPortrait],
  [PORTRAITS.pifik, pifikPortrait],
  [PORTRAITS.pifikFace, pifikFacePortrait],
])

/**
 * Shows one region of the style sheet, scaled to fill its box.
 * The box should share the rect's aspect ratio (set via `aspect` or the parent).
 */
export function SheetCrop({
  rect,
  alt = '',
  className = '',
  eager = false,
  children,
}: {
  rect: Rect
  alt?: string
  className?: string
  eager?: boolean
  /** Drawn over the crop (e.g. Pifik's skin). */
  children?: ReactNode
}) {
  const portrait = PORTRAIT_ART.get(rect)
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${rect.w} / ${rect.h}` }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {portrait ? (
        <img
          src={portrait}
          alt=""
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="pointer-events-none absolute inset-0 size-full object-cover select-none"
        />
      ) : (
      <img
        src={SHEET.url}
        alt=""
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: `${(SHEET.width / rect.w) * 100}%`,
          height: `${(SHEET.height / rect.h) * 100}%`,
          left: `${(-rect.x / rect.w) * 100}%`,
          top: `${(-rect.y / rect.h) * 100}%`,
        }}
      />
      )}
      {children}
    </div>
  )
}
