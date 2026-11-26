import type { CastHeroId } from './api'
import aldiyar from './assets/portraits/aldiyar.webp'
import aruna from './assets/portraits/aruna.webp'
import dana from './assets/portraits/dana.webp'
import pifik from './assets/portraits/pifik.webp'
import timur from './assets/portraits/timur.webp'

// Art for a teacher's own task: the first panel of the chosen chapter as the scene and a
// portrait of the hero who asks the question.

const THUMBS = import.meta.glob<string>('./assets/*/*-1.thumb.webp', { eager: true, import: 'default' })

const FAIR: Record<string, string> = {
  'library-boxes': 'library-boxes/panel',
  'fair-lemonade': 'lemonade/panel',
  'fair-garland': 'garland/panel',
  'school-quest-map': 'school-map/panel',
}

export function sceneArt(comicId: string): string | undefined {
  const base = FAIR[comicId] ?? comicId.replace('-', '/')
  return THUMBS[`./assets/${base}-1.thumb.webp`]
}

export const HERO_PORTRAITS: Record<CastHeroId, string> = { aldiyar, aruna, dana, pifik, timur }
