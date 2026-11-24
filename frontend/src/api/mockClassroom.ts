import { PROGRESS_REWARDS } from '../rewards'
import type { AnswerFormat, BattleBoard, LobbyStudent, BattleDifficulty, BattleTopic, ClassInfo, Lang, Leaderboard, LeaderRow, StudentBattle } from './types'

// Classroom demo (no backend): a weekly table with demo classmates, and class battles in
// localStorage where demo classmates keep hitting the boss so the board feels alive.
// Same rules as backend/app/classroom.py: 10 damage per correct answer, a new problem after
// three misses, the boss is beaten once, a finished battle stays visible for an hour.

export interface MockStudent {
  id: number
  displayName: string
  classId?: number
  rewards?: string[]
}

export interface MockBattle {
  id: string
  classId: number
  topic: BattleTopic
  difficulty: BattleDifficulty
  maxHp: number
  status: 'active' | 'won' | 'stopped'
  startedAt: number
  finishedAt?: number
  /** Hits of this browser's students. */
  hits: { userId: number; name: string; at: number }[]
  tasks: Record<number, { id: string; prompt: Record<Lang, string>; answer: string; misses: number }>
}

export const BATTLE_DAMAGE = 10
export const BATTLE_HP = [300, 600, 1000]
/** Demo classmates deal a hit every few seconds. */
const DEMO_HIT_MS = 3500

const DEMO_CLASSMATES: Omit<LeaderRow, 'rank' | 'me'>[] = [
  { name: 'Аружан Б.', stars: 9, coins: 150, cleanWins: 2 },
  { name: 'Ерасыл К.', stars: 6, coins: 110, cleanWins: 1 },
  { name: 'Мадина С.', stars: 6, coins: 95, cleanWins: 2 },
  { name: 'Тимур А.', stars: 3, coins: 60, cleanWins: 0 },
  { name: 'Айлин Ж.', stars: 3, coins: 45, cleanWins: 1 },
  { name: 'Нурсултан Е.', stars: 0, coins: 25, cleanWins: 0 },
]
const DEMO_FIGHTERS = DEMO_CLASSMATES.map((c) => c.name)

export function shortName(displayName: string) {
  const [first, second] = displayName.trim().split(/\s+/)
  return second ? `${first} ${second[0]}.` : first || '?'
}

export function demoLeaderboard(students: MockStudent[], schoolClass: ClassInfo, meId: number | null): Leaderboard {
  const real = students
    .filter((u) => u.classId === schoolClass.id)
    .map((u) => ({
      name: shortName(u.displayName),
      stars: 0,
      coins: (u.rewards ?? []).reduce((sum, key) => sum + (PROGRESS_REWARDS[key] ?? 0), 0),
      cleanWins: 0,
      me: u.id === meId,
    }))
  const all = [...DEMO_CLASSMATES.map((r) => ({ ...r, me: false })), ...real].sort(
    (a, b) => b.stars - a.stars || b.coins - a.coins || b.cleanWins - a.cleanWins || a.name.localeCompare(b.name),
  )
  let rank = 0
  let previous = ''
  const rows = all.map((r, i) => {
    const score = `${r.stars}/${r.coins}/${r.cleanWins}`
    if (score !== previous) [rank, previous] = [i + 1, score]
    return { ...r, rank }
  })
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return {
    className: schoolClass.name,
    weekStart: monday.toISOString(),
    rows: [...rows.slice(0, 10), ...rows.slice(10).filter((r) => r.me)],
    classSize: rows.length,
  }
}

export const MOCK_BATTLE_COPY = {
  ru: {
    correct: `Попадание! −${BATTLE_DAMAGE} HP боссу.`,
    incorrect: 'Мимо! Проверь вычисления и попробуй ещё раз.',
    invalid: 'Запиши ответ числом или дробью, например 12 или 3/4.',
    swap: 'Мимо! Держи новую задачу — у тебя получится.',
  },
  kk: {
    correct: `Дәл тидің! Боссқа −${BATTLE_DAMAGE} HP.`,
    incorrect: 'Тимеді! Есебіңді тексеріп, қайта көр.',
    invalid: 'Жауапты санмен немесе бөлшекпен жаз, мысалы 12 немесе 3/4.',
    swap: 'Тимеді! Міне, жаңа есеп — сен міндетті түрде шешесің.',
  },
}

/** Every hit so far: this browser's students plus the demo classmates' steady stream. */
function allHits(battle: MockBattle) {
  const end = battle.finishedAt ?? Date.now()
  const demo = Array.from({ length: Math.max(0, Math.floor((end - battle.startedAt) / DEMO_HIT_MS)) }, (_, i) => ({
    userId: 0,
    name: DEMO_FIGHTERS[(i * 5) % DEMO_FIGHTERS.length],
    at: battle.startedAt + (i + 1) * DEMO_HIT_MS,
  }))
  return [...demo, ...battle.hits].sort((a, b) => a.at - b.at).slice(0, Math.ceil(battle.maxHp / BATTLE_DAMAGE))
}

