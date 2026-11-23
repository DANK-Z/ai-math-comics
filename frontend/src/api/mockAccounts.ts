import { authToken } from './authToken'
import { PROGRESS_REWARDS } from '../rewards'
import { ApiError } from './errors'
import type { AccountApi, ClassInfo, Dashboard, Grade, Me, Shop, SkinKey } from './types'
import { BATTLE_HP, boardOf, checkMockAnswer, demoLeaderboard, latestBattle, MOCK_BATTLE_COPY, settle, shortName, studentView, type MockBattle } from './mockClassroom'

// In-browser stand-in for the accounts API (demo mode, no backend): accounts and classes live
// in localStorage, passwords are not secured, and a class dashboard shows fixed demo statistics.
// Same validation and error codes as backend/app/accounts.py.

interface MockUser {
  id: number
  role: 'student' | 'teacher'
  login?: string
  email?: string
  displayName: string
  password: string
  classId?: number
  completedChapters: string[]
  stickers: string[]
  /** Demo coins: the mock has no server-side boss rewards. */
  coins?: number
  /** Progress rewards already paid (like the server's progress_rewards table). */
  rewards?: string[]
  skins?: { id: number; key: SkinKey; equipped: boolean }[]
}
interface MockState {
  users: MockUser[]
  classes: (ClassInfo & { teacherId: number })[]
  battles?: MockBattle[]
}

const KEY = 'amc.mock.accounts'
const LATENCY_MS = 250
const LOGIN = /^[a-z0-9_.-]{3,24}$/
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,185}\.[a-z]{2,24}$/
const LETTERS: Record<string, string> = Object.fromEntries(
  [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЭЮЯӘҒҚҢӨҰҮІ'].map((ch, i) => [ch, 'ABVGDEJZIIKLMNOPRSTUFHCCSEUYAGQNOUUI'[i]]),
)

function load(): MockState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MockState | null
    if (saved && Array.isArray(saved.users) && Array.isArray(saved.classes)) return saved
  } catch {
    /* start fresh */
  }
  return { users: [], classes: [] }
}

function save(state: MockState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* demo only */
  }
}

function later<T>(value: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(value())
      } catch (e) {
        reject(e)
      }
    }, LATENCY_MS),
  )
}

const fail = (status: number, detail: string) => new ApiError(status, String(status), { detail })
const loginWindows = new Map<string, { expires: number; attempts: number }>()

function countLogin(name: string) {
  const now = Math.floor(Date.now() / 1000)
  for (const [key, window] of loginWindows) if (window.expires <= now) loginWindows.delete(key)
  for (const { key, duration, limit } of [{ key: 'browser', duration: 60, limit: 60 }, { key: `login:${name}`, duration: 300, limit: 8 }]) {
    const window = loginWindows.get(key) ?? { expires: (Math.floor(now / duration) + 1) * duration, attempts: 0 }
    if (window.attempts >= limit) throw fail(429, 'sign_in_rate_limited')
    loginWindows.set(key, { ...window, attempts: window.attempts + 1 })
  }
}

const DEMO_COINS = 120
const PRICES: Record<SkinKey, number> = { 'smart-glasses': 40, 'yellow-backpack': 50, 'racer-helmet': 60 }

function shopOf(user: MockUser): Shop {
  const skins = user.skins ?? []
  const equipped = skins.find((s) => s.equipped)?.key ?? null
  return {
    coins: user.coins ?? DEMO_COINS,
    equippedSkin: equipped,
    items: (Object.keys(PRICES) as SkinKey[]).map((key) => {
      const owned = skins.find((s) => s.key === key)
      return { id: key, type: 'skin', price: PRICES[key], owned: !!owned, equipped: key === equipped, backpackItemId: owned?.id ?? null }
    }),
  }
}

function student(state: MockState) {
  const user = currentUser(state)
  if (user.role !== 'student') throw fail(403, 'students_only')
  return user
}

function currentUser(state: MockState): MockUser {
  const id = Number(authToken.get()?.replace(/^mock-/, ''))
  const user = state.users.find((u) => u.id === id)
  if (!user) throw fail(401, 'not_authenticated')
  return user
}

