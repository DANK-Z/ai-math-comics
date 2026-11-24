import { useEffect, useState } from 'react'
import { isAbortError } from './api'

/** Polls a loader while `active`; returns the latest value (undefined until the first load). */
export function usePolled<T>(load: (signal: AbortSignal) => Promise<T>, ms: number, active = true) {
  const [value, setValue] = useState<T | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    load(ctrl.signal).then(
      (v) => { setValue(v); setFailed(false) },
      (err) => { if (!isAbortError(err)) setFailed(true) },
    )
    const timer = setTimeout(() => setTick((n) => n + 1), ms)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [load, ms, active, tick])
  return { value, setValue, failed, refresh: () => setTick((n) => n + 1) }
}

