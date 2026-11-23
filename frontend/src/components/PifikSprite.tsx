import type { ReactNode } from 'react'
import type { SkinKey } from '../api'
import { useAccount } from '../account'
import { PORTRAITS, type Rect } from '../art/sheet'
import racerHelmet from '../assets/pifik/racer-helmet.webp'
import smartGlasses from '../assets/pifik/smart-glasses.webp'
import marsBackpack from '../assets/pifik/yellow-backpack.webp'
import { SheetCrop } from './SheetCrop'

// Pifik with the skin the signed-in student wears. Each skin has its own full illustration
// (transparent background, trimmed and squared); without a skin Pifik comes from the style sheet.

/** Full-body art of Pifik wearing each skin. */
const SKIN_ART: Record<SkinKey, string> = {
  'racer-helmet': racerHelmet,
  'smart-glasses': smartGlasses,
  'yellow-backpack': marsBackpack,
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
  if (worn) {
    // Small face avatars zoom into the head (the top of the art); portraits show all of Pifik.
    // The art has its own face, so an emotion overlay drawn for the sheet face is not used.
    const face = rect === PORTRAITS.pifikFace
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ aspectRatio: `${rect.w} / ${rect.h}` }}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <img
          src={SKIN_ART[worn]}
          alt=""
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`pointer-events-none absolute inset-0 size-full select-none ${face ? 'origin-top scale-[1.5] object-cover object-top' : 'object-contain p-[4%]'}`}
        />
      </div>
    )
  }
  return (
    <SheetCrop rect={rect} className={className} eager={eager} alt={alt}>
      {expression}
    </SheetCrop>
  )
}