/** Marks the boss beaten once the hits add up. */
export function settle(battle: MockBattle) {
  if (battle.status !== 'active') return
  const hits = allHits(battle)
  if (hits.length * BATTLE_DAMAGE >= battle.maxHp) Object.assign(battle, { status: 'won', finishedAt: hits[hits.length - 1].at })
}

export function latestBattle(battles: MockBattle[], classId: number) {
  const battle = [...battles].reverse().find((b) => b.classId === classId)
  if (!battle) return null
  settle(battle)
  return battle.status === 'active' || Date.now() - (battle.finishedAt ?? 0) < 3_600_000 ? battle : null
}

export function boardOf(schoolClass: ClassInfo, battle: MockBattle, present: LobbyStudent[] = []): BattleBoard {
  settle(battle)
  const hits = allHits(battle)
  const counts = new Map<string, number>()
  for (const h of hits) counts.set(h.name, (counts.get(h.name) ?? 0) + 1)
  return {
    id: battle.id,
    classId: battle.classId,
    className: schoolClass.name,
    classCode: schoolClass.code,
    topic: battle.topic,
    difficulty: battle.difficulty,
    maxHp: battle.maxHp,
    hp: Math.max(0, battle.maxHp - hits.length * BATTLE_DAMAGE),
    damagePerHit: BATTLE_DAMAGE,
    status: battle.status,
    hits: hits.length,
    fighters: counts.size,
    top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, hits: n })),
    recent: hits.slice(-6).reverse().map((h) => ({ name: h.name, at: new Date(h.at).toISOString() })),
    present,
    startedAt: new Date(battle.startedAt).toISOString(),
    finishedAt: battle.finishedAt ? new Date(battle.finishedAt).toISOString() : null,
  }
}

const pick = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1))

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const tenths = (n: number) => `${Math.floor(n / 10)},${n % 10}`

/** A server-like problem: prompt in both languages and the exact answer ("7", "3/4", "42/10"). */
export function mockProblem(topic: BattleTopic): { prompt: Record<Lang, string>; answer: string } {
  if (topic === 'equations') {
    const [a, x] = [pick(2, 9), pick(3, 12)]
    const eq = Math.random() < 0.5 ? `x + ${a} = ${x + a}` : `${a} · x = ${a * x}`
    return {
      answer: String(x),
      prompt: {
        ru: `Реши уравнение-загадку: ${eq}. Чему равен x? Запиши ответ целым числом.`,
        kk: `Теңдеу-жұмбақты шеш: ${eq}. x неге тең? Жауабыңды бүтін санмен жаз.`,
      },
    }
  }
  if (topic === 'gcd') {
    const base = pick(2, 6)
    const [a, b] = [base * pick(2, 6), base * pick(7, 9)]
    const lcm = (a * b) / gcd(a, b)
    return Math.random() < 0.5
      ? { answer: String(gcd(a, b)), prompt: { ru: `Найди наибольший общий делитель чисел ${a} и ${b}: НОД(${a}; ${b}).`, kk: `${a} және ${b} сандарының ең үлкен ортақ бөлгішін тап: ЕҮОБ(${a}; ${b}).` } }
      : { answer: String(lcm), prompt: { ru: `Найди наименьшее общее кратное чисел ${a} и ${b}: НОК(${a}; ${b}).`, kk: `${a} және ${b} сандарының ең кіші ортақ еселігін тап: ЕКОЕ(${a}; ${b}).` } }
  }
  if (topic === 'decimals') {
    const [a, b] = [pick(15, 59), pick(11, 39)]
    const expr = `${tenths(a)} + ${tenths(b)}`
    return { answer: `${a + b}/10`, prompt: { ru: `Вычисли: ${expr}. Запиши ответ десятичной дробью, например 4,2.`, kk: `Есепте: ${expr}. Жауапты ондық бөлшекпен жаз, мысалы 4,2.` } }
  }
  if (topic === 'parts') {
    const [left, right] = [[1, 2], [2, 3], [3, 5], [1, 3]][pick(0, 3)]
    const total = (left + right) * pick(3, 8)
    return {
      answer: String((total / (left + right)) * right),
      prompt: {
        ru: `Ленту длиной ${total} см разрезали на две части в отношении ${left} : ${right}. Какова длина большей части в сантиметрах?`,
        kk: `Ұзындығы ${total} см таспаны ${left} : ${right} қатынасында екі бөлікке кесті. Үлкен бөліктің ұзындығы неше сантиметр?`,
      },
    }
  }
  const [pizzas, friends] = [pick(1, 3), pick(4, 7)]
  return {
    answer: `${pizzas}/${friends}`,
    prompt: {
      ru: `Пиццы: ${pizzas}. Их делят поровну на ${friends} друзей. Какую долю пиццы получит каждый? Запиши ответ дробью.`,
      kk: `Пицца саны: ${pizzas}. Оны ${friends} дос тең бөледі. Әрқайсысы пиццаның қандай үлесін алады? Жауабыңды бөлшекпен жаз.`,
    },
  }
}