function toMe(state: MockState, user: MockUser): Me {
  const schoolClass = state.classes.find((c) => c.id === user.classId)
  const teacher = schoolClass && state.users.find((u) => u.id === schoolClass.teacherId)
  return {
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    ...(user.login ? { login: user.login } : {}),
    ...(user.email ? { email: user.email } : {}),
    ...(user.role === 'student'
      ? {
          schoolClass: schoolClass ? { id: schoolClass.id, name: schoolClass.name, grade: schoolClass.grade, code: schoolClass.code, teacherName: teacher?.displayName } : undefined,
          profile: {
            coins: user.coins ?? DEMO_COINS,
            stars: 0,
            completedChapters: user.completedChapters,
            stickers: user.stickers,
            items: (user.skins ?? []).map((s) => ({ id: s.id, type: 'skin', key: s.key, equipped: s.equipped })),
          },
        }
      : {}),
  }
}

function signIn(state: MockState, user: MockUser) {
  return { token: `mock-${user.id}`, user: toMe(state, user) }
}

function cleanName(name: string) {
  const value = name.split(/\s+/).filter(Boolean).join(' ')
  if (!value || value.length > 60 || /[0-9_<>@]/.test(value)) throw fail(422, 'displayName')
  return value
}

function findClass(state: MockState, code: string) {
  const found = state.classes.find((c) => c.code === code.trim().toUpperCase())
  if (!found) throw fail(404, 'class_not_found')
  return found
}

// Fixed demo statistics for a class dashboard (clearly labelled as demo data in the UI).
function demoDashboard(schoolClass: ClassInfo, students: number): Dashboard {
  const rows = [
    ['Аружан', 'aruzhan', 9, 120, 3, 0, 9],
    ['Нурсултан', 'nursultan', 8, 110, 3, 1, 7],
    ['Алихан', 'alikhan', 6, 90, 3, 4, 4],
    ['Дана', 'dana', 4, 60, 2, 5, 3],
    ['Ерасыл', 'yerassyl', 1, 20, 1, 7, 1],
  ] as const
  return {
    schoolClass: { ...schoolClass, students: Math.max(students, rows.length) },
    students: rows.map(([displayName, login, stars, coins, bossesBeaten, misses, bestCombo], i) => ({
      id: 1000 + i,
      displayName,
      login,
      stars,
      coins,
      bossesBeaten,
      misses,
      bestCombo,
      topics: {
        equations: { beaten: Math.min(bossesBeaten, 2), bestStars: Math.min(3, Math.ceil(stars / 3)), stars: Math.ceil(stars * 0.6) },
        ...(bossesBeaten > 2 ? { fractions: { beaten: 1, bestStars: 3, stars: Math.floor(stars * 0.4) } } : {}),
      },
    })),
    heatmap: [
      { topic: 'equations', round: 1, skill: 'add', students: 5, studentsWithMistakes: 1, mistakeRate: 0.2, invalidAnswers: 1, commonWrong: ['икс'] },
      { topic: 'equations', round: 2, skill: 'div', students: 4, studentsWithMistakes: 3, mistakeRate: 0.75, invalidAnswers: 0, commonWrong: ['7', '112'] },
      { topic: 'equations', round: 3, skill: 'mul_add', students: 4, studentsWithMistakes: 2, mistakeRate: 0.5, invalidAnswers: 1, commonWrong: ['9'] },
      { topic: 'fractions', round: 1, skill: 'whole', students: 3, studentsWithMistakes: 0, mistakeRate: 0, invalidAnswers: 0, commonWrong: [] },
      { topic: 'fractions', round: 2, skill: 'part', students: 3, studentsWithMistakes: 1, mistakeRate: 0.33, invalidAnswers: 0, commonWrong: ['1/4'] },
      { topic: 'fractions', round: 3, skill: 'sum', students: 3, studentsWithMistakes: 1, mistakeRate: 0.33, invalidAnswers: 1, commonWrong: ['0.5'] },
    ],
    recommendation: { topic: 'equations', round: 2, skill: 'div', mistakeRate: 0.75 },
  }
}

