import type { CSSProperties } from 'react'
import { ROADS_BRIDGE_ID, ROADS_FLAG_ID, ROADS_HILL_ID, ROADS_RIVER_ID } from '../api/roadsChapters'
import { WEATHER_FROST_ID, WEATHER_RAIN_ID, WEATHER_UNITS_ID } from '../api/weatherChapters'
import { operationChapter } from '../operations'

// Light atmosphere over a chapter's art: a few CSS particles that match the place
// (leaves on the roads, warm lights in Kokshetau, dust in the museum, sparks on Mars,
// snow or rain at the weather station). Pure CSS, a dozen elements, pointer-events off,
// and nothing at all when the reader prefers reduced motion.

export type PanelEffect = 'leaves' | 'glow' | 'dust' | 'sparks' | 'snow' | 'rain'

const BY_CHAPTER: Record<string, PanelEffect> = {
  [ROADS_FLAG_ID]: 'leaves',
  [ROADS_BRIDGE_ID]: 'leaves',
  [ROADS_RIVER_ID]: 'leaves',
  [ROADS_HILL_ID]: 'leaves',
  [WEATHER_FROST_ID]: 'snow',
  [WEATHER_RAIN_ID]: 'rain',
  [WEATHER_UNITS_ID]: 'rain',
}

const BY_OPERATION: Record<string, PanelEffect> = {
  lights: 'glow',
  museum: 'dust',
  mars: 'sparks',
}

export function panelEffectFor(comicId: string): PanelEffect | undefined {
  return BY_CHAPTER[comicId] ?? BY_OPERATION[operationChapter(comicId)?.operation.id ?? '']
}

const COUNT: Record<PanelEffect, number> = { leaves: 7, glow: 10, dust: 12, sparks: 8, snow: 14, rain: 16 }

// Fixed pseudo-random spread, so particles don't jump between renders.
const spread = (i: number, seed: number) => ((i * 37 + seed * 17) % 100) / 100

export function PanelEffects({ effect }: { effect: PanelEffect }) {
  return (
    <div aria-hidden className={`panel-fx panel-fx-${effect} pointer-events-none absolute inset-0 overflow-hidden`}>
      {Array.from({ length: COUNT[effect] }, (_, i) => (
        <span
          key={i}
          style={{
            '--x': `${Math.round(spread(i, 1) * 96 + 2)}%`,
            '--y': `${Math.round(spread(i, 3) * 90 + 4)}%`,
            '--delay': `${-(spread(i, 5) * 8).toFixed(2)}s`,
            '--speed': (0.75 + spread(i, 7) * 0.6).toFixed(2),
            '--size': (0.7 + spread(i, 11) * 0.7).toFixed(2),
          } as CSSProperties}
        />
      ))}
    </div>
  )
}
