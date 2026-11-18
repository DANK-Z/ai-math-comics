import { PORTRAITS, type Rect } from './art/sheet'

export type CharacterId = 'aldiyar' | 'aruna' | 'pifik'

export interface Character {
  id: CharacterId
  portrait: Rect
  /** Name-tag colours, taken from each character's outfit on the style sheet. */
  tag: string
}

export const CHARACTERS: Record<CharacterId, Character> = {
  aldiyar: { id: 'aldiyar', portrait: PORTRAITS.aldiyar, tag: 'bg-brand-dark text-white' },
  aruna: { id: 'aruna', portrait: PORTRAITS.aruna, tag: 'bg-grape text-white' },
  pifik: { id: 'pifik', portrait: PORTRAITS.pifik, tag: 'bg-sky-500 text-white' },
}

export const CAST: CharacterId[] = ['aldiyar', 'aruna', 'pifik']

// `speaker` is free text from the API, so match the names in any supported spelling.
const ALIASES: Record<CharacterId, string[]> = {
  aldiyar: ['алдияр', 'aldiyar'],
  aruna: ['аруна', 'aruna'],
  pifik: ['пифик', 'pifik'],
}

export function characterFor(speaker: string): Character | null {
  const s = speaker.trim().toLowerCase()
  for (const id of CAST) if (ALIASES[id].some((a) => s.startsWith(a))) return CHARACTERS[id]
  return null
}
