const SLOW_KEY = 'amc.3d.slow'

/**
 * WebGL2, a device with at least 2 GB and 4 cores, and motion allowed; otherwise the boss fights
 * stay 2D. A device that turned out too slow (see markSlow) stays 2D for the session. `?2d` forces 2D.
 */
export function canRun3D() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    if (new URLSearchParams(window.location.search).has('2d')) return false
    if (sessionStorage.getItem(SLOW_KEY)) return false
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
    if (memory < 2 || (navigator.hardwareConcurrency ?? 8) < 4) return false
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** The 3D scene ran too slowly here: use 2D for the rest of the session. */
export function markSlow() {
  try { sessionStorage.setItem(SLOW_KEY, '1') } catch { /* not saved: 2D for this screen only */ }
}
