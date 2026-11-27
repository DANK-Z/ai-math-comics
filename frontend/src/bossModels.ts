import {
  BackSide, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DataTexture, DodecahedronGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, Shape, ShapeGeometry, SphereGeometry, TorusGeometry,
  Box3, Vector3, type BufferGeometry, type Object3D,
} from 'three'
import type { BossKind } from './api'

// Bosses as 3D models built from simple shapes, in the comic style: flat toon shading with a
// dark ink outline, big eyes with highlights. A boss is a body (slime, owl, dragon, robot,
// wizard, golem), colours and an accessory. The two classic bosses have fixed looks; a boss the
// story gave its own name gets a look from the words in that name («Медная Сова» → a copper owl),
// and otherwise a stable pick from the story, so the same boss looks the same in RU and KK.

export type BossBody = 'slime' | 'owl' | 'dragon' | 'robot' | 'wizard' | 'golem'
export type BossAccessory = 'crown' | 'pizza-crown' | 'horns' | 'glasses' | 'none'

export interface BossLook {
  body: BossBody
  color: string
  accent: string
  accessory: BossAccessory
}

const INK = '#1d2766'

export const CLASSIC_LOOKS: Record<BossKind, BossLook> = {
  'fraction-slime': { body: 'slime', color: '#7ad34f', accent: '#ffc83d', accessory: 'pizza-crown' },
  'x-master': { body: 'wizard', color: '#6a4fd0', accent: '#ffc83d', accessory: 'none' },
}

const BODY_WORDS: [BossBody, RegExp][] = [
  ['owl', /сов|филин|үкі|owl/i],
  ['dragon', /дракон|змей|айдаһар|dragon/i],
  ['robot', /робот|машин|механ|кибер|robot/i],
  ['wizard', /маг|колдун|волшеб|чародей|сиқыр|wizard|магистр/i],
  ['golem', /голем|камен|скал|тас|жартас|golem|стра[жн]/i],
  ['slime', /слайм|желе|капл|slime/i],
]

const COLOR_WORDS: [string, string, RegExp][] = [
  ['#a85a28', '#ffc27a', /медн|(^|\s)мыс(\s|$)|copper/i],
  ['#e0b020', '#fff1a8', /золот|алтын|gold/i],
  ['#b8c2d6', '#ffffff', /серебр|күміс|silver|стальн|болат/i],
  ['#7fd3ff', '#ffffff', /ледян|лёд|мұз|снеж|ice/i],
  ['#e2483a', '#ffc83d', /красн|огн|пламен|қызыл|fire/i],
  ['#3d6fe0', '#9fd8ff', /син|көк|морск|blue/i],
  ['#3fae55', '#c8ff9a', /зелен|жасыл|лесн|green/i],
  ['#7a4fd0', '#ffc83d', /фиолет|күлгін|purple|тёмн|черн|ночн/i],
]

const BODIES: BossBody[] = ['owl', 'dragon', 'robot', 'golem', 'slime', 'wizard']
const PALETTE: [string, string][] = [['#c8743a', '#ffd08a'], ['#3d6fe0', '#9fd8ff'], ['#e2483a', '#ffc83d'], ['#3fae55', '#c8ff9a'], ['#7a4fd0', '#ffc83d'], ['#e0b020', '#fff1a8']]
const ACCESSORIES: BossAccessory[] = ['crown', 'horns', 'glasses', 'none']

function hash(text: string) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
  return h >>> 0
}

/** The look of a boss: classic, from its name, or a stable pick from `seed` (e.g. the comic). */
export function lookFor(kind: BossKind, name?: string | null, seed = ''): BossLook {
  if (!name) return CLASSIC_LOOKS[kind]
  const h = hash(seed || name)
  const body = BODY_WORDS.find(([, re]) => re.test(name))?.[0] ?? BODIES[h % BODIES.length]
  const colour = COLOR_WORDS.find(([, , re]) => re.test(name))
  const [color, accent] = colour ? [colour[0], colour[1]] : PALETTE[(h >>> 4) % PALETTE.length]
  const accessory = body === 'wizard' ? 'none' : ACCESSORIES[(h >>> 8) % ACCESSORIES.length]
  return { body, color, accent, accessory }
}

