import sheetUrl from '../assets/reference-sheet.jpg'

// All artwork comes from the approved style sheet (docs/visual-guide.jpeg.jpeg),
// copied to src/assets/reference-sheet.jpg. Regions are in sheet pixels.
export const SHEET = { url: sheetUrl, width: 1280, height: 720 }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Position of the HTML speech bubble on the panel, in % of the panel box. */
export interface BubbleBox {
  left: number
  top: number
  width: number
  height: number
  /** Which side the tail sits on, pointing at the speaker. */
  tail: 'left' | 'right' | 'bottom'
  /** Tail offset along that side, in % of the bubble. */
  tailAt: number
}

export interface Scene {
  crop: Rect
  /** Must fully cover any lettering baked into the source art. */
  bubble: BubbleBox
  /** Where the art comes from, for the asset checklist. */
  source: 'reference-comic' | 'cast-poster'
}

// Every scene crop is 4:3 so the reader stage never letterboxes. Reference comic frame
// interiors on the sheet: top row x 719–980 / 998–1259, y 58–259; bottom row y 273–446.
export const PANEL_ASPECT = 4 / 3

export const SCENES: Record<string, Scene> = {
  // Pifik waves hello: cast poster (no dedicated comic panel exists yet).
  'pizza-01': {
    crop: { x: 476, y: 156, w: 238, h: 178.5 },
    bubble: { left: 3, top: 4, width: 40, height: 46, tail: 'right', tailAt: 70 },
    source: 'cast-poster',
  },
  // Aruna with the tablet she ordered on: cast poster.
  'pizza-02': {
    crop: { x: 264, y: 130, w: 242, h: 181.5 },
    bubble: { left: 60, top: 4, width: 38, height: 44, tail: 'left', tailAt: 72 },
    source: 'cast-poster',
  },
  // Aldiyar thinking over three pizzas: reference comic, frame 1.
  'pizza-03': {
    crop: { x: 719, y: 60, w: 261, h: 195.75 },
    bubble: { left: 47, top: 2, width: 56, height: 82, tail: 'left', tailAt: 40 },
    source: 'reference-comic',
  },
  // Pifik asks the question: reference comic, frame 3.
  'pizza-04': {
    crop: { x: 745, y: 273, w: 231, h: 173.25 },
    bubble: { left: 45, top: 2, width: 57, height: 87, tail: 'left', tailAt: 40 },
    source: 'reference-comic',
  },
  // Aruna at the board: reference comic, frame 2.
  'pizza-05': {
    crop: { x: 998, y: 60, w: 261, h: 195.75 },
    bubble: { left: 4, top: 1, width: 67, height: 53, tail: 'right', tailAt: 55 },
    source: 'reference-comic',
  },
  // Aldiyar celebrates: reference comic, frame 4.
  'pizza-06': {
    crop: { x: 1028, y: 273, w: 231, h: 173.25 },
    bubble: { left: 53, top: 3, width: 47, height: 66, tail: 'left', tailAt: 30 },
    source: 'reference-comic',
  },
}

/** Square-ish portraits from the cast poster, used for cast cards and avatars. */
export const PORTRAITS = {
  aldiyar: { x: 40, y: 118, w: 200, h: 200 },
  aruna: { x: 290, y: 124, w: 180, h: 180 },
  pifik: { x: 506, y: 180, w: 160, h: 160 },
  pifikFace: { x: 530, y: 196, w: 110, h: 110 },
} satisfies Record<string, Rect>
