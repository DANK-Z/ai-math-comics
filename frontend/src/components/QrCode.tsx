import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** A QR code drawn as SVG squares (dark on white, readable from a classroom board). */
export function QrCode({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const { size, cells } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    const dark: string[] = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push(`M${c + 4},${r + 4}h1v1h-1z`)
    return { size: n + 8, cells: dark.join('') }
  }, [value])
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={`block rounded-xl bg-white ${className}`}>
      <rect width={size} height={size} fill="#fff" />
      <path d={cells} fill="#111" />
    </svg>
  )
}
