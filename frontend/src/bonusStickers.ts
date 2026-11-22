import { useCallback, useRef, useState } from 'react'
import { BONUS_STICKER_IDS, type BonusSticker } from './bonusPuzzles'

const key = (id: BonusSticker) => `amc.schoolFair.bonus.${id === 'price-tag' ? 'priceTag' : id}`

function read(id: BonusSticker) {
  try { return localStorage.getItem(key(id)) === '1' } catch { return false }
}

export function useBonusStickers() {
  const [earned, setEarned] = useState<ReadonlySet<BonusSticker>>(() => new Set(BONUS_STICKER_IDS.filter(read)))
  const latest = useRef(earned)

  const award = useCallback((id: BonusSticker) => {
    if (latest.current.has(id)) return false
    latest.current = new Set([...latest.current, id])
    setEarned(latest.current)
    if (read(id)) return false
    try { localStorage.setItem(key(id), '1') } catch { /* current visit still works */ }
    return true
  }, [])

  const restore = useCallback((ids: string[]) => {
    for (const id of BONUS_STICKER_IDS) if (ids.includes(id)) award(id)
  }, [award])

  return { earned, award, restore }
}
