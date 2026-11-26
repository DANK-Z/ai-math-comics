import type { ReactNode } from 'react'
import { useAccount } from '../account'
import type { Lang } from '../api'
import { HELPER_ART, HELPER_NAME, isHelper } from '../cosmetics'

/**
 * Pifik's face in hints and boss fights, or the robot helper the student bought in the shop
 * (Гайка, Кибер-Сфинкс). `children` is the usual Pifik avatar, shown when no helper is worn.
 */
export function HelperFace({ className = '', children }: { className?: string; children: ReactNode }) {
  const helper = useAccount().helper
  if (!isHelper(helper)) return <>{children}</>
  return (
    <span className={`relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-white ${className}`}>
      <img src={HELPER_ART[helper]} alt="" className="h-[88%] w-[88%] object-contain" />
    </span>
  )
}

/** The worn helper's name, or null when Pifik helps. */
export function useHelperName(lang: Lang): string | null {
  const helper = useAccount().helper
  return isHelper(helper) ? HELPER_NAME[helper][lang] : null
}
