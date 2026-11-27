import { useEffect, useRef, useState } from 'react'
import {
  AdditiveBlending, NormalBlending, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PointLight,
  RGBADepthPacking, Scene, SRGBColorSpace, Sprite, SpriteMaterial, TorusGeometry, Vector3, WebGLRenderer, BoxGeometry,
  CircleGeometry, PCFSoftShadowMap, type Texture,
} from 'three'
import type { BattleTopic, BossKind, Lang } from '../api'
import { HERO_PORTRAITS } from '../sceneArt'

// The class board's boss fight in 3D (three.js). The boss and the heroes stay comic drawings:
// paper cut-outs standing on a lit arena that cast real shadows. Each new hit flies from a hero
// to the boss with the topic's symbols; the last hit plays in slow motion and shatters the boss.
// Loaded lazily on the board only; weak devices and «reduce motion» keep the 2D board.

type Status = 'active' | 'won' | 'stopped'

interface Props {
  kind: BossKind
  topic: BattleTopic
  hits: number
  damage: number
  /** Names of the latest hits, newest first. */
  recent: string[]
  status: Status
  lang: Lang
}

const INK = '#1d2766'

const THEMES: Record<BattleTopic, { glyphs: string[]; color: string }> = {
  fractions: { glyphs: ['½', '¾', '⅓', '¼'], color: '#ffb020' },
  equations: { glyphs: ['x', '=', '+', 'x'], color: '#a78bff' },
  decimals: { glyphs: ['0,5', '1,2', '3,7', ','], color: '#33c3ff' },
  gcd: { glyphs: ['÷', '×', '6', '12'], color: '#3ee08a' },
  parts: { glyphs: ['1:2', '3:4', '2:5', ':'], color: '#ff6b8b' },
}

const ARENAS: Record<BossKind, { sky: string; floor: string; rim: string; glow: string }> = {
  'x-master': { sky: '#1a1240', floor: '#3b2a8c', rim: '#ffc83d', glow: '#b48cff' },
  'fraction-slime': { sky: '#10301c', floor: '#2f7d3f', rim: '#ffc83d', glow: '#9dff6a' },
}

const COPY = {
  ru: { replay: '▶ Повтор финального удара', final: 'ФИНАЛЬНЫЙ УДАР' },
  kk: { replay: '▶ Соңғы соққының қайталануы', final: 'СОҢҒЫ СОҚҚЫ' },
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

function slimeTexture() {
  const [c, g] = canvas(512, 512)
  g.scale(8, 8)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const fillStroke = (d: string, fill: string, width: number) => {
    const p = new Path2D(d)
    if (fill !== 'none') { g.fillStyle = fill; g.fill(p) }
    g.strokeStyle = INK
    g.lineWidth = width
    g.stroke(p)
  }
  fillStroke('M8 52c0-18 9-36 24-36s24 18 24 36c0 4-4 6-8 6H16c-4 0-8-2-8-6z', '#7ad34f', 3)
  g.globalAlpha = 0.7
  g.strokeStyle = '#fff'
  g.lineWidth = 3
  g.stroke(new Path2D('M18 28c2-6 6-9 10-10'))
  g.globalAlpha = 1
  for (const [x, y] of [[24, 36], [40, 36]]) {
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
    g.beginPath(); g.arc(x + 1, y + 1, 2.2, 0, Math.PI * 2); g.fillStyle = INK; g.fill()
  }
  fillStroke('M26 47q6 4 12 0', 'none', 2.5)
  fillStroke('M26 17l6-13 6 13z', '#ffc83d', 2.5)
  return texture(c)
}

function wizardTexture() {
  const [c, g] = canvas(512, 512)
  g.font = '470px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('🧙', 250, 290)
  g.fillStyle = '#ffc83d'
  g.strokeStyle = INK
  g.lineWidth = 10
  g.beginPath(); g.roundRect(360, 360, 120, 120, 20); g.fill(); g.stroke()
  g.fillStyle = INK
  g.font = 'bold 96px monospace'
  g.fillText('x', 420, 416)
  return texture(c)
}

function heroTexture(src: string) {
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

// ---- the scene -------------------------------------------------------------------------------

interface Fx { update: (dt: number) => boolean }

/** A paper cut-out: a plane with a drawing that casts a shadow with its outline. */
function cutout(map: Texture, size: number) {
  const mesh = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, roughness: 0.8 }))
  mesh.castShadow = true
  mesh.customDepthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map, alphaTest: 0.5 })
  return mesh
}

