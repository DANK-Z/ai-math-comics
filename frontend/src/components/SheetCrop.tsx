import type { ReactNode } from 'react'
import { SHEET, type Rect } from '../art/sheet'

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
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${rect.w} / ${rect.h}` }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
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
      {children}
    </div>
  )
}
