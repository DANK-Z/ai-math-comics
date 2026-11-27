/** WebGL2, a capable device and motion allowed; otherwise the boss fights stay 2D. `?2d` forces 2D. */
export function canRun3D() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    if (new URLSearchParams(window.location.search).has('2d')) return false
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
    if (memory < 3 || (navigator.hardwareConcurrency ?? 8) < 4) return false
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}