function createArena(host: HTMLDivElement, props: Props) {
  const theme = THEMES[props.topic]
  const look = ARENAS[props.kind]
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  host.append(renderer.domElement)
  renderer.domElement.style.display = 'block'

  const scene = new Scene()
  scene.background = new Color(look.sky)
  scene.fog = new Fog(look.sky, 18, 40)
  const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 100)

  scene.add(new HemisphereLight('#dfe9ff', look.sky, 1.1))
  const sun = new DirectionalLight('#fff4d6', 2.4)
  sun.position.set(-6, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 })
  scene.add(sun)
  const glow = new PointLight(look.glow, 30, 14)
  glow.position.set(0, 3, 1.5)
  scene.add(glow)

  // The arena: a round stage with a golden rim, pillars and a rune ring under the boss.
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
  // Pillars stand only behind the stage, so the orbiting camera never looks through one.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI
    const pillar = new Mesh(new BoxGeometry(0.7, 3.2 + (i % 3) * 0.6, 0.7), new MeshStandardMaterial({ color: '#e8ecf8', roughness: 0.6 }))
    pillar.position.set(Math.cos(a) * 10, 1.6, Math.sin(a) * 8.5)
    pillar.castShadow = true
    pillar.receiveShadow = true
    scene.add(pillar)
    const gem = new Mesh(new BoxGeometry(0.45, 0.45, 0.45), new MeshStandardMaterial({ color: theme.color, emissive: theme.color, emissiveIntensity: 0.8 }))
    gem.position.set(pillar.position.x, 3.6 + (i % 3) * 0.6, pillar.position.z)
    gem.rotation.set(0.6, 0.6, 0)
    scene.add(gem)
  }

  // The boss in the middle, the heroes on the left front.
  const bossMap = props.kind === 'x-master' ? wizardTexture() : slimeTexture()
  const boss = cutout(bossMap, 4.4)
  const bossGroup = new Group()
  bossGroup.add(boss)
  bossGroup.position.set(0, 2.85, 0)
  scene.add(bossGroup)
  const heroes = (['aldiyar', 'aruna', 'pifik'] as const).map((id, i) => {
    const hero = cutout(heroTexture(HERO_PORTRAITS[id]), 1.5)
    hero.position.set(-3.6 + i * 2.1, 1.45, 4.2 - Math.abs(i - 1) * 0.7)
    scene.add(hero)
    return hero
  })

  const glyphs: Texture[] = theme.glyphs.map((t) => glyphTexture(t, theme.color, true))
  const bits: Texture[] = theme.glyphs.map((t) => glyphTexture(t, theme.color, false))
  const fx: Fx[] = []
  let shake = 0
  let flash = 0
  let knock = 0
  let timeScale = 1
  let zoom = 0
  let defeated = props.status === 'won'
  boss.visible = !defeated

  const sprite = (map: Texture, size: number, additive = false) => {
    const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending }))
    s.scale.set(size, size, 1)
    scene.add(s)
    return s
  }
  const drop = (s: Sprite | Mesh) => {
    scene.remove(s)
    const m = s.material as SpriteMaterial
    if (s instanceof Sprite && m.map && !glyphs.includes(m.map) && !bits.includes(m.map) && m.map !== spark) m.map.dispose()
    m.dispose()
  }

  function burst(at: Vector3, count: number, power: number) {
    for (let i = 0; i < count; i++) {
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

  const spark = glyphTexture('', THEMES[props.topic].color, true)
  /** A short glowing tail behind a flying symbol. */
  function trail(at: Vector3, size: number) {
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

  function floatLabel(text: string, at: Vector3, color?: string) {
    const s = sprite(labelTexture(text, color), 1)
    s.scale.set(4.8, 1.2, 1)
    s.position.copy(at)
    let life = 1.4
    fx.push({ update(dt) {
      life -= dt
      s.position.y += dt * 1.2
      s.material.opacity = Math.min(1, life)
      if (life <= 0) { drop(s); return false }
      return true
    } })
  }

  /** One hit: a glowing symbol flies from a hero to the boss in an arc. */
  function shoot(name: string, delay: number, final: boolean) {
    let wait = delay
    let t = 0
    const from = heroes[Math.floor(Math.random() * heroes.length)].position.clone().add(new Vector3(0, 0.4, 0))
    const to = bossGroup.position.clone().add(new Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.3) * 1.2, 0.3))
    let orb: Sprite | null = null
    const duration = final ? 1.1 : 0.55
    fx.push({ update(dt) {
      if (wait > 0) { wait -= dt; return true }
      if (!orb) {
        orb = sprite(glyphs[Math.floor(Math.random() * glyphs.length)], final ? 2.8 : 1.9, true)
        heroes.forEach((h) => { if (h.position.distanceTo(from) < 1) h.position.y += 0.25 })
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
      if (final) shatter()
      return false
    } })
  }

  /** The boss breaks into pieces of its own drawing. */
  function shatter() {
    defeated = true
    boss.visible = false
    const n = 6
    for (let i = 0; i < n * n; i++) {
      const x = i % n
      const y = Math.floor(i / n)
      const geo = new PlaneGeometry(4.4 / n, 4.4 / n)
      const uv = geo.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + uv.getX(k)) / n, (y + uv.getY(k)) / n)
      const piece = new Mesh(geo, new MeshBasicMaterial({ map: bossMap, alphaTest: 0.5, side: DoubleSide, transparent: true }))
      piece.position.set(bossGroup.position.x + (x + 0.5 - n / 2) * (4.4 / n), bossGroup.position.y + (y + 0.5 - n / 2) * (4.4 / n), 0)
      piece.quaternion.copy(boss.getWorldQuaternion(piece.quaternion))
      scene.add(piece)
      const v = new Vector3(piece.position.x * 1.4, 2 + Math.random() * 4, 1 + Math.random() * 3)
      const spin = new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      let life = 3.2
      fx.push({ update(dt) {
        life -= dt
        v.y -= 7 * dt
        piece.position.addScaledVector(v, dt)
        if (piece.position.y < 0.75) { piece.position.y = 0.75; v.y *= -0.3; v.x *= 0.7; v.z *= 0.7 }
        piece.rotation.x += spin.x * dt
        piece.rotation.y += spin.y * dt
        ;(piece.material as MeshBasicMaterial).opacity = Math.min(1, life)
        if (life <= 0) { scene.remove(piece); geo.dispose(); (piece.material as MeshBasicMaterial).dispose(); return false }
        return true
      } })
    }
    for (let i = 0; i < 40; i++) {
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
  const target = new Vector3()
  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    if (document.hidden) { last = now; return }
    const real = Math.min(0.05, (now - last) / 1000)
    last = now
    const dt = real * timeScale
    elapsed += dt
    if (timeScale < 1) timeScale = Math.min(1, timeScale + real * 0.25)

    // A slow orbit around the boss, closer during the final blow.
    zoom += ((timeScale < 1 || flash > 0.5 && defeated ? 1 : 0) - zoom) * Math.min(1, real * 2)
    const angle = Math.sin(elapsed * 0.18) * 0.5
    const radius = 13 - zoom * 2.5
    camera.position.set(Math.sin(angle) * radius * (1 - zoom * 0.5), 5.2 + zoom * 0.6, Math.cos(angle) * radius)
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
      shake = Math.max(0, shake - real * 1.5)
    }
    camera.lookAt(target.set(0, 2.4 + zoom * 0.6, 0))

    // Idle life: the boss breathes and hovers, heroes bob, runes turn; cut-outs face the camera.
    bossGroup.position.y = 2.85 + Math.sin(elapsed * 1.6) * 0.12
    bossGroup.position.z = -knock
    knock = Math.max(0, knock - dt * 2)
    boss.scale.set(1 + Math.sin(elapsed * 2.4) * 0.03, 1 - Math.sin(elapsed * 2.4) * 0.03, 1)
    boss.quaternion.copy(camera.quaternion)
    const mat = boss.material as MeshStandardMaterial
    mat.emissive.set('#ffffff')
    mat.emissiveIntensity = flash * 0.9
    flash = Math.max(0, flash - dt * 4)
    glow.intensity = 30 + Math.sin(elapsed * 3) * 8 + (defeated ? 0 : flash * 60)
    heroes.forEach((h, i) => {
      h.position.y += (1.45 + Math.sin(elapsed * 2 + i) * 0.08 - h.position.y) * Math.min(1, dt * 6)
      h.quaternion.copy(camera.quaternion)
    })
    runes.rotation.z += dt * 0.6
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
    win(name: string, finalLabel: string) {
      if (defeated) return
      timeScale = 0.25
      floatLabel(finalLabel, new Vector3(0, 5.3, 1.5), '#ffffff')
      shoot(name, 0, true)
    },
    replay(name: string, finalLabel: string) {
      defeated = false
      boss.visible = true
      this.win(name, finalLabel)
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scene.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        for (const mm of mats) { (mm as MeshStandardMaterial).map?.dispose(); mm.dispose() }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export default function BattleArena3D(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const arena = useRef<ReturnType<typeof createArena> | null>(null)
  const seen = useRef(props.hits)
  const status = useRef(props.status)
  const [won, setWon] = useState(props.status === 'won')
  const [replaying, setReplaying] = useState(false)
  const c = COPY[props.lang]

  useEffect(() => {
    if (!host.current) return
    const made = createArena(host.current, props)
    arena.current = made
    return () => { made.dispose(); arena.current = null }
    // The scene is built once per boss and topic; hits and status arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kind, props.topic])

  useEffect(() => {
    const fresh = props.hits - seen.current
    seen.current = props.hits
    const finishing = props.status === 'won' && status.current === 'active'
    status.current = props.status
    if (finishing) {
      if (fresh > 1) arena.current?.hit(props.recent.slice(1, fresh))
      arena.current?.win(props.recent[0] ?? '', c.final)
      setWon(true)
    } else if (fresh > 0 && props.status === 'active') {
      arena.current?.hit(props.recent.slice(0, fresh).length ? props.recent.slice(0, fresh) : Array(fresh).fill(''))
    }
  }, [props.hits, props.status, props.recent, c.final])

  return (
    <div className="relative h-[46vh] min-h-72 w-full overflow-hidden">
      <div ref={host} className="absolute inset-0" aria-hidden="true" />
      {won && (
        <button type="button" disabled={replaying} onClick={() => { arena.current?.replay(props.recent[0] ?? '', c.final); setReplaying(true); setTimeout(() => setReplaying(false), 6000) }}
          className="absolute right-3 bottom-3 rounded-xl border-[3px] border-ink bg-sun px-3 py-1.5 text-sm font-black text-ink shadow-[2px_2px_0_#17233a] hover:bg-white disabled:opacity-50">
          {c.replay}
        </button>
      )}
    </div>
  )
}
