import { useEffect, useRef, useState } from 'react'
import {
  AdditiveBlending, NormalBlending, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PointLight,
  RGBADepthPacking, Scene, SRGBColorSpace, Sprite, SpriteMaterial, TorusGeometry, Vector3, WebGLRenderer, BoxGeometry,
  CircleGeometry, PCFSoftShadowMap, type Texture,
} from 'three'
import type { BattleTopic, BossKind, Lang } from '../api'
import { buildBoss, CLASSIC_LOOKS, lookFor, type BossLook } from '../bossModels'
import { HERO_PORTRAITS } from '../sceneArt'

// A boss fight in 3D (three.js), for the class board and (light) for the chapter boss.
// The boss and the heroes stay comic drawings: paper cut-outs on a lit arena that cast real
// shadows. A hit flies from a hero's swing to the boss with the topic's symbols; the boss gets
// angry at half and a fifth of its HP, strikes back now and then, and the last hit plays in
// slow motion and shatters it. Sounds are synthesised (no files) and off until switched on.

type Status = 'active' | 'won' | 'stopped'

export interface ArenaProps {
  kind: BossKind
  topic: BattleTopic
  hits: number
  damage: number
  hp: number
  maxHp: number
  /** Names of the latest hits, newest first. */
  recent: string[]
  status: Status
  lang: Lang
  /** The class board: the best three on pedestals (names). */
  top?: string[]
  /** Board only: the boss strikes back every 15–20 s while the battle goes on. */
  autoAttack?: boolean
  /** Bumps when a student misses: the boss strikes back. */
  attackKey?: number
  /** The boss model; the classic look of `kind` when not given. */
  look?: BossLook
  /** Phones: no shadows, fewer effects, a lower stage. */
  lite?: boolean
}

const INK = '#1d2766'

const THEMES: Record<BattleTopic, { glyphs: string[]; color: string }> = {
  fractions: { glyphs: ['½', '¾', '⅓', '¼'], color: '#ffb020' },
  equations: { glyphs: ['x', '=', '+', 'x'], color: '#a78bff' },
  decimals: { glyphs: ['0,5', '1,2', '3,7', ','], color: '#33c3ff' },
  gcd: { glyphs: ['÷', '×', '6', '12'], color: '#3ee08a' },
  parts: { glyphs: ['1:2', '3:4', '2:5', ':'], color: '#ff6b8b' },
}

// Brighter than a night arena: the board is shown on a projector in a lit classroom.
const ARENAS: Record<BossKind, { sky: string; floor: string; rim: string; glow: string }> = {
  'x-master': { sky: '#4a3aa8', floor: '#7461e0', rim: '#ffc83d', glow: '#d2bcff' },
  'fraction-slime': { sky: '#2f7a4a', floor: '#55b86a', rim: '#ffc83d', glow: '#c8ff9a' },
}

const HEROES = {
  aldiyar: { hoodie: '#2f5bd3', pants: '#24304f', skin: '#f3c9a5' },
  aruna: { hoodie: '#8b5fd6', pants: '#2d2a4a', skin: '#f3c9a5' },
  pifik: { hoodie: '#f4f7ff', pants: '#cfd8ee', skin: '#5ad1ff' },
} as const
type HeroId = keyof typeof HEROES

const COPY = {
  ru: {
    replay: '▶ Повтор финального удара',
    final: 'ФИНАЛЬНЫЙ УДАР',
    attack: '💥 Босс атакует! Решайте быстрее!',
    rage1: '😠 Босс разозлился!',
    rage2: '🔥 Босс в ярости — ещё чуть-чуть!',
    soundOn: '🔊 Звук включён',
    soundOff: '🔇 Звук',
  },
  kk: {
    replay: '▶ Соңғы соққының қайталануы',
    final: 'СОҢҒЫ СОҚҚЫ',
    attack: '💥 Босс шабуылдады! Тезірек шешіңдер!',
    rage1: '😠 Босс ашуланды!',
    rage2: '🔥 Босс қаһарлы — сәл қалды!',
    soundOn: '🔊 Дыбыс қосулы',
    soundOff: '🔇 Дыбыс',
  },
}

// ---- sounds: tiny Web Audio synth, no files ------------------------------------------------

const SOUND_KEY = 'amc.battle.sound'