// ---- the kit -------------------------------------------------------------------------------

let ramp: DataTexture | null = null
function toonRamp() {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([110, 190, 255]), 3, 1, RedFormat)
    ramp.minFilter = NearestFilter
    ramp.magFilter = NearestFilter
    ramp.needsUpdate = true
  }
  return ramp
}

export interface BossModel {
  root: Group
  /** Scale that brings the model to the common height. */
  fit: number
  /** Pieces that fly apart when the boss is beaten. */
  parts: Mesh[]
  /** Toon materials with their own colour, for the angry tint and the hit flash. */
  paints: { mat: MeshToonMaterial; base: Color }[]
  /** Idle life: wings flap, the staff glows, brows frown with `rage` (0–2). */
  tick: (time: number, rage: number) => void
  dispose: () => void
}

function kit() {
  const root = new Group()
  const parts: Mesh[] = []
  const paints: BossModel['paints'] = []
  const geometries: BufferGeometry[] = []

  /** A shape with flat toon paint and an ink outline (an inverted shell just behind it). */
  function part(geo: BufferGeometry, color: string, at: [number, number, number], opts: { parent?: Object3D; scale?: [number, number, number]; rot?: [number, number, number]; outline?: number; glow?: boolean } = {}) {
    geometries.push(geo)
    const mat = new MeshToonMaterial({ color, gradientMap: toonRamp(), emissive: opts.glow ? color : '#000000', emissiveIntensity: opts.glow ? 0.8 : 1 })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(...at)
    if (opts.scale) mesh.scale.set(...opts.scale)
    if (opts.rot) mesh.rotation.set(...opts.rot)
    mesh.castShadow = true
    const width = opts.outline ?? 0.05
    if (width > 0) {
      const shell = new Mesh(geo, new MeshBasicMaterial({ color: INK, side: BackSide }))
      shell.scale.setScalar(1 + width)
      mesh.add(shell)
    }
    ;(opts.parent ?? root).add(mesh)
    parts.push(mesh)
    if (!opts.glow) paints.push({ mat, base: new Color(color) })
    return mesh
  }

  /** A big comic eye: white, pupil, highlight, and a brow that frowns when angry. */
  function eye(parent: Object3D, at: [number, number, number], size: number, side: 1 | -1) {
    const white = part(new SphereGeometry(size, 24, 16), '#ffffff', at, { parent, outline: 0.08 })
    part(new SphereGeometry(size * 0.5, 16, 12), INK, [0, 0, size * 0.62], { parent: white, outline: 0 })
    part(new SphereGeometry(size * 0.16, 8, 8), '#ffffff', [size * 0.22, size * 0.22, size * 0.95], { parent: white, outline: 0, glow: true })
    const brow = part(new BoxGeometry(size * 1.5, size * 0.28, size * 0.3), INK, [at[0], at[1] + size * 1.15, at[2] + size * 0.3], { parent, outline: 0 })
    return { brow, side, white, size }
  }

  return { root, parts, paints, geometries, part, eye }
}

function wing(width: number, height: number) {
  const s = new Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(width * 0.6, height * 0.9, width, height)
  s.lineTo(width * 0.8, height * 0.45)
  s.lineTo(width, height * 0.25)
  s.lineTo(width * 0.6, height * 0.05)
  s.lineTo(width * 0.55, -height * 0.25)
  s.closePath()
  return new ShapeGeometry(s)
}

// ---- the bodies (feet at y = 0, facing +z, about 4.4 tall) -----------------------------------

