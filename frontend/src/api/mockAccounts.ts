import { authToken } from './authToken'
import { PROGRESS_REWARDS } from '../rewards'
import { ApiError } from './errors'
import { COSMETICS, isCosmetic, type CosmeticKey } from '../cosmetics'
import type { AccountApi, BattleTopic, ChildSummary, ClassInfo, DailyTask, Dashboard, Grade, Lang, Me, PracticeReport, Shop, SkinKey, Billing, CardKind, CoinPack } from './types'
import { mockPracticeAnswer, mockPracticeTask, mockPracticeTopic, mockProblem } from './mockClassroom'
import { currentLesson, demoCard, demoReview, demoSummary, homeworkOf, lessonBoardOf, lessonReportsOf, myHomeworkOf, openAnswering, quizRanking, saveAnswer, setPhase, settleLesson, stepAnswer, studentLessonOf, wholeAnswer, type MockHomework, type MockLesson, type PracticeDone } from './mockLessons'
import { DEMO_LOBBY } from './mockClassroom'
import { BATTLE_HP, boardOf, checkMockAnswer, demoLeaderboard, latestBattle, MOCK_BATTLE_COPY, settle, shortName, studentView, type MockBattle } from './mockClassroom'

// In-browser stand-in for the accounts API (demo mode, no backend): accounts and classes live
// in localStorage, passwords are not secured, and a class dashboard shows fixed demo statistics.
// Same validation and error codes as backend/app/accounts.py.

