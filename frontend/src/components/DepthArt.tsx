import { useEffect, useRef, useState } from 'react'
import { resolveImageUrl, type Lang, type PanelLayers } from '../api'

const COPY = {
  ru: { tilt: 'Наклон телефона', unavailable: 'Датчик наклона недоступен.' },
  kk: { tilt: 'Телефонды еңкейту', unavailable: 'Еңкею датчигі қолжетімсіз.' },
}

type Permission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
const limit = (value: number) => Math.min(1, Math.max(-1, value))
let tiltForVisit = false

export function DepthArt({ layers, lang }: { layers: PanelLayers; lang: Lang }) {
  const surface = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(0)
  const [failed, setFailed] = useState(false)
  const [tilt, setTilt] = useState(() => tiltForVisit)
  const [tiltError, setTiltError] = useState(false)
  const ready = loaded === 2 && !failed

  useEffect(() => {
    const node = surface.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!node || !ready) return
    let frame = 0
    let tiltX = 0
    let tiltY = 0
    let origin: { x: number; y: number } | undefined
    function refresh() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!node || motion.matches) return
        const rect = node.getBoundingClientRect()
        if (rect.bottom < 0 || rect.top > innerHeight) return
        const y = limit((innerHeight / 2 - rect.top - rect.height / 2) / (innerHeight / 2))
        node.style.setProperty('--depth-x', String(tiltX))
        node.style.setProperty('--depth-y', String(limit(y + tiltY)))
      })
    }
    function orient(event: DeviceOrientationEvent) {
      if (motion.matches || event.gamma === null || event.beta === null) return
      origin ??= { x: event.gamma, y: event.beta }
      tiltX = limit((event.gamma - origin.x) / 18)
      tiltY = limit((event.beta - origin.y) / 25)
      refresh()
    }
    window.addEventListener('scroll', refresh, { passive: true })
    window.addEventListener('resize', refresh, { passive: true })
    motion.addEventListener('change', refresh)
    if (tilt) window.addEventListener('deviceorientation', orient)
    refresh()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', refresh)
      window.removeEventListener('resize', refresh)
      motion.removeEventListener('change', refresh)
      window.removeEventListener('deviceorientation', orient)
    }
  }, [ready, tilt])

  async function toggleTilt() {
    if (tilt) { tiltForVisit = false; setTilt(false); return }
    setTiltError(false)
    try {
      const sensor = window.DeviceOrientationEvent as Permission | undefined
      if (!sensor || (sensor.requestPermission && await sensor.requestPermission() !== 'granted')) {
        setTiltError(true)
        return
      }
      tiltForVisit = true
      setTilt(true)
    } catch { setTiltError(true) }
  }

  return (
    <>
      <div ref={surface} aria-hidden="true" className="comic-depth" data-ready={ready}>
        {[layers.backgroundUrl, layers.foregroundUrl].map((url, index) => (
          <img key={url} className={index === 0 ? 'comic-depth-bg' : 'comic-depth-fg'}
            src={resolveImageUrl(url)} alt="" decoding="async"
            onLoad={() => setLoaded((count) => count + 1)} onError={() => setFailed(true)} />
        ))}
      </div>
      {ready && typeof window.DeviceOrientationEvent !== 'undefined' && (
        <div className="absolute right-2 bottom-2 motion-reduce:hidden pointer-fine:hidden">
          <button type="button" aria-pressed={tilt} onClick={toggleTilt}
            className="min-h-11 rounded-lg border-2 border-ink bg-white px-2 text-sm font-black text-ink aria-pressed:bg-sun focus-visible:outline-3 focus-visible:outline-brand">
            {COPY[lang].tilt}
          </button>
          {tiltError && <p role="status" className="mt-1 rounded-lg bg-white px-2 text-sm font-semibold">{COPY[lang].unavailable}</p>}
        </div>
      )}
    </>
  )
}
