import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'amc.schoolFair.bonus.priceTag'

function readSticker(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function usePriceTagSticker() {
  const [earned, setEarned] = useState(readSticker)
  const awarded = useRef(earned)

  const award = useCallback(() => {
    if (awarded.current) return false
    awarded.current = true
    setEarned(true)
    if (readSticker()) return false

    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Keep the sticker for this session if storage is unavailable.
    }
    return true
  }, [])

  /** The sticker was earned on another device (saved on the server). */
  const restore = useCallback(() => {
    if (awarded.current) return
    awarded.current = true
    setEarned(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // In memory only.
    }
  }, [])

  return { earned, award, restore }
}