interface MockUser {
  id: number
  role: 'student' | 'teacher' | 'parent'
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
  /** Backpack items: skins, and (with `type`) frames and titles. */
  skins?: { id: number; key: string; equipped: boolean; type?: 'skin' | 'frame' | 'title' | 'helper' }[]
  /** Stars from the podiums of lesson mini-quizzes (the class league). */
  lessonStars?: number
  /** The demo daily task: today's problem and the days solved (a streak of two to start). */
  daily?: { day: string; taskId: string; topic: BattleTopic; prompt: Record<Lang, string>; answer: string; solved: boolean }
  dailyDays?: string[]
}
interface MockState {
  users: MockUser[]
  classes: (ClassInfo & { teacherId: number })[]
  battles?: MockBattle[]
  lessons?: MockLesson[]
  homework?: MockHomework[]
  practiceDone?: PracticeDone[]
  /** Board lobbies: when each student last looked at a battle or lesson. */
  presence?: Record<string, Record<number, number>>
  familyCodes?: Record<number, string>
  familyLinks?: { parentId: number; studentId: number }[]
  praises?: { id: number; parentId: number; studentId: number; kind: CardKind; coins: number; at: number; seen: boolean }[]
  plans?: Record<number, number>
  payments?: { id: number; parentId: number; childId: number | null; product: string; amount: number; coins: number; at: number }[]
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
const PRICES: Record<SkinKey, number> = { 'smart-glasses': 40, 'yellow-backpack': 50, 'racer-helmet': 60, 'chef-hat': 55, 'space-helmet': 70, kalpak: 75 }

const slotOf = (item: { type?: 'skin' | 'frame' | 'title' | 'helper' }) => item.type ?? 'skin'

function shopOf(user: MockUser): Shop {
  const skins = user.skins ?? []
  const equipped = (skins.find((s) => s.equipped && slotOf(s) === 'skin')?.key as SkinKey | undefined) ?? null
  return {
    coins: user.coins ?? DEMO_COINS,
    equippedSkin: equipped,
    items: (Object.keys(PRICES) as SkinKey[]).map((key) => {
      const owned = skins.find((s) => s.key === key)
      return { id: key, type: 'skin', price: PRICES[key], owned: !!owned, equipped: key === equipped, backpackItemId: owned?.id ?? null }
    }),
    cosmetics: (Object.keys(COSMETICS) as CosmeticKey[]).map((key) => {
      const owned = skins.find((s) => s.key === key)
      return { id: key, type: COSMETICS[key].slot, price: COSMETICS[key].price, owned: !!owned, equipped: !!owned?.equipped, backpackItemId: owned?.id ?? null }
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
            items: (user.skins ?? []).map((s) => ({ id: s.id, type: slotOf(s), key: s.key, equipped: s.equipped })),
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
  checkChapter() {
    // Demo mode checks bundled chapters in the browser and pays coins from saveProgress.
    return Promise.reject(fail(404, 'exercise_not_found'))
  },
  quickJoin(body) {
    return later(() => {
      const state = load()
      const displayName = cleanName(body.displayName)
      if (body.deviceKey.length < 24) throw fail(422, 'validation')
      const schoolClass = findClass(state, body.classCode)
      const base = translit(displayName.split(' ')[0]).replace(/[^a-z]/g, '').slice(0, 14) || 'student'
      let login = ''
      do login = `${base}${100 + Math.floor(Math.random() * 900)}`
      while (state.users.some((u) => u.login === login))
      const user: MockUser = { id: state.users.length + 1, role: 'student', login, displayName, password: body.deviceKey, classId: schoolClass?.id, completedChapters: [], stickers: [] }
      state.users.push(user)
      save(state)
      return signIn(state, user)
    })
  },
  signUpParent(body) {
    return later(() => {
      const state = load()
      const email = body.email.trim().toLowerCase()
      if (!EMAIL.test(email) || body.password.length < 8) throw fail(422, 'validation')
      const displayName = cleanName(body.displayName)
      if (state.users.some((u) => u.email === email)) throw fail(409, 'email_taken')
      const user: MockUser = { id: state.users.length + 1, role: 'parent', email, displayName, password: body.password, completedChapters: [], stickers: [] }
      state.users.push(user)
      save(state)
      return signIn(state, user)
    })
  },
  familyCode() {
    return later(() => {
      const state = load()
      const user = student(state)
      const codes = (state.familyCodes ??= {})
      codes[user.id] ??= `AMC-${Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, 'X')}`
      save(state)
      return { code: codes[user.id], parents: (state.familyLinks ?? []).filter((l) => l.studentId === user.id).length }
    })
  },
  parentChildren() {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      return (state.familyLinks ?? []).filter((l) => l.parentId === user.id).map((l) => childSummary(state, user.id, l.studentId))
    })
  },
  addChild(code) {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      const entry = Object.entries(state.familyCodes ?? {}).find(([, c]) => c === code.trim().toUpperCase())
      if (!entry) throw fail(404, 'family_code_not_found')
      const studentId = Number(entry[0])
      const links = (state.familyLinks ??= [])
      if (!links.some((l) => l.parentId === user.id && l.studentId === studentId)) links.push({ parentId: user.id, studentId })
      save(state)
      return childSummary(state, user.id, studentId)
    })
  },
  removeChild(studentId) {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      state.familyLinks = (state.familyLinks ?? []).filter((l) => !(l.parentId === user.id && l.studentId === studentId))
      save(state)
    })
  },
  sendPraise(studentId, kind) {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      if (!(state.familyLinks ?? []).some((l) => l.parentId === user.id && l.studentId === studentId)) throw fail(404, 'child_not_found')
      const praises = (state.praises ??= [])
      let coins = 0
      if (kind === 'gift') {
        const last = praises.filter((p) => p.parentId === user.id && p.studentId === studentId && p.kind === 'gift').at(-1)
        if (last && Date.now() - last.at < 7 * 86400_000) throw fail(409, 'gift_too_soon')
        coins = planActive(state, user.id) ? 50 : 20
        const child = state.users.find((u) => u.id === studentId)
        if (child) child.coins = (child.coins ?? DEMO_COINS) + coins
      }
      praises.push({ id: praises.length + 1, parentId: user.id, studentId, kind, coins, at: Date.now(), seen: false })
      save(state)
      return childSummary(state, user.id, studentId)
    })
  },
  billing() {
    return later(() => {
      const state = load()
      return billingOf(state, parentOf(state).id)
    })
  },
  buyPlan() {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      pay(state, user.id, { childId: null, product: 'family', amount: 1990, coins: 0 })
      const plans = (state.plans ??= {})
      plans[user.id] = Math.max(Date.now(), plans[user.id] ?? 0) + 30 * 86400_000
      save(state)
      return billingOf(state, user.id)
    })
  },
  buyCoins(studentId, pack) {
    return later(() => {
      const state = load()
      const user = parentOf(state)
      if (!(state.familyLinks ?? []).some((l) => l.parentId === user.id && l.studentId === studentId)) throw fail(404, 'child_not_found')
      const { coins, price } = PACKS[pack]
      pay(state, user.id, { childId: studentId, product: pack, amount: price, coins })
      const child = state.users.find((u) => u.id === studentId)
      if (child) child.coins = (child.coins ?? DEMO_COINS) + coins
      const praises = (state.praises ??= [])
      praises.push({ id: praises.length + 1, parentId: user.id, studentId, kind: 'coins', coins, at: Date.now(), seen: false })
      save(state)
      return childSummary(state, user.id, studentId)
    })
  },
  myPraise() {
    return later(() => {
      const state = load()
      const user = student(state)
      return (state.praises ?? []).filter((p) => p.studentId === user.id && !p.seen).reverse().slice(0, 5).map((p) => ({
        id: p.id, kind: p.kind, coins: p.coins, at: new Date(p.at).toISOString(),
        fromName: state.users.find((u) => u.id === p.parentId)?.displayName ?? '',
      }))
    })
  },
  praiseSeen() {
    return later(() => {
      const state = load()
      const user = student(state)
      for (const p of state.praises ?? []) if (p.studentId === user.id) p.seen = true
      save(state)
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
      const price = isCosmetic(itemId) ? COSMETICS[itemId].price : PRICES[itemId as SkinKey]
      if (!price) throw fail(404, 'item_not_found')
      const skins = (user.skins ??= [])
      if (skins.some((s) => s.key === itemId)) throw fail(409, 'already_owned')
      const coins = user.coins ?? DEMO_COINS
      if (coins < price) throw fail(409, 'not_enough_coins')
      user.coins = coins - price
      skins.push({ id: Date.now(), key: itemId, equipped: false, type: isCosmetic(itemId) ? COSMETICS[itemId].slot : 'skin' })
      save(state)
      return shopOf(user)
    })
  },
  equip(backpackItemId, slot = 'skin') {
    return later(() => {
      const state = load()
      const user = student(state)
      const skins = user.skins ?? []
      const chosen = backpackItemId === null ? null : skins.find((s) => s.id === backpackItemId)
      if (chosen === undefined) throw fail(404, 'item_not_found')
      const worn = chosen ? slotOf(chosen) : slot
      for (const s of skins) if (slotOf(s) === worn) s.equipped = s === chosen
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
      return boardOf(schoolClass, battle, lobby(state, battle.id, schoolClass.id))
    })
  },
  currentClassBattle(classId) {
    return later(() => {
      const state = load()
      const schoolClass = ownClass(state, classId)
      const battle = latestBattle(state.battles ?? [], classId)
      save(state)
      return battle ? boardOf(schoolClass, battle, lobby(state, battle.id, schoolClass.id)) : null
    })
  },
  battleBoard(battleId) {
    return later(() => {
      const state = load()
      const { battle, schoolClass } = teacherBattle(state, battleId)
      const board = boardOf(schoolClass, battle, lobby(state, battle.id, schoolClass.id))
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
      return boardOf(schoolClass, battle, lobby(state, battle.id, schoolClass.id))
    })
  },
  myBattle(lang) {
    return later(() => {
      const state = load()
      const user = student(state)
      if (!state.classes.some((c) => c.id === user.classId)) throw fail(404, 'no_class')
      const battle = latestBattle(state.battles ?? [], user.classId!)
      if (!battle) return null
      touch(state, battle.id, user.id)
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
  startPractice(body) {
    return later(() => {
      student(load())
      return mockPracticeTask(body.topic, 1, body.lang)
    })
  },
  answerPractice(body) {
    return later(() => {
      const state = load()
      const user = student(state)
      const topic = mockPracticeTopic(body.taskId)
      const result = mockPracticeAnswer(body.taskId, body.answer, body.lang)
      if (!result) throw fail(404, 'task_not_found')
      // A finished drill counts for homework on that topic.
      if (topic && result.status === 'correct' && !result.next) {
        ;(state.practiceDone ??= []).push({ userId: user.id, topic, at: Date.now() })
        save(state)
      }
      return result
    })
  },
  createStudents(classId, names) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const made = names.map((raw) => {
        const displayName = raw.trim().replace(/\s+/g, ' ')
        if (!displayName || /[0-9_]/.test(displayName)) throw fail(422, 'invalid_name')
        const base = translit(displayName.split(' ')[0]).replace(/[^a-z]/g, '').slice(0, 14) || 'student'
        let login = ''
        do login = `${base}${100 + Math.floor(Math.random() * 900)}`
        while (state.users.some((u) => u.login === login))
        const password = easyPassword()
        const user: MockUser = { id: state.users.length + 1, role: 'student', login, displayName, password, classId, completedChapters: [], stickers: [] }
        state.users.push(user)
        return { id: user.id, displayName, login, password }
      })
      save(state)
      return made
    })
  },
  resetStudentPassword(classId, studentId) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const user = state.users.find((u) => u.id === studentId && u.role === 'student' && u.classId === classId)
      // Demo dashboard rows are not real accounts: show what a reset looks like.
      if (!user) return { id: studentId, displayName: 'Демо-ученик', login: `demo${studentId}`, password: easyPassword() }
      user.password = easyPassword()
      save(state)
      return { id: user.id, displayName: user.displayName, login: user.login ?? '', password: user.password }
    })
  },
  removeStudent(classId, studentId) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const user = state.users.find((u) => u.id === studentId && u.role === 'student' && u.classId === classId)
      if (user) user.classId = undefined
      save(state)
    })
  },
  practiceReport(classId) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      // Demo: the drills of this browser are not logged; real classmates show zero, plus two examples.
      const real: PracticeReport['students'] = state.users.filter((u) => u.role === 'student' && u.classId === classId)
        .map((u) => ({ id: u.id, displayName: u.displayName, drills: 0, finished: 0, solved: 0, topics: {}, lastAt: null }))
      const demo: PracticeReport['students'] = [
        { id: -1, displayName: 'Аружан Бекова', drills: 3, finished: 2, solved: 13, topics: { equations: 8, gcd: 5 }, lastAt: new Date(Date.now() - 3600_000).toISOString() },
        { id: -2, displayName: 'Тимур Ахметов', drills: 1, finished: 0, solved: 3, topics: { fractions: 3 }, lastAt: new Date(Date.now() - 86400_000).toISOString() },
      ]
      const students: PracticeReport['students'] = [...demo, ...real]
      return { days: 30, students }
    })
  },
  daily(lang) {
    return later(() => {
      const state = load()
      const user = student(state)
      const view = dailyOf(user, lang)
      save(state)
      return view
    })
  },
  answerDaily(body) {
    return later(() => {
      const state = load()
      const user = student(state)
      const task = user.daily
      if (!task || task.taskId !== body.taskId || task.day !== almatyDay()) throw fail(404, 'task_not_found')
      if (task.solved) throw fail(409, 'task_solved')
      const status = checkMockAnswer(body.answer, task.answer)
      const copy = MOCK_DAILY_COPY[body.lang]
      if (status !== 'correct') return { status, message: copy[status], coins: 0, bonus: null, daily: dailyOf(user, body.lang) }
      task.solved = true
      user.dailyDays = [...new Set([...(user.dailyDays ?? []), task.day])]
      const streak = streakOf(user)
      const bonus = DAILY_BONUS[streak] ? { days: streak, coins: DAILY_BONUS[streak] } : null
      const coins = DAILY_COINS + (bonus?.coins ?? 0)
      user.coins = (user.coins ?? DEMO_COINS) + coins
      save(state)
      return { status, message: copy.done, coins, bonus, daily: dailyOf(user, body.lang) }
    })
  },
  review() {
    return later(() => {
      const state = load()
      const user = student(state)
      return demoReview(state.lessons ?? [], user.id, user.completedChapters)
    })
  },
  studentCard(classId, studentId, days) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const summary = demoSummary(state.lessons ?? [], classId, roster(state, classId), days)
      const pupil = summary.pupils.find((p) => p.id === studentId)
      if (!pupil) throw fail(404, 'student_not_found')
      const user = state.users.find((u) => u.id === studentId)
      const homework = (state.homework ?? [])
        .filter((h) => h.classId === classId && (!h.studentIds || h.studentIds.includes(studentId)))
        .map((h) => {
          const done = user ? homeworkOf(h, [user], state.practiceDone ?? []).done > 0 : studentId % 2 === 0
          return { id: h.id, kind: h.kind, target: h.target, dueDate: h.dueDate, done, overdue: !done && h.dueDate < new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10) }
        })
      return demoCard(pupil, user?.displayName ?? pupil.name, user?.login ?? null, days, homework)
    })
  },
  classSummary(classId, days) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      return demoSummary(state.lessons ?? [], classId, roster(state, classId), days)
    })
  },
  weakSpot() {
    // Demo mode keeps no answer log: show a typical weak spot so the review card is visible.
    return later(() => {
      student(load())
      return { topic: 'equations' as const, skill: 'mul_add', mistakes: 3 }
    })
  },
  startLesson(classId, body) {
    return later(() => {
      const state = load()
      const schoolClass = ownClass(state, classId)
      const lessons = (state.lessons ??= [])
      for (const l of lessons) if (l.classId === classId) l.phase = 'closed'
      const lesson: MockLesson = { id: `lesson-${Date.now()}`, classId, comicId: body.comicId, answer: body.answer, panel: 0, phase: 'reading', createdAt: Date.now(), answers: {}, rounds: {} }
      lessons.push(lesson)
      save(state)
      return lessonBoardOf(schoolClass, lesson, roster(state, classId), lobby(state, lesson.id, classId))
    })
  },
  lessonBoard(lessonId) {
    return later(() => {
      const state = load()
      const lesson = state.lessons?.find((l) => l.id === lessonId)
      if (!lesson) throw fail(404, 'lesson_not_found')
      const board = lessonBoardOf(ownClass(state, lesson.classId), lesson, roster(state, lesson.classId), lobby(state, lesson.id, lesson.classId))
      save(state)
      return board
    })
  },
  updateLesson(lessonId, body) {
    return later(() => {
      const state = load()
      const lesson = state.lessons?.find((l) => l.id === lessonId)
      if (!lesson) throw fail(404, 'lesson_not_found')
      const schoolClass = ownClass(state, lesson.classId)
      if (body.timer !== undefined) {
        if (![0, 30, 60, 90].includes(body.timer)) throw fail(422, 'invalid_timer')
        lesson.timer = body.timer
        if (lesson.phase === 'answering' && !lesson.step) lesson.deadline = body.timer ? Date.now() + body.timer * 1000 : null
      }
      if (body.panel !== undefined) lesson.panel = body.panel
      if (body.retry) {
        if (lesson.step || (lesson.attempt ?? 1) !== 1 || lesson.phase !== 'reveal') throw fail(409, 'no_retry')
        lesson.attempt = 2
        openAnswering(lesson)
      } else if (body.phase) setPhase(lesson, body.phase)
      const board = lessonBoardOf(schoolClass, lesson, roster(state, lesson.classId), lobby(state, lesson.id, lesson.classId))
      save(state)
      return board
    })
  },
  startQuiz(lessonId, tasks) {
    return later(() => {
      const state = load()
      const lesson = state.lessons?.find((l) => l.id === lessonId)
      if (!lesson) throw fail(404, 'lesson_not_found')
      const schoolClass = ownClass(state, lesson.classId)
      if (tasks.length < 3 || tasks.length > 5) throw fail(422, 'invalid_quiz')
      if (lesson.quiz || lesson.phase === 'closed') throw fail(409, 'quiz_started')
      setPhase(lesson, 'reveal')
      lesson.quiz = tasks
      lesson.step = 1
      openAnswering(lesson)
      const board = lessonBoardOf(schoolClass, lesson, roster(state, lesson.classId), lobby(state, lesson.id, lesson.classId))
      save(state)
      return board
    })
  },
  nextQuestion(lessonId) {
    return later(() => {
      const state = load()
      const lesson = state.lessons?.find((l) => l.id === lessonId)
      if (!lesson) throw fail(404, 'lesson_not_found')
      const schoolClass = ownClass(state, lesson.classId)
      const pupils = roster(state, lesson.classId)
      settleLesson(lesson, pupils.length)
      if (!lesson.quiz || lesson.phase !== 'reveal') throw fail(409, 'not_revealed')
      if ((lesson.step ?? 0) < lesson.quiz.length) {
        lesson.step = (lesson.step ?? 0) + 1
        openAnswering(lesson)
      } else {
        lesson.podium = quizRanking(lesson, new Map(pupils.map((p) => [p.id, p.name])))
        for (const place of lesson.podium) {
          const winner = state.users.find((u) => u.id === place.id)
          if (winner) winner.lessonStars = (winner.lessonStars ?? 0) + place.stars
        }
        lesson.phase = 'podium'
      }
      const board = lessonBoardOf(schoolClass, lesson, pupils, lobby(state, lesson.id, lesson.classId))
      save(state)
      return board
    })
  },
  lessonReports(classId) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      return lessonReportsOf(state.lessons ?? [], classId, roster(state, classId))
    })
  },
  myLesson() {
    return later(() => {
      const state = load()
      const user = student(state)
      if (!state.classes.some((c) => c.id === user.classId)) throw fail(404, 'no_class')
      const lesson = currentLesson(state.lessons ?? [], user.classId!)
      if (!lesson) return null
      touch(state, lesson.id, user.id)
      settleLesson(lesson, roster(state, user.classId!).length)
      save(state)
      return studentLessonOf(lesson, user.id)
    })
  },
  answerLesson(lessonId, answer) {
    return later(() => {
      const state = load()
      const user = student(state)
      const lesson = state.lessons?.find((l) => l.id === lessonId && l.classId === user.classId)
      if (!lesson) throw fail(404, 'lesson_not_found')
      const pupils = roster(state, lesson.classId).length
      settleLesson(lesson, pupils)
      if (lesson.phase !== 'answering') throw fail(409, 'not_answering')
      const value = wholeAnswer(answer)
      if (value === null) throw fail(422, 'invalid_answer')
      saveAnswer(lesson, user.id, answer, value === stepAnswer(lesson))
      settleLesson(lesson, pupils)
      save(state)
      return studentLessonOf(lesson, user.id)
    })
  },
  setHomework(classId, body) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const item: MockHomework = { id: `hw-${Date.now()}`, classId, kind: body.kind, target: body.target, dueDate: body.dueDate, createdAt: Date.now(), studentIds: body.studentIds ?? null }
      ;(state.homework ??= []).push(item)
      save(state)
      return homeworkOf(item, state.users.filter((u) => u.role === 'student'), state.practiceDone ?? [])
    })
  },
  classHomework(classId) {
    return later(() => {
      const state = load()
      ownClass(state, classId)
      const pupils = state.users.filter((u) => u.role === 'student')
      return (state.homework ?? []).filter((h) => h.classId === classId).reverse().map((h) => homeworkOf(h, pupils, state.practiceDone ?? []))
    })
  },
  deleteHomework(homeworkId) {
    return later(() => {
      const state = load()
      const item = state.homework?.find((h) => h.id === homeworkId)
      if (!item) throw fail(404, 'homework_not_found')
      ownClass(state, item.classId)
      state.homework = state.homework!.filter((h) => h.id !== homeworkId)
      save(state)
    })
  },
  myHomework() {
    return later(() => {
      const state = load()
      const user = student(state)
      return (state.homework ?? [])
        .filter((h) => h.classId === user.classId && (!h.studentIds || h.studentIds.includes(user.id)))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((h) => myHomeworkOf(h, user, state.practiceDone ?? []))
    })
  },
}