export const answerFormatOf = (topic: BattleTopic): AnswerFormat => (topic === 'fractions' ? 'fraction' : topic === 'decimals' ? 'decimal' : 'whole-number')

function mockTask(topic: BattleTopic): MockBattle['tasks'][number] {
  return { id: `task-${Date.now()}-${pick(0, 9999)}`, misses: 0, ...mockProblem(topic) }
}

export function checkMockAnswer(answer: string, expected: string): 'correct' | 'incorrect' | 'invalid' {
  const value = answer.trim().replace(/^x\s*=\s*/i, '')
  const [en, ed] = expected.includes('/') ? expected.split('/').map(Number) : [Number(expected), 1]
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(value)
  const decimal = /^(\d+)(?:[.,](\d+))?$/.exec(value)
  let n: number
  let d: number
  if (fraction) [n, d] = [Number(fraction[1]), Number(fraction[2])]
  else if (decimal) [n, d] = [Number(decimal[1] + (decimal[2] ?? '')), 10 ** (decimal[2]?.length ?? 0)]
  else return 'invalid'
  return d === 0 ? 'invalid' : n * ed === en * d ? 'correct' : 'incorrect'
}

export function studentView(battle: MockBattle, userId: number, lang: Lang): StudentBattle {
  settle(battle)
  const hits = allHits(battle)
  let task: StudentBattle['task'] = null
  if (battle.status === 'active') {
    const open = (battle.tasks[userId] ??= mockTask(battle.topic))
    task = { id: open.id, prompt: open.prompt[lang], answerFormat: answerFormatOf(battle.topic) }
  }
  return {
    id: battle.id,
    topic: battle.topic,
    maxHp: battle.maxHp,
    hp: Math.max(0, battle.maxHp - hits.length * BATTLE_DAMAGE),
    damagePerHit: BATTLE_DAMAGE,
    status: battle.status,
    myHits: battle.hits.filter((h) => h.userId === userId).length,
    classHits: hits.length,
    task,
  }
}

// ---- solo review drill (demo) --------------------------------------------------------------

const PRACTICE_LENGTH = 5
const practiceTasks = new Map<string, { topic: BattleTopic; number: number; prompt: Record<Lang, string>; answer: string }>()

export function mockPracticeTask(topic: BattleTopic, number: number, lang: Lang) {
  const id = `practice-${Date.now()}-${pick(0, 9999)}`
  const problem = mockProblem(topic)
  practiceTasks.set(id, { topic, number, ...problem })
  return { id, topic, prompt: problem.prompt[lang], answerFormat: answerFormatOf(topic), number, total: PRACTICE_LENGTH }
}

/** The topic of a demo drill task (before it is answered). */
export const mockPracticeTopic = (taskId: string) => practiceTasks.get(taskId)?.topic

export function mockPracticeAnswer(taskId: string, answer: string, lang: Lang) {
  const task = practiceTasks.get(taskId)
  if (!task) return null
  const status = checkMockAnswer(answer, task.answer)
  const copy = MOCK_PRACTICE_COPY[lang]
  const view = { id: taskId, topic: task.topic, prompt: task.prompt[lang], answerFormat: answerFormatOf(task.topic), number: task.number, total: PRACTICE_LENGTH }
  if (status !== 'correct') return { status, message: copy[status], solved: task.number - 1, total: PRACTICE_LENGTH, next: view }
  practiceTasks.delete(taskId)
  const next = task.number < PRACTICE_LENGTH ? mockPracticeTask(task.topic, task.number + 1, lang) : null
  return { status, message: next ? copy.correct : copy.done, solved: task.number, total: PRACTICE_LENGTH, next }
}

const MOCK_PRACTICE_COPY = {
  ru: { correct: 'Верно! Следующая задача.', done: 'Верно! Тренировка пройдена — тема закреплена.', incorrect: 'Пока неверно. Проверь вычисления и попробуй ещё раз.', invalid: 'Запиши ответ числом или дробью, например 12, 3/4 или 4,2.' },
  kk: { correct: 'Дұрыс! Келесі есеп.', done: 'Дұрыс! Жаттығу аяқталды — тақырып бекітілді.', incorrect: 'Әзірге дұрыс емес. Есебіңді тексеріп, қайта көр.', invalid: 'Жауапты санмен немесе бөлшекпен жаз, мысалы 12, 3/4 немесе 4,2.' },
}

/** Demo classmates in a board's lobby (they cannot be removed). */
export const DEMO_LOBBY: LobbyStudent[] = DEMO_FIGHTERS.map((name, i) => ({ id: -(i + 1), name }))