export const mockAccounts: AccountApi = {
  signUpStudent(body) {
    return later(() => {
      const state = load()
      const login = body.login.trim().toLowerCase()
      if (!LOGIN.test(login) || body.password.length < 8) throw fail(422, 'validation')
      const displayName = cleanName(body.displayName)
      const schoolClass = body.classCode?.trim() ? findClass(state, body.classCode) : undefined
      if (state.users.some((u) => u.login === login)) throw fail(409, 'login_taken')
      const user: MockUser = { id: state.users.length + 1, role: 'student', login, displayName, password: body.password, classId: schoolClass?.id, completedChapters: [], stickers: [] }
      state.users.push(user)
      save(state)
      return signIn(state, user)
    })
  },
  signUpTeacher(body) {
    return later(() => {
      const state = load()
      const email = body.email.trim().toLowerCase()
      if (!EMAIL.test(email) || body.password.length < 8) throw fail(422, 'validation')
      const displayName = cleanName(body.displayName)
      if (state.users.some((u) => u.email === email)) throw fail(409, 'email_taken')
      const user: MockUser = { id: state.users.length + 1, role: 'teacher', email, displayName, password: body.password, completedChapters: [], stickers: [] }
      state.users.push(user)
      save(state)
      return signIn(state, user)
    })
  },
  logIn(body) {
    return later(() => {
      const state = load()
      const name = body.login.trim().toLowerCase()
      countLogin(name)
      const user = state.users.find((u) => (name.includes('@') ? u.email : u.login) === name)
      if (!user || user.password !== body.password) throw fail(401, 'wrong_login_or_password')
      return signIn(state, user)
    })
  },
  me() {
    return later(() => {
      const state = load()
      return toMe(state, currentUser(state))
    })
  },
  joinClass(code) {
    return later(() => {
      const state = load()
      const user = currentUser(state)
      if (user.role !== 'student') throw fail(403, 'students_only')
      user.classId = findClass(state, code).id
      save(state)
      return toMe(state, user)
    })
  },
  saveProgress(body) {
    return later(() => {
      const state = load()
      const user = currentUser(state)
      user.completedChapters = [...new Set([...user.completedChapters, ...body.completedChapters])].sort()
      // One-time coins for operation progress, as on the server.
      const paid = new Set(user.rewards ?? [])
      for (const id of new Set(body.completedChapters)) {
        const coins = PROGRESS_REWARDS[id]
        if (!coins || paid.has(id)) continue
        paid.add(id)
        user.coins = (user.coins ?? DEMO_COINS) + coins
      }
      user.rewards = [...paid].sort()
      user.stickers = [...new Set([...user.stickers, ...body.stickers])].sort()
      save(state)
      return toMe(state, user)
    })
  },
  bossState() {
    // The mock server keeps no answer log; the reader falls back to this browser's progress.
    return later(() => null)
  },
  createClass(body: { grade: Grade; letter: string; school: string }) {
    return later(() => {
      const state = load()
      const user = currentUser(state)
      if (user.role !== 'teacher') throw fail(403, 'teachers_only')
      const letter = body.letter.trim().toUpperCase()
      const school = (body.school.trim().toUpperCase() || 'AMC').replace(/[^A-Z]/g, '').slice(0, 8) || 'AMC'
      const base = `${school}-${body.grade}${LETTERS[letter] ?? letter}-${new Date().getFullYear()}`
      let code = base
      for (let n = 2; state.classes.some((c) => c.code === code); n++) code = `${base}-${n}`
      const schoolClass = { id: state.classes.length + 1, teacherId: user.id, name: `${body.grade} «${letter}»`, grade: body.grade, code, students: 0 }
      state.classes.push(schoolClass)
      save(state)
      return schoolClass
    })
  },
  listClasses() {
    return later(() => {
      const state = load()
      const user = currentUser(state)
      return state.classes
        .filter((c) => c.teacherId === user.id)
        .map((c) => ({ ...c, students: state.users.filter((u) => u.classId === c.id).length }))
    })
  },
  shop() {
    return later(() => shopOf(student(load())))
  },
  buy(itemId) {
    return later(() => {
      const state = load()
      const user = student(state)
      const price = PRICES[itemId]
      if (!price) throw fail(404, 'item_not_found')
      const skins = (user.skins ??= [])
      if (skins.some((s) => s.key === itemId)) throw fail(409, 'already_owned')
      const coins = user.coins ?? DEMO_COINS
      if (coins < price) throw fail(409, 'not_enough_coins')
      user.coins = coins - price
      skins.push({ id: Date.now(), key: itemId, equipped: false })
      save(state)
      return shopOf(user)
    })
  },
  equip(backpackItemId) {
    return later(() => {
      const state = load()
      const user = student(state)
      const skins = user.skins ?? []
      if (backpackItemId !== null && !skins.some((s) => s.id === backpackItemId)) throw fail(404, 'item_not_found')
      for (const s of skins) s.equipped = s.id === backpackItemId
      save(state)
      return shopOf(user)
    })
  },
  dashboard(classId) {
    return later(() => {
      const state = load()
      const user = currentUser(state)
      const schoolClass = state.classes.find((c) => c.id === classId && c.teacherId === user.id)
      if (!schoolClass) throw fail(404, 'class_not_found')
      return demoDashboard(schoolClass, state.users.filter((u) => u.classId === classId).length)
    })
  },
  leaderboard() {
    return later(() => {
      const state = load()
      const user = student(state)
      const schoolClass = state.classes.find((c) => c.id === user.classId)
      if (!schoolClass) throw fail(404, 'no_class')
      return demoLeaderboard(state.users.filter((u) => u.role === 'student'), schoolClass, user.id)
    })
  },
  classLeaderboard(classId) {
    return later(() => {
      const state = load()
      const schoolClass = ownClass(state, classId)
      return demoLeaderboard(state.users.filter((u) => u.role === 'student'), schoolClass, null)
    })
  },
  startBattle(classId, body) {
    return later(() => {
      const state = load()
      const schoolClass = ownClass(state, classId)
      if (!BATTLE_HP.includes(body.hp)) throw fail(422, 'hp_not_allowed')
      const battles = (state.battles ??= [])
      for (const b of battles) if (b.classId === classId && b.status === 'active') Object.assign(b, { status: 'stopped', finishedAt: Date.now() })
      const battle: MockBattle = { id: `battle-${Date.now()}`, classId, topic: body.topic, difficulty: body.difficulty, maxHp: body.hp, status: 'active', startedAt: Date.now(), hits: [], tasks: {} }
      battles.push(battle)
      save(state)
      return boardOf(schoolClass, battle)
    })
  },
  currentClassBattle(classId) {
    return later(() => {
      const state = load()
      const schoolClass = ownClass(state, classId)
      const battle = latestBattle(state.battles ?? [], classId)
      save(state)
      return battle ? boardOf(schoolClass, battle) : null
    })
  },
  battleBoard(battleId) {
    return later(() => {
      const state = load()
      const { battle, schoolClass } = teacherBattle(state, battleId)
      const board = boardOf(schoolClass, battle)
      save(state)
      return board
    })
  },
  stopBattle(battleId) {
    return later(() => {
      const state = load()
      const { battle, schoolClass } = teacherBattle(state, battleId)
      settle(battle)
      if (battle.status === 'active') Object.assign(battle, { status: 'stopped', finishedAt: Date.now() })
      save(state)
      return boardOf(schoolClass, battle)
    })
  },
  myBattle(lang) {
    return later(() => {
      const state = load()
      const user = student(state)
      if (!state.classes.some((c) => c.id === user.classId)) throw fail(404, 'no_class')
      const battle = latestBattle(state.battles ?? [], user.classId!)
      if (!battle) return null
      const view = studentView(battle, user.id, lang)
      save(state)
      return view
    })
  },
  answerBattle(battleId, body) {
    return later(() => {
      const state = load()
      const user = student(state)
      const battle = state.battles?.find((b) => b.id === battleId && b.classId === user.classId)
      if (!battle) throw fail(404, 'battle_not_found')
      settle(battle)
      const task = battle.tasks[user.id]
      if (!task || task.id !== body.taskId) throw fail(404, 'task_not_found')
      if (battle.status !== 'active') return { status: 'invalid' as const, message: '', damage: 0, battle: studentView(battle, user.id, body.lang) }
      const copy = MOCK_BATTLE_COPY[body.lang]
      const status = checkMockAnswer(body.answer, task.answer)
      let message: string = copy[status]
      let damage = 0
      if (status === 'correct') {
        damage = 10
        battle.hits.push({ userId: user.id, name: shortName(user.displayName), at: Date.now() })
        delete battle.tasks[user.id]
      } else if (status === 'incorrect' && ++task.misses >= 3) {
        delete battle.tasks[user.id]
        message = copy.swap
      }
      const view = studentView(battle, user.id, body.lang)
      save(state)
      return { status, message, damage, battle: view }
    })
  },
}

function ownClass(state: MockState, classId: number) {
  const user = currentUser(state)
  const schoolClass = state.classes.find((c) => c.id === classId && c.teacherId === user.id)
  if (!schoolClass) throw fail(404, 'class_not_found')
  return schoolClass
}

function teacherBattle(state: MockState, battleId: string) {
  const battle = state.battles?.find((b) => b.id === battleId)
  if (!battle) throw fail(404, 'battle_not_found')
  return { battle, schoolClass: ownClass(state, battle.classId) }
}