export function buildBoss(look: BossLook): BossModel {
  const k = kit()
  const { root, part, eye } = k
  const { color, accent } = look
  const brows: ReturnType<typeof eye>[] = []
  let headTop = 4
  let headAt: [number, number, number] = [0, 3, 0]
  const anim: ((t: number, rage: number) => void)[] = []

  if (look.body === 'slime') {
    part(new SphereGeometry(1.7, 40, 28), color, [0, 1.35, 0], { scale: [1.1, 0.95, 1] })
    for (const [x, z] of [[-1.3, 0.8], [1.2, 0.9], [0.2, 1.4]]) part(new SphereGeometry(0.35, 16, 12), color, [x, 0.25, z], { outline: 0.1 })
    brows.push(eye(root, [-0.62, 1.95, 1.35], 0.42, 1), eye(root, [0.62, 1.95, 1.35], 0.42, -1))
    part(new TorusGeometry(0.4, 0.08, 8, 20, Math.PI), INK, [0, 1.25, 1.7], { rot: [0, 0, Math.PI], outline: 0 })
    headTop = 3.05
    headAt = [0, 2.6, 0]
  } else if (look.body === 'owl') {
    part(new SphereGeometry(1.5, 36, 28), color, [0, 1.7, 0], { scale: [1, 1.2, 0.95] })
    part(new SphereGeometry(1.05, 28, 20), accent, [0, 1.45, 0.75], { scale: [1, 1.15, 0.6], outline: 0.03 })
    for (const side of [-1, 1]) {
      const w = part(new SphereGeometry(0.8, 20, 16), color, [side * 1.45, 1.75, -0.1], { scale: [0.45, 1.25, 0.9] })
      anim.push((t, rage) => { w.rotation.z = side * (0.15 + Math.sin(t * (3 + rage * 2)) * 0.25) })
      part(new ConeGeometry(0.32, 0.8, 4), color, [side * 0.85, 3.85, 0], { rot: [0, 0, -side * 0.35] })
      part(new CylinderGeometry(0.62, 0.62, 0.12, 28), '#ffffff', [side * 0.6, 3.0, 1.1], { rot: [Math.PI / 2, 0, 0], outline: 0.06 })
      part(new ConeGeometry(0.14, 0.4, 6), '#ff9a2e', [side * 0.4, 0.15, 0.9], { rot: [Math.PI / 2, 0, 0], outline: 0.1 })
    }
    part(new SphereGeometry(1.2, 32, 24), color, [0, 3.05, 0.1], { scale: [1.15, 0.95, 1] })
    brows.push(eye(root, [-0.6, 3.05, 1.12], 0.38, 1), eye(root, [0.6, 3.05, 1.12], 0.38, -1))
    part(new ConeGeometry(0.2, 0.55, 8), '#ff9a2e', [0, 2.6, 1.35], { rot: [Math.PI / 2 + 0.5, 0, 0] })
    headTop = 4.2
    headAt = [0, 3.4, 0]
  } else if (look.body === 'dragon') {
    part(new SphereGeometry(1.4, 32, 24), color, [0, 1.6, -0.2], { scale: [1.1, 1.15, 1.2] })
    part(new SphereGeometry(0.95, 24, 18), accent, [0, 1.45, 0.75], { scale: [0.9, 1.15, 0.5], outline: 0.03 })
    const head = part(new SphereGeometry(1.05, 32, 24), color, [0, 3.2, 0.5])
    part(new SphereGeometry(0.62, 24, 16), color, [0, 2.9, 1.35], { scale: [1.1, 0.75, 1] })
    for (const side of [-1, 1]) {
      part(new SphereGeometry(0.1, 8, 8), INK, [side * 0.25, 3.0, 1.95], { outline: 0 })
      part(new ConeGeometry(0.2, 0.9, 10), '#fff5d6', [side * 0.55, 4.15, 0.3], { rot: [-0.4, 0, -side * 0.35] })
      const w = part(wing(1.9, 1.7), accent, [side * 0.8, 2.2, -0.7], { rot: [0, side > 0 ? 0 : Math.PI, 0], outline: 0 })
      ;(w.material as MeshToonMaterial).side = DoubleSide
      anim.push((t, rage) => { w.rotation.x = Math.sin(t * (2.5 + rage * 2)) * 0.35 })
      part(new SphereGeometry(0.4, 14, 10), color, [side * 0.75, 0.3, 0.5], { scale: [1, 0.7, 1.3] })
    }
    for (let i = 0; i < 3; i++) part(new ConeGeometry(0.42 - i * 0.12, 0.7, 10), accent, [0, 2.3 - i * 0.6, -1.65 - i * 0.35], { rot: [-Math.PI / 2 - 0.3, 0, 0], outline: 0.06 })
    brows.push(eye(head, [-0.42, 0.25, 0.82], 0.28, 1), eye(head, [0.42, 0.25, 0.82], 0.28, -1))
    headTop = 4.4
    headAt = [0, 3.6, 0.5]
  } else if (look.body === 'robot') {
    part(new BoxGeometry(2.4, 2.1, 1.6), color, [0, 1.6, 0])
    part(new BoxGeometry(1.2, 0.7, 0.1), accent, [0, 1.7, 0.82], { glow: true, outline: 0.04 })
    const head = part(new BoxGeometry(1.8, 1.3, 1.4), color, [0, 3.35, 0])
    part(new BoxGeometry(1.4, 0.6, 0.1), '#1b2a55', [0, 3.4, 0.72], { outline: 0.03 })
    part(new CylinderGeometry(0.05, 0.05, 0.7, 8), INK, [0, 4.3, 0], { outline: 0 })
    const bulb = part(new SphereGeometry(0.18, 12, 10), accent, [0, 4.7, 0], { glow: true, outline: 0.1 })
    anim.push((t) => { (bulb.material as MeshToonMaterial).emissiveIntensity = 0.4 + (Math.sin(t * 6) > 0 ? 0.8 : 0) })
    for (const side of [-1, 1]) {
      const arm = part(new CylinderGeometry(0.22, 0.22, 1.5, 12), accent, [side * 1.5, 1.7, 0], { rot: [0, 0, side * 0.25] })
      anim.push((t, rage) => { arm.rotation.x = Math.sin(t * (2 + rage * 2) + side) * 0.3 })
      part(new SphereGeometry(0.35, 14, 10), color, [side * 1.7, 0.85, 0])
      part(new BoxGeometry(0.6, 0.5, 0.8), INK, [side * 0.6, 0.25, 0], { outline: 0 })
    }
    // Screen eyes: glowing, with a brow bar that tilts when angry.
    brows.push(eye(head, [-0.38, 0.05, 0.62], 0.2, 1), eye(head, [0.38, 0.05, 0.62], 0.2, -1))
    headTop = 4.9
    headAt = [0, 3.35, 0]
  } else if (look.body === 'wizard') {
    part(new ConeGeometry(1.5, 3, 32, 1, true), color, [0, 1.5, 0])
    part(new CylinderGeometry(1.5, 1.5, 0.1, 32), color, [0, 0.05, 0], { outline: 0.03 })
    const head = part(new SphereGeometry(0.85, 28, 20), '#f3c9a5', [0, 3.3, 0.1])
    part(new ConeGeometry(0.75, 1.6, 20), '#f4f4f4', [0, 2.35, 0.55], { rot: [Math.PI + 0.15, 0, 0] })
    part(new CylinderGeometry(1.35, 1.35, 0.12, 32), color, [0, 3.85, 0], { outline: 0.04 })
    const hat = part(new ConeGeometry(0.95, 2.1, 28), color, [0, 4.95, -0.1], { rot: [-0.2, 0, 0.15] })
    part(new TorusGeometry(0.88, 0.1, 8, 28), accent, [0, 4.0, 0], { rot: [Math.PI / 2, 0, 0], outline: 0.08 })
    part(new CylinderGeometry(0.09, 0.09, 4, 8), '#8a5a2b', [1.55, 2, 0.6], { rot: [0, 0, -0.08] })
    const orb = part(new SphereGeometry(0.38, 20, 14), accent, [1.7, 4.15, 0.6], { glow: true, outline: 0.08 })
    anim.push((t, rage) => {
      ;(orb.material as MeshToonMaterial).emissiveIntensity = 0.6 + Math.sin(t * (3 + rage * 3)) * 0.4
      hat.rotation.z = 0.15 + Math.sin(t * 1.5) * 0.06
    })
    brows.push(eye(head, [-0.3, 0.1, 0.72], 0.2, 1), eye(head, [0.3, 0.1, 0.72], 0.2, -1))
    headTop = 6
    headAt = [0, 3.3, 0]
  } else {
    // Golem: rough stones with glowing rune eyes.
    part(new DodecahedronGeometry(1.5, 0), color, [0, 1.7, 0], { scale: [1.15, 1, 0.9] })
    const head = part(new DodecahedronGeometry(0.85, 0), color, [0, 3.45, 0.1])
    for (const side of [-1, 1]) {
      const arm = part(new DodecahedronGeometry(0.65, 0), color, [side * 1.85, 1.8, 0.1], { scale: [0.9, 1.4, 0.9] })
      anim.push((t, rage) => { arm.position.y = 1.8 + Math.sin(t * (2 + rage * 2) + side) * 0.12 })
      part(new DodecahedronGeometry(0.55, 0), color, [side * 0.75, 0.45, 0])
      part(new BoxGeometry(0.4, 0.12, 0.1), accent, [side * 0.45, 0.2, 0.86], { parent: head, glow: true, outline: 0 })
    }
    part(new TorusGeometry(0.45, 0.07, 6, 12), accent, [0, 1.8, 1.3], { glow: true, outline: 0 })
    headTop = 4.4
    headAt = [0, 3.45, 0]
  }

  // Accessories sit on the head.
  const [hx, , hz] = headAt
  if (look.accessory === 'pizza-crown') {
    part(new ConeGeometry(0.42, 1.1, 3), '#ffc83d', [hx, headTop + 0.35, hz + 0.1], { rot: [0, Math.PI / 6, 0] })
    for (const [x, y] of [[-0.08, 0.2], [0.1, 0.45]]) part(new SphereGeometry(0.07, 8, 6), '#e2553b', [hx + x, headTop + y, hz + 0.33], { outline: 0 })
  } else if (look.accessory === 'crown') {
    part(new CylinderGeometry(0.62, 0.62, 0.35, 20, 1, true), '#ffc83d', [hx, headTop + 0.1, hz])
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      part(new ConeGeometry(0.14, 0.4, 6), '#ffc83d', [hx + Math.sin(a) * 0.55, headTop + 0.45, hz + Math.cos(a) * 0.55], { outline: 0.08 })
    }
  } else if (look.accessory === 'horns') {
    for (const side of [-1, 1]) part(new ConeGeometry(0.22, 0.9, 10), '#fff5d6', [hx + side * 0.6, headTop + 0.1, hz], { rot: [0, 0, -side * 0.5] })
  } else if (look.accessory === 'glasses') {
    // Round glasses sit exactly on the eyes, whatever the body, with a bridge between the rims.
    root.updateMatrixWorld(true)
    const rims = brows.filter((e) => e.size > 0.05).map((e) => {
      const at = e.white.getWorldPosition(new Vector3())
      const r = e.size * 1.3
      part(new TorusGeometry(r, Math.max(0.04, e.size * 0.12), 8, 28), INK, [at.x, at.y, at.z + e.size * 0.8], { outline: 0 })
      return { at, r, z: at.z + e.size * 0.8 }
    })
    if (rims.length === 2) {
      const [a, b] = rims
      const gap = Math.max(0.05, a.at.distanceTo(b.at) - a.r - b.r)
      part(new CylinderGeometry(0.04, 0.04, gap, 8), INK, [(a.at.x + b.at.x) / 2, (a.at.y + b.at.y) / 2 + 0.04, (a.z + b.z) / 2], { rot: [0, 0, Math.PI / 2], outline: 0 })
    }
  }

  // Every boss fits the same height on the stage, the tall wizard included.
  const box = new Box3().setFromObject(root)
  const fit = Math.min(1, 4.6 / Math.max(0.1, box.max.y))

  return {
    root,
    fit,
    parts: k.parts.filter((p) => p.parent === root),
    paints: k.paints,
    tick(time, rage) {
      for (const a of anim) a(time, rage)
      for (const { brow, side } of brows) brow.rotation.z = side * rage * 0.25
    },
    dispose() {
      for (const g of k.geometries) g.dispose()
      root.traverse((o) => {
        const m = (o as Mesh).material
        if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose())
      })
    },
  }
}