function touch(state: MockState, boardId: string, userId: number) {
  ;((state.presence ??= {})[boardId] ??= {})[userId] = Date.now()
}

/** Students seen on a board in the last five minutes, plus the demo classmates. */
/** Real students of a class, as the board names them. */
function roster(state: MockState, classId: number) {
  return state.users
    .filter((u) => u.role === 'student' && u.classId === classId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((u) => ({ id: u.id, name: shortName(u.displayName) }))
}

const DAILY_COINS = 5
const DAILY_BONUS: Record<number, number> = { 3: 15, 7: 40, 14: 100 }
const DAILY_TOPICS: BattleTopic[] = ['fractions', 'equations', 'gcd', 'decimals', 'parts']
const MOCK_DAILY_COPY = {
  ru: { done: 'Верно! Задача дня решена.', incorrect: 'Пока неверно. Проверь вычисления и попробуй ещё раз.', invalid: 'Запиши ответ числом или дробью, например 12, 3/4 или 4,2.' },
  kk: { done: 'Дұрыс! Күн есебі шешілді.', incorrect: 'Әзірге дұрыс емес. Есебіңді тексеріп, қайта көр.', invalid: 'Жауапты санмен немесе бөлшекпен жаз, мысалы 12, 3/4 немесе 4,2.' },
}
const almatyDay = (shift = 0) => new Date(Date.now() + 5 * 3600_000 + shift * 86400_000).toISOString().slice(0, 10)

function streakOf(user: MockUser) {
  const days = new Set(user.dailyDays ?? [])
  let shift = days.has(almatyDay()) ? 0 : -1
  let count = 0
  while (days.has(almatyDay(shift))) {
    count += 1
    shift -= 1
  }
  return count
}

/** Today's demo task (a new one each day); a fresh demo account starts with a two-day streak. */
function dailyOf(user: MockUser, lang: Lang): DailyTask {
  const day = almatyDay()
  user.dailyDays ??= [almatyDay(-2), almatyDay(-1)]
  if (user.daily?.day !== day) {
    const topic = DAILY_TOPICS[(Math.floor(Date.now() / 86400_000) + user.id) % DAILY_TOPICS.length]
    const problem = mockProblem(topic)
    user.daily = { day, taskId: `daily-${day}-${user.id}`, topic, prompt: problem.prompt, answer: problem.answer, solved: false }
  }
  const streak = streakOf(user)
  const next = Object.keys(DAILY_BONUS).map(Number).find((d) => d > streak)
  return {
    day,
    taskId: user.daily.taskId,
    topic: user.daily.topic,
    prompt: user.daily.prompt[lang],
    answerFormat: user.daily.topic === 'fractions' ? 'fraction' : user.daily.topic === 'decimals' ? 'decimal' : 'whole-number',
    solved: user.daily.solved,
    streak,
    nextBonus: next ? { days: next, coins: DAILY_BONUS[next] } : null,
    coins: DAILY_COINS,
  }
}

function lobby(state: MockState, boardId: string, classId: number) {
  const seen = state.presence?.[boardId] ?? {}
  const real = state.users
    .filter((u) => u.role === 'student' && u.classId === classId && Date.now() - (seen[u.id] ?? 0) < 300_000)
    .sort((a, b) => seen[a.id] - seen[b.id])
    .map((u) => ({ id: u.id, name: shortName(u.displayName) }))
  return [...DEMO_LOBBY, ...real]
}

function parentOf(state: MockState) {
  const user = currentUser(state)
  if (user.role !== 'parent') throw fail(403, 'parents_only')
  return user
}

/** Demo child summary: real coins and chapters from this browser, plus demo boss stats. */
function childSummary(state: MockState, parentId: number, studentId: number): ChildSummary {
  const child = state.users.find((u) => u.id === studentId)!
  const schoolClass = state.classes.find((c) => c.id === child.classId)
  const chapters = (child.rewards ?? []).filter((k) => !k.startsWith('secret-') && !k.endsWith('-finale'))
  const lastGift = (state.praises ?? []).filter((p) => p.parentId === parentId && p.studentId === studentId && p.kind === 'gift').at(-1)
  const giftReady = lastGift ? lastGift.at + 7 * 86400_000 : 0
  return {
    id: child.id,
    name: child.displayName,
    className: schoolClass?.name ?? null,
    skin: (child.skins?.find((s) => s.equipped && slotOf(s) === 'skin')?.key as SkinKey | undefined) ?? null,
    coins: child.coins ?? DEMO_COINS,
    stars: 6,
    chaptersMonth: chapters.length,
    chaptersTotal: chapters.length,
    bossWins: 3,
    cleanWins: 1,
    strengths: ['add', 'sub'],
    weakSkill: 'div',
    weakMistakes: 3,
    drillsWeek: 1,
    homeworkOpen: (state.homework ?? []).filter((h) => h.classId === child.classId).length,
    homeworkOverdue: 0,
    lastActive: new Date().toISOString(),
    recent: [
      { kind: 'boss', key: 'equations', stars: 3, at: new Date(Date.now() - 3600_000).toISOString() },
      { kind: 'boss', key: 'fractions', stars: 2, at: new Date(Date.now() - 86400_000).toISOString() },
    ],
    giftReadyAt: giftReady > Date.now() ? new Date(giftReady).toISOString() : null,
    giftCoins: planActive(state, parentId) ? 50 : 20,
  }
}

const planActive = (state: MockState, parentId: number) => (state.plans?.[parentId] ?? 0) > Date.now()
const PACKS: Record<CoinPack, { coins: number; price: number }> = { 'coins-100': { coins: 100, price: 490 }, 'coins-300': { coins: 300, price: 1290 }, 'coins-700': { coins: 700, price: 2490 } }

function billingOf(state: MockState, parentId: number): Billing {
  const until = state.plans?.[parentId] ?? 0
  return {
    mode: 'test',
    plan: until > Date.now() ? 'family' : null,
    paidUntil: until > Date.now() ? new Date(until).toISOString() : null,
    plans: [{ id: 'family', price: 1990 }],
    packs: (Object.keys(PACKS) as CoinPack[]).map((id) => ({ id, ...PACKS[id] })),
    history: (state.payments ?? []).filter((p) => p.parentId === parentId).reverse().slice(0, 10)
      .map((p) => ({ id: p.id, product: p.product, amount: p.amount, coins: p.coins, childId: p.childId, status: 'test', at: new Date(p.at).toISOString() })),
  }
}

function pay(state: MockState, parentId: number, payment: { childId: number | null; product: string; amount: number; coins: number }) {
  const payments = (state.payments ??= [])
  if (payments.filter((p) => p.parentId === parentId && Date.now() - p.at < 86400_000).length >= 5) throw fail(429, 'payments_limit')
  payments.push({ id: payments.length + 1, parentId, at: Date.now(), ...payment })
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
}
const translit = (name: string) => [...name.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join('')
const easyPassword = () => `${['kit', 'sun', 'star', 'book', 'fox', 'tree', 'sky', 'moon'][Math.floor(Math.random() * 8)]}-${1000 + Math.floor(Math.random() * 9000)}`

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