function createSfx() {
  let ctx: AudioContext | null = null
  let on = false
  try { on = localStorage.getItem(SOUND_KEY) === '1' } catch { /* private mode: off */ }
  const audio = () => {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }
  function tone(freq: number, at: number, len: number, type: OscillatorType, gain: number, slide?: number) {
    const a = audio()
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, a.currentTime + at)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + at + len)
    g.gain.setValueAtTime(gain, a.currentTime + at)
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + at + len)
    o.connect(g).connect(a.destination)
    o.start(a.currentTime + at)
    o.stop(a.currentTime + at + len + 0.05)
  }
  function noise(at: number, len: number, gain: number, low = false) {
    const a = audio()
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** (low ? 1 : 2)
    const s = a.createBufferSource()
    s.buffer = buf
    const f = a.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = low ? 400 : 3000
    const g = a.createGain()
    g.gain.value = gain
    s.connect(f).connect(g).connect(a.destination)
    s.start(a.currentTime + at)
  }
  const sounds = {
    throw: () => tone(520, 0, 0.18, 'triangle', 0.08, 900),
    hit: () => { noise(0, 0.15, 0.25); tone(220, 0, 0.15, 'square', 0.06, 110) },
    attack: () => { noise(0, 0.6, 0.5, true); tone(90, 0, 0.5, 'sawtooth', 0.12, 40) },
    rage: () => { tone(140, 0, 0.35, 'sawtooth', 0.1, 70); tone(146, 0.05, 0.35, 'sawtooth', 0.08, 72) },
    boom: () => { noise(0, 1.4, 0.7, true); tone(70, 0, 1.2, 'sine', 0.4, 30) },
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9 + i * 0.16, i === 3 ? 0.7 : 0.2, 'triangle', 0.14)),
  }
  return {
    get on() { return on },
    toggle() {
      on = !on
      try { localStorage.setItem(SOUND_KEY, on ? '1' : '0') } catch { /* not saved */ }
      if (on) sounds.throw()
      return on
    },
    play(name: keyof typeof sounds) {
      if (!on) return
      try { sounds[name]() } catch { /* audio blocked */ }
    },
  }
}

// ---- textures drawn on canvas ----------------------------------------------------------------

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function texture(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function headTexture(src: string) {
  const [c, g] = canvas(256, 256)
  const t = texture(c)
  const img = new Image()
  img.onload = () => {
    const s = Math.min(img.width, img.height)
    g.save()
    g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.clip()
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256)
    g.drawImage(img, (img.width - s) / 2, 0, s, s, 10, 10, 236, 236)
    g.restore()
    g.lineWidth = 12; g.strokeStyle = INK
    g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.stroke()
    t.needsUpdate = true
  }
  img.src = src
  return t
}

/** A comic body in the hero's outfit colours: hoodie, trousers, shoes (Pifik: a robot body). */
function bodyTexture(id: HeroId) {
  const [c, g] = canvas(256, 384)
  const { hoodie, pants } = HEROES[id]
  g.lineJoin = 'round'
  g.lineWidth = 9
  g.strokeStyle = INK
  if (id === 'pifik') {
    g.fillStyle = hoodie
    g.beginPath(); g.roundRect(48, 20, 160, 210, 70); g.fill(); g.stroke()
    g.fillStyle = '#1b2a55'
    g.beginPath(); g.roundRect(88, 80, 80, 60, 20); g.fill()
    g.fillStyle = '#5ad1ff'
    g.font = '900 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AI', 128, 112)
    const grad = g.createRadialGradient(128, 300, 4, 128, 300, 70)
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.4, '#5ad1ff'); grad.addColorStop(1, 'rgba(90,209,255,0)')
    g.fillStyle = grad
    g.fillRect(40, 230, 176, 150)
    return texture(c)
  }
  // Trousers and shoes.
  g.fillStyle = pants
  g.beginPath(); g.moveTo(78, 200); g.lineTo(178, 200); g.lineTo(184, 340); g.lineTo(136, 340); g.lineTo(128, 250); g.lineTo(120, 340); g.lineTo(72, 340); g.closePath(); g.fill(); g.stroke()
  g.fillStyle = '#f4f4f4'
  g.beginPath(); g.roundRect(60, 330, 66, 34, 14); g.fill(); g.stroke()
  g.beginPath(); g.roundRect(132, 330, 66, 34, 14); g.fill(); g.stroke()
  // Hoodie with a pocket and strings.
  g.fillStyle = hoodie
  g.beginPath(); g.moveTo(70, 30); g.quadraticCurveTo(128, 0, 186, 30); g.lineTo(206, 220); g.lineTo(50, 220); g.closePath(); g.fill(); g.stroke()
  g.lineWidth = 6
  g.beginPath(); g.roundRect(90, 140, 76, 46, 12); g.stroke()
  g.strokeStyle = '#ffffff'
  g.beginPath(); g.moveTo(112, 30); g.lineTo(108, 90); g.moveTo(144, 30); g.lineTo(148, 90); g.stroke()
  return texture(c)
}

function armTexture(id: HeroId) {
  const [c, g] = canvas(96, 256)
  const { hoodie, skin } = HEROES[id]
  g.lineWidth = 8
  g.strokeStyle = INK
  g.fillStyle = hoodie
  g.beginPath(); g.roundRect(18, 6, 60, 190, 28); g.fill(); g.stroke()
  g.fillStyle = skin
  g.beginPath(); g.arc(48, 210, 32, 0, Math.PI * 2); g.fill(); g.stroke()
  return texture(c)
}

function glyphTexture(text: string, color: string, orb: boolean) {
  const [c, g] = canvas(256, 256)
  if (orb) {
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 126)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.45, color)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
  }
  g.font = `900 ${text.length > 2 ? 78 : 120}px system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 14
  g.strokeStyle = INK
  g.strokeText(text, 128, 136)
  g.fillStyle = orb ? '#ffffff' : color
  g.fillText(text, 128, 136)
  return texture(c)
}

function labelTexture(text: string, color = '#ffc83d') {
  const [c, g] = canvas(512, 128)
  g.font = '900 64px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 14
  g.lineJoin = 'round'
  g.strokeStyle = INK
  g.strokeText(text, 256, 66, 500)
  g.fillStyle = color
  g.fillText(text, 256, 66, 500)
  return texture(c)
}

function ringTexture(color: string) {
  const [c, g] = canvas(256, 256)
  const grad = g.createRadialGradient(128, 128, 80, 128, 128, 128)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.7, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return texture(c)
}

/** Local preview only: `?bosslook=owl` (or a boss name, e.g. `?bosslook=Медная Сова`). */
function devLook(): BossLook | null {
  if (!import.meta.env.DEV) return null
  const q = new URLSearchParams(window.location.search).get('bosslook')
  if (!q) return null
  const [body, accessory] = q.split(':')
  const bodies = ['slime', 'owl', 'dragon', 'robot', 'wizard', 'golem']
  if (!bodies.includes(body)) return lookFor('x-master', q)
  const look = { ...lookFor('x-master', 'boss', body), body: body as BossLook['body'] }
  return accessory ? { ...look, accessory: accessory as BossLook['accessory'] } : look
}

// ---- the scene -------------------------------------------------------------------------------

interface Fx { update: (dt: number) => boolean }

/** A paper cut-out: a plane with a drawing that casts a shadow with its outline. */
function cutout(map: Texture, w: number, h = w) {
  const mesh = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, roughness: 0.8 }))
  mesh.castShadow = true
  mesh.customDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map, alphaTest: 0.5 })
  return mesh
}

const HERO_SCALE = 1.35

interface Hero { id: HeroId; group: Group; arm: Group; home: Vector3; swing: number; lean: number }

interface Events { onBanner: (text: string) => void }

function createArena(host: HTMLDivElement, props: ArenaProps, sfx: ReturnType<typeof createSfx>, events: Events) {
  const lite = !!props.lite
  const copy = COPY[props.lang]
  const theme = THEMES[props.topic]
  const look = ARENAS[props.kind]
  const renderer = new WebGLRenderer({ antialias: !lite })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2))
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = PCFSoftShadowMap
  host.append(renderer.domElement)
  renderer.domElement.style.display = 'block'
  const amount = lite ? 0.5 : 1

  const scene = new Scene()
  scene.background = new Color(look.sky)
  scene.fog = new Fog(look.sky, 20, 44)
  const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 100)

  scene.add(new HemisphereLight('#ffffff', look.floor, 1.7))
  const sun = new DirectionalLight('#fff4d6', 2.6)
  sun.position.set(-6, 12, 8)
  sun.castShadow = !lite
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 })
  scene.add(sun)
  const glow = new PointLight(look.glow, 30, 14)
  glow.position.set(0, 3, 1.5)
  scene.add(glow)

  // The arena: a round stage with a golden rim, pillars behind it and a rune ring under the boss.
  const floor = new Mesh(new CircleGeometry(30, 48), new MeshStandardMaterial({ color: look.sky, roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const stage = new Mesh(new CylinderGeometry(7, 7.4, 0.6, 64), new MeshStandardMaterial({ color: look.floor, roughness: 0.7 }))
  stage.position.y = 0.3
  stage.receiveShadow = true
  scene.add(stage)
  const rim = new Mesh(new TorusGeometry(7.05, 0.12, 12, 96), new MeshStandardMaterial({ color: look.rim, emissive: look.rim, emissiveIntensity: 0.6 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.62
  scene.add(rim)
  const runes = new Mesh(new TorusGeometry(2.3, 0.06, 8, 64), new MeshBasicMaterial({ color: theme.color }))
  runes.rotation.x = Math.PI / 2
  runes.position.set(0, 0.66, 0)
  scene.add(runes)
  const pillarCount = lite ? 4 : 7
  for (let i = 0; i < pillarCount; i++) {
    const a = Math.PI + (i / (pillarCount - 1)) * Math.PI
    const pillar = new Mesh(new BoxGeometry(0.7, 3.2 + (i % 3) * 0.6, 0.7), new MeshStandardMaterial({ color: '#eef1fa', roughness: 0.6 }))
    pillar.position.set(Math.cos(a) * 10, 1.6, Math.sin(a) * 8.5)
    pillar.castShadow = true
    pillar.receiveShadow = true
    scene.add(pillar)
    const gem = new Mesh(new BoxGeometry(0.45, 0.45, 0.45), new MeshStandardMaterial({ color: theme.color, emissive: theme.color, emissiveIntensity: 0.8 }))
    gem.position.set(pillar.position.x, 3.6 + (i % 3) * 0.6, pillar.position.z)
    gem.rotation.set(0.6, 0.6, 0)
    scene.add(gem)
  }

  // The boss in the middle: a 3D model built from shapes (see bossModels.ts).
  const bossLook = devLook() ?? props.look ?? CLASSIC_LOOKS[props.kind]
  let model = buildBoss(bossLook)
  const bossGroup = new Group()
  bossGroup.add(model.root)
  bossGroup.position.set(0, 0.62, 0)
  scene.add(bossGroup)
  const red = new Color('#ff4d4d')

  // The heroes in full height on the left front: body, head and a swinging arm.
  const heroes: Hero[] = (['aldiyar', 'aruna', 'pifik'] as const).map((id, i) => {
    const group = new Group()
    const body = cutout(bodyTexture(id), 1.2, 1.8)
    body.position.y = 0.9
    const head = cutout(headTexture(HERO_PORTRAITS[id]), 1.25)
    head.position.set(0, 2.15, 0.02)
    const arm = new Group()
    arm.position.set(0.5, 1.55, 0.03)
    const armMesh = cutout(armTexture(id), 0.34, 0.9)
    armMesh.position.y = -0.4
    arm.add(armMesh)
    group.add(body, head, arm)
    const home = (lite ? new Vector3(-4.2 + i * 1.5, 0.6, 3.6 - Math.abs(i - 1) * 0.4) : new Vector3(-5.2 + i * 1.9, 0.6, 3.4 - Math.abs(i - 1) * 0.5))
    group.position.copy(home)
    group.scale.setScalar(HERO_SCALE)
    scene.add(group)
    return { id, group, arm, home, swing: 0, lean: 0 }
  })

  const glyphs: Texture[] = theme.glyphs.map((t) => glyphTexture(t, theme.color, true))
  const bits: Texture[] = theme.glyphs.map((t) => glyphTexture(t, theme.color, false))
  const spark = glyphTexture('', theme.color, true)
  const wave = ringTexture('rgba(255,90,90,0.9)')
  const shared = new Set<Texture>([...glyphs, ...bits, spark, wave])
  const fx: Fx[] = []
  let shake = 0
  let flash = 0
  let knock = 0
  let timeScale = 1
  let zoom = 0
  let jump = 0
  let rage = 0
  let defeated = props.status === 'won'
  const live = { status: props.status }
  const resets: (() => void)[] = []
  model.root.visible = !defeated

  const sprite = (map: Texture, size: number, additive = false) => {
    const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending }))
    s.scale.set(size, size, 1)
    scene.add(s)
    return s
  }
  const drop = (s: Sprite | Mesh) => {
    scene.remove(s)
    const m = s.material as SpriteMaterial
    if (m.map && !shared.has(m.map)) m.map.dispose()
    m.dispose()
  }

  function burst(at: Vector3, count: number, power: number) {
    for (let i = 0; i < Math.round(count * amount); i++) {
      const s = sprite(bits[i % bits.length], 0.8 + Math.random() * 0.6)
      s.position.copy(at)
      const v = new Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.3).normalize().multiplyScalar(power * (0.6 + Math.random()))
      let life = 1.1
      fx.push({ update(dt) {
        life -= dt
        v.y -= 9 * dt
        s.position.addScaledVector(v, dt)
        s.material.opacity = Math.max(0, life)
        if (life <= 0) { drop(s); return false }
        return true
      } })
    }
  }

  function trail(at: Vector3, size: number) {
    if (lite && Math.random() < 0.5) return
    const s = sprite(spark, size, true)
    s.position.copy(at)
    let life = 0.35
    fx.push({ update(dt) {
      life -= dt
      s.material.opacity = Math.max(0, life / 0.35) * 0.8
      s.scale.setScalar(size * (0.4 + life))
      if (life <= 0) { drop(s); return false }
      return true
    } })
  }

  function floatLabel(text: string, at: Vector3, color?: string, hold = 1.4) {
    const s = sprite(labelTexture(text, color), 1)
    s.scale.set(4.8, 1.2, 1)
    s.position.copy(at)
    let life = hold
    fx.push({ update(dt) {
      life -= dt
      s.position.y += dt * 1.2
      s.material.opacity = Math.min(1, life)
      if (life <= 0) { drop(s); return false }
      return true
    } })
  }

  /** One hit: a hero swings and a glowing symbol flies to the boss in an arc. */
  function shoot(name: string, delay: number, final: boolean) {
    let wait = delay
    let t = 0
    const hero = heroes[Math.floor(Math.random() * heroes.length)]
    const from = hero.group.position.clone().add(new Vector3(0.5, 3, 0.2))
    const to = bossGroup.position.clone().add(new Vector3((Math.random() - 0.5) * 1.4, 2.2 + (Math.random() - 0.3) * 1.2, 1.2))
    let orb: Sprite | null = null
    const duration = final ? 1.1 : 0.55
    fx.push({ update(dt) {
      if (wait > 0) { wait -= dt; return true }
      if (!orb) {
        orb = sprite(glyphs[Math.floor(Math.random() * glyphs.length)], final ? 2.8 : 1.9, true)
        hero.swing = 1
        sfx.play('throw')
      }
      t += dt / duration
      const p = Math.min(1, t)
      orb.position.lerpVectors(from, to, p)
      orb.position.y += Math.sin(p * Math.PI) * (final ? 3 : 1.8)
      orb.material.rotation += dt * 6
      trail(orb.position, final ? 1.4 : 1)
      if (p < 1) return true
      drop(orb)
      shake = final ? 0.6 : 0.25
      flash = 1
      knock = final ? 0.8 : 0.35
      burst(to, final ? 30 : 14, final ? 8 : 5.5)
      floatLabel(`${name} −${props.damage}`.trim(), to.clone().add(new Vector3(0, 1.2, 0.6)))
      if (final) { sfx.play('boom'); sfx.play('fanfare'); shatter(hero, name) } else sfx.play('hit')
      return false
    } })
  }

  /** The boss strikes back: it jumps, slams the stage and a red wave knocks the heroes. */
  function attack() {
    if (defeated) return
    jump = 1
    let t = 0
    let landed = false
    fx.push({ update(dt) {
      t += dt
      if (!landed && t > 0.45) {
        landed = true
        sfx.play('attack')
        shake = 0.7
        heroes.forEach((h) => { h.lean = 1 })
        const ring = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: wave, transparent: true, depthWrite: false }))
        ring.rotation.x = -Math.PI / 2
        ring.position.set(0, 0.68, 0)
        scene.add(ring)
        let life = 0.9
        fx.push({ update(d) {
          life -= d
          const s = 1 + (0.9 - life) * 14
          ring.scale.set(s, s, 1)
          ;(ring.material as MeshBasicMaterial).opacity = Math.max(0, life / 0.9)
          if (life <= 0) { scene.remove(ring); ring.geometry.dispose(); (ring.material as MeshBasicMaterial).dispose(); return false }
          return true
        } })
        return false
      }
      return true
    } })
  }

  // Pedestals for the best three (board only), each with a name above it.
  const pedestals: { label: Sprite | null; base: Mesh }[] = []
  if (props.top) {
    const medals = ['#ffd34d', '#d7dde8', '#e0995a']
    const heights = [1.1, 0.8, 0.6]
    const xs = [3.9, 2.1, 5.7]
    for (let i = 0; i < 3; i++) {
      const base = new Mesh(new BoxGeometry(1.1, heights[i], 1.1), new MeshStandardMaterial({ color: medals[i], roughness: 0.4, metalness: 0.3 }))
      base.position.set(xs[i], 0.6 + heights[i] / 2, 1.8 + i * 0.4)
      base.castShadow = true
      base.receiveShadow = true
      scene.add(base)
      pedestals.push({ label: null, base })
    }
  }
  function setTop(names: string[]) {
    pedestals.forEach((p, i) => {
      if (p.label) { drop(p.label); p.label = null }
      const name = names[i]
      if (!name) return
      const s = sprite(labelTexture(`${['🥇', '🥈', '🥉'][i]} ${name}`, '#ffffff'), 1)
      s.scale.set(2, 0.5, 1)
      s.position.set(p.base.position.x, p.base.position.y + p.base.scale.y + 0.75, p.base.position.z)
      p.label = s
    })
  }
  if (props.top) setTop(props.top)

  /** The finisher's spotlight: the hero who threw it steps forward under a name banner. */
  function spotlight(hero: Hero, name: string) {
    const plate = new Mesh(new CylinderGeometry(1.1, 1.2, 0.3, 32), new MeshStandardMaterial({ color: '#ffd34d', emissive: '#ffb000', emissiveIntensity: 0.4 }))
    plate.position.set(0, 0.75, 5.4)
    plate.receiveShadow = true
    scene.add(plate)
    const target = new Vector3(0, 0.9, 5.4)
    let t = 0
    let banner: Sprite | null = null
    fx.push({ update(dt) {
      t += dt
      hero.group.position.lerp(target, Math.min(1, dt * 2))
      hero.group.scale.setScalar(HERO_SCALE * (1 + Math.min(1, t) * 0.25))
      if (!banner && t > 0.8 && name) {
        banner = sprite(labelTexture(`🏆 ${name}`, '#ffd34d'), 1)
        banner.scale.set(5, 1.25, 1)
        banner.position.set(0, 5.6, 5.4)
      }
      return t < 1.5
    } })
    resets.push(() => {
      scene.remove(plate); plate.geometry.dispose(); (plate.material as MeshStandardMaterial).dispose()
      if (banner) drop(banner)
      hero.group.position.copy(hero.home)
      hero.group.scale.setScalar(HERO_SCALE)
    })
  }
  /** The boss falls apart: every shape of the model flies off, bounces and fades. */
  function shatter(hero: Hero, name: string) {
    defeated = true
    spotlight(hero, name)
    const center = bossGroup.position.clone().add(new Vector3(0, 2, 0))
    const pieces = model.parts.slice()
    for (const piece of pieces) {
      scene.attach(piece)
      piece.traverse((o) => {
        const m = (o as Mesh).material as MeshBasicMaterial | undefined
        if (m) m.transparent = true
      })
      const v = piece.position.clone().sub(center).setY(0).normalize().multiplyScalar(2 + Math.random() * 3).setY(3 + Math.random() * 4)
      v.z += 1.5
      const spin = new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      let life = 3.4
      fx.push({ update(dt) {
        life -= dt
        v.y -= 9 * dt
        piece.position.addScaledVector(v, dt)
        if (piece.position.y < 0.9) { piece.position.y = 0.9; v.y *= -0.35; v.x *= 0.7; v.z *= 0.7 }
        piece.rotation.x += spin.x * dt
        piece.rotation.y += spin.y * dt
        const fade = Math.min(1, life)
        piece.traverse((o) => { const m = (o as Mesh).material as MeshBasicMaterial | undefined; if (m) m.opacity = fade })
        if (life <= 0) { scene.remove(piece); return false }
        return true
      } })
    }
    for (let i = 0; i < 40 * amount; i++) {
      const s = sprite(bits[i % bits.length], 0.6)
      s.position.set((Math.random() - 0.5) * 12, 9 + Math.random() * 6, (Math.random() - 0.5) * 8)
      const fall = 1.5 + Math.random() * 2
      let life = 6
      fx.push({ update(dt) {
        life -= dt
        s.position.y -= fall * dt
        s.material.rotation += dt
        s.material.opacity = Math.min(1, life)
        if (life <= 0 || s.position.y < 0.7) { drop(s); return false }
        return true
      } })
    }
  }

  // ---- loop ----
  let last = performance.now()
  let elapsed = 0
  let frame = 0
  let nextAttack = 15 + Math.random() * 5
  const target = new Vector3()
  const angry = new Color()
  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    if (document.hidden) { last = now; return }
    const real = Math.min(0.05, (now - last) / 1000)
    last = now
    const dt = real * timeScale
    elapsed += dt
    if (timeScale < 1) timeScale = Math.min(1, timeScale + real * 0.25)

    if (props.autoAttack && !defeated && live.status === 'active') {
      nextAttack -= real
      if (nextAttack <= 0) {
        nextAttack = 15 + Math.random() * 5
        attack()
        events.onBanner(copy.attack)
      }
    }

    // A slow orbit; narrow screens keep the camera further back so the heroes stay in frame.
    const aspect = camera.aspect
    const far = aspect < 1.4 ? (1.4 / aspect) ** 0.7 : 1
    const zoomTo = timeScale < 1 || (flash > 0.5 && defeated) ? (aspect < 1.2 ? 0.35 : 1) : 0
    zoom += (zoomTo - zoom) * Math.min(1, real * 2)
    const angle = Math.sin(elapsed * 0.18) * (lite ? 0.22 : 0.5) + (lite ? 0.2 : 0)
    const radius = 13 * far - zoom * 2.5
    camera.position.set(Math.sin(angle) * radius * (1 - zoom * 0.5), 5.2 + zoom * 0.6 + (far - 1) * 2, Math.cos(angle) * radius)
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
      shake = Math.max(0, shake - real * 1.5)
    }
    camera.lookAt(target.set(0, 2.4 + zoom * 0.6, 0))

    // The boss: breathes faster and grows when angry, jumps when it strikes back.
    const speed = 1 + rage * 0.8
    const size = 1 + rage * 0.12
    const hop = jump > 0 ? Math.sin((1 - jump) * Math.PI) * 2.2 : 0
    jump = Math.max(0, jump - dt * 1.1)
    bossGroup.position.y = 0.62 + Math.abs(Math.sin(elapsed * 1.6 * speed)) * 0.15 + hop
    bossGroup.position.z = -knock
    knock = Math.max(0, knock - dt * 2)
    // The model turns to the camera (mostly), breathes, squashes when hit and frowns when angry.
    bossGroup.rotation.y = Math.atan2(camera.position.x, camera.position.z) * 0.8
    const breath = Math.sin(elapsed * 2.4 * speed) * 0.03
    model.root.scale.set(size * (1 + breath + flash * 0.12), size * (1 - breath - flash * 0.15), size * (1 + breath))
    model.tick(elapsed, rage)
    const tint = rage ? rage * 0.3 + Math.sin(elapsed * 6) * 0.06 : 0
    for (const p of model.paints) {
      p.mat.color.copy(p.base).lerp(red, tint)
      p.mat.emissive.copy(angry.set('#ffffff'))
      p.mat.emissiveIntensity = flash * 0.55
    }
    flash = Math.max(0, flash - dt * 4)
    glow.color.set(rage ? '#ff5a5a' : look.glow)
    glow.intensity = 30 + Math.sin(elapsed * 3 * speed) * 8 + (defeated ? 0 : flash * 60)

    heroes.forEach((h, i) => {
      h.group.quaternion.copy(camera.quaternion)
      if (h.lean > 0) h.lean = Math.max(0, h.lean - dt * 1.5)
      h.group.rotateZ(h.lean * 0.35)
      if (!defeated || h.group.position.distanceTo(h.home) < 0.01) h.group.position.y = h.home.y + Math.abs(Math.sin(elapsed * 2 + i)) * 0.06
      // The swing: the arm goes up and forward, then back.
      h.arm.rotation.z = Math.sin(Math.min(1, h.swing) * Math.PI) * 2.3
      h.swing = Math.max(0, h.swing - dt * 2.6)
    })
    runes.rotation.z += dt * 0.6 * speed
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(dt)) fx.splice(i, 1)
    renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(tick)

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host
    if (!w || !h) return
    renderer.setSize(w, h, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()


  return {
    hit(names: string[]) {
      names.slice(0, 6).forEach((n, i) => shoot(n, i * 0.15, false))
    },
    win(name: string) {
      if (defeated) return
      timeScale = 0.25
      floatLabel(copy.final, new Vector3(0, 5.3, 1.5), '#ffffff')
      shoot(name, 0, true)
    },
    replay(name: string) {
      resets.splice(0).forEach((r) => r())
      defeated = false
      bossGroup.remove(model.root)
      model.dispose()
      model = buildBoss(bossLook)
      bossGroup.add(model.root)
      this.win(name)
    },
    attack,
    setStatus(status: Status) { live.status = status },
    /** 0 calm, 1 angry (≤ 50% HP), 2 furious (≤ 20%). Returns true when it got angrier. */
    setRage(level: number) {
      const up = level > rage
      rage = level
      if (up) { sfx.play('rage'); shake = 0.4; flash = 0.6 }
      return up
    },
    setTop,
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scene.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        for (const mm of mats) { (mm as MeshStandardMaterial).map?.dispose(); mm.dispose() }
      })
      shared.forEach((t) => t.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

const rageOf = (hp: number, max: number) => (!max || hp <= 0 ? 0 : hp / max <= 0.2 ? 2 : hp / max <= 0.5 ? 1 : 0)

export default function BattleArena3D(props: ArenaProps) {
  const host = useRef<HTMLDivElement>(null)
  const arena = useRef<ReturnType<typeof createArena> | null>(null)
  const sfx = useRef<ReturnType<typeof createSfx> | null>(null)
  sfx.current ??= createSfx()
  const seen = useRef(props.hits)
  const status = useRef(props.status)
  const attacks = useRef(props.attackKey ?? 0)
  const [won, setWon] = useState(props.status === 'won')
  const [replaying, setReplaying] = useState(false)
  const [sound, setSound] = useState(sfx.current.on)
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null)
  const c = COPY[props.lang]
  const topKey = (props.top ?? []).join('|')

  useEffect(() => {
    if (!host.current) return
    const made = createArena(host.current, props, sfx.current!, { onBanner: (text) => setBanner({ text, key: Date.now() }) })
    made.setRage(rageOf(props.hp, props.maxHp))
    arena.current = made
    return () => { made.dispose(); arena.current = null }
    // The scene is built once per boss and topic; everything else arrives through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kind, props.topic, props.lite])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 2600)
    return () => clearTimeout(t)
  }, [banner])

  useEffect(() => {
    const fresh = props.hits - seen.current
    seen.current = props.hits
    const finishing = props.status === 'won' && status.current === 'active'
    status.current = props.status
    arena.current?.setStatus(props.status)
    if (finishing) {
      if (fresh > 1) arena.current?.hit(props.recent.slice(1, fresh))
      arena.current?.win(props.recent[0] ?? '')
      setWon(true)
    } else if (fresh > 0 && props.status === 'active') {
      arena.current?.hit(props.recent.length ? props.recent.slice(0, fresh) : Array(fresh).fill(''))
    }
  }, [props.hits, props.status, props.recent])

  useEffect(() => {
    if (props.status !== 'active') return
    const level = rageOf(props.hp, props.maxHp)
    if (arena.current?.setRage(level)) setBanner({ text: level === 2 ? c.rage2 : c.rage1, key: Date.now() })
  }, [props.hp, props.maxHp, props.status, c.rage1, c.rage2])

  useEffect(() => {
    if (props.attackKey == null || props.attackKey === attacks.current) return
    attacks.current = props.attackKey
    arena.current?.attack()
  }, [props.attackKey])

  useEffect(() => {
    if (props.top) arena.current?.setTop(props.top)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey])

  const height = props.lite ? 'h-56 sm:h-64' : 'h-[46vh] min-h-72'
  const chip = 'rounded-xl border-[3px] border-ink px-3 py-1.5 text-sm font-black text-ink shadow-[2px_2px_0_#17233a]'
  return (
    <div className={`relative w-full overflow-hidden ${height}`}>
      <div ref={host} className="absolute inset-0" aria-hidden="true" />
      {banner && (
        <p key={banner.key} role="status" className="boss-enter pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit max-w-[90%] rounded-2xl border-[3px] border-ink bg-white px-4 py-2 text-center text-lg font-black text-ink shadow-[3px_3px_0_#17233a] sm:text-2xl">
          {banner.text}
        </p>
      )}
      <button type="button" aria-pressed={sound} onClick={() => setSound(sfx.current!.toggle())}
        className={`absolute bottom-3 left-3 ${chip} ${sound ? 'bg-sun' : 'bg-white/90'}`}>
        {sound ? c.soundOn : c.soundOff}
      </button>
      {won && (
        <button type="button" disabled={replaying}
          onClick={() => { arena.current?.replay(props.recent[0] ?? ''); setReplaying(true); setTimeout(() => setReplaying(false), 6000) }}
          className={`absolute right-3 bottom-3 ${chip} bg-sun hover:bg-white disabled:opacity-50`}>
          {c.replay}
        </button>
      )}
    </div>
  )
}
