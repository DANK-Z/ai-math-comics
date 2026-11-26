import type { ChartBar, ClassInfo, HomeworkItem, LessonReport, LobbyStudent, HomeworkKind, LessonBoard, LessonPhase, MyHomework, PodiumRow, StudentLesson } from './types'
import { DEMO_LOBBY } from './mockClassroom'

// Demo lessons and homework (no backend). Demo classmates answer a lesson a few seconds after
// the teacher opens answering, so the board fills up like in a real class.

export interface MockAnswer {
  text: string
  correct: boolean
  points?: number
}

export interface MockLesson {
  id: string
  classId: number
  comicId: string
  answer: number
  panel: number
  phase: LessonPhase
  createdAt: number
  answeringAt?: number
  /** Old saves: the answers of the first try (now in rounds['0-1']). */
  answers: Record<number, MockAnswer>
  rounds?: Record<string, Record<number, MockAnswer>>
  /** How many demo classmates had answered when a round closed. */
  demoCount?: Record<string, number>
  attempt?: number
  step?: number
  timer?: number
  deadline?: number | null
  quiz?: { comicId: string; answer: number }[]
  podium?: PodiumRow[]
}

export interface MockHomework {
  id: string
  classId: number
  kind: HomeworkKind
  target: string
  dueDate: string
  createdAt: number
  studentIds?: number[] | null
}

export interface MockPupil {
  id: number
  displayName: string
  classId?: number
  completedChapters: string[]
}

const DEMO_ANSWER_MS = 1800
const QUIZ_TIMER = 30
// Demo classmates' slips (0: right) for each round: the first try, the second one, quiz steps.
const DEMO_SLIPS: Record<string, number[]> = {
  '0-1': [0, 0, 7, 0, 3, 0],
  '0-2': [0, 0, 0, 0, 3, 0],
  '1-1': [0, 0, 1, 0, 2, 0],
  '2-1': [0, 5, 0, 0, 0, 0],
  '3-1': [0, 0, 0, 3, 0, 0],
  '4-1': [2, 0, 0, 0, 0, 0],
  '5-1': [0, 0, 0, 0, 0, 4],
}
const demoPupils = () => DEMO_LOBBY.slice(0, 6)

const stepOf = (lesson: MockLesson) => lesson.step ?? 0
const attemptOf = (lesson: MockLesson) => lesson.attempt ?? 1
// Quiz questions have one try each (key `${step}-1`), whatever try the chapter's exercise is on.
const roundKey = (lesson: MockLesson) => `${stepOf(lesson)}-${stepOf(lesson) ? 1 : attemptOf(lesson)}`

export function stepAnswer(lesson: MockLesson) {
  const step = stepOf(lesson)
  return step && lesson.quiz ? lesson.quiz[step - 1].answer : lesson.answer
}

function realAnswers(lesson: MockLesson, key: string) {
  if (key === '0-1' && !lesson.rounds?.['0-1']) return lesson.answers
  return lesson.rounds?.[key] ?? {}
}

/** Demo classmates answer one by one while a round is open (frozen when it closes). */
function demoAnswers(lesson: MockLesson, key: string): { id: number; name: string; answer: MockAnswer }[] {
  const slips = DEMO_SLIPS[key] ?? DEMO_SLIPS['1-1']
  const pupils = demoPupils()
  let count = lesson.demoCount?.[key]
  if (count === undefined) {
    if (key !== roundKey(lesson) || lesson.phase !== 'answering' || !lesson.answeringAt) return []
    count = Math.floor((Date.now() - lesson.answeringAt) / DEMO_ANSWER_MS)
  }
  const [step] = key.split('-').map(Number)
  const right = step && lesson.quiz ? lesson.quiz[step - 1].answer : lesson.answer
  return pupils.slice(0, Math.min(pupils.length, count)).map((p, i) => {
    const slip = slips[i] ?? 0
    return { id: p.id, name: p.name, answer: { text: String(right + slip), correct: !slip, points: !slip && step ? 100 + Math.max(0, 50 - i * 8) : 0 } }
  })
}

function allAnswers(lesson: MockLesson, key: string) {
  const real = Object.entries(realAnswers(lesson, key)).map(([id, answer]) => ({ id: Number(id), answer }))
  return [...demoAnswers(lesson, key), ...real]
}

function closeRound(lesson: MockLesson) {
  if (lesson.phase !== 'answering') return
  const key = roundKey(lesson)
  ;(lesson.demoCount ??= {})[key] = demoAnswers(lesson, key).length
  lesson.deadline = null
}

export function openAnswering(lesson: MockLesson) {
  lesson.phase = 'answering'
  lesson.answeringAt = Date.now()
  const seconds = lesson.timer || (stepOf(lesson) ? QUIZ_TIMER : 0)
  lesson.deadline = seconds ? Date.now() + seconds * 1000 : null
}

export function setPhase(lesson: MockLesson, phase: LessonPhase) {
  if (phase === lesson.phase) return
  if (phase === 'answering') return openAnswering(lesson)
  closeRound(lesson)
  lesson.phase = phase
}

/** A timed round reveals itself when the time is up or everyone has answered. */
export function settleLesson(lesson: MockLesson, roster: number) {
  if (lesson.phase !== 'answering' || !lesson.deadline) return
  const answered = allAnswers(lesson, roundKey(lesson)).length
  if (Date.now() >= lesson.deadline || answered >= roster + demoPupils().length) setPhase(lesson, 'reveal')
}

export function saveAnswer(lesson: MockLesson, userId: number, text: string, correct: boolean) {
  const key = roundKey(lesson)
  const rounds = (lesson.rounds ??= { '0-1': { ...lesson.answers } })
  const seconds = (Date.now() - (lesson.answeringAt ?? Date.now())) / 1000
  const points = stepOf(lesson) && correct ? 100 + Math.max(0, 50 - Math.floor((seconds * 50) / QUIZ_TIMER)) : 0
  ;(rounds[key] ??= {})[userId] = { text: text.trim(), correct, points }
}

const valueText = (text: string) => {
  const value = wholeAnswer(text)
  return value === null ? text.trim() : String(value)
}

function chartOf(answers: MockAnswer[], right: number): ChartBar[] {
  const counts = new Map<string, number>()
  for (const a of answers) counts.set(valueText(a.text), (counts.get(valueText(a.text)) ?? 0) + 1)
  const bars = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([text, count]) => ({ text, count, correct: text === String(right) }))
  if (counts.has(String(right)) && !bars.some((b) => b.correct)) bars[bars.length - 1] = { text: String(right), count: counts.get(String(right))!, correct: true }
  return bars.sort((a, b) => Number(b.correct) - Number(a.correct) || b.count - a.count)
}

/** Quiz totals of everyone (demo classmates and real students), best first. */
export function quizRanking(lesson: MockLesson, names: Map<number, string>): PodiumRow[] {
  const totals = new Map<number, number>()
  for (let step = 1; step <= (lesson.quiz?.length ?? 0); step++) {
    for (const { id, answer } of allAnswers(lesson, `${step}-1`)) totals.set(id, (totals.get(id) ?? 0) + (answer.points ?? 0))
  }
  for (const p of demoPupils()) names.set(p.id, p.name)
  return [...totals]
    .filter(([id, points]) => points > 0 && names.has(id))
    .sort((a, b) => b[1] - a[1] || names.get(a[0])!.localeCompare(names.get(b[0])!))
    .slice(0, 3)
    .map(([id, points], i) => ({ id, name: names.get(id)!, points, place: i + 1, stars: 3 - i }))
}

export function lessonBoardOf(schoolClass: ClassInfo, lesson: MockLesson, roster: { id: number; name: string }[], present: LobbyStudent[] = []): LessonBoard {
  settleLesson(lesson, roster.length)
  const key = roundKey(lesson)
  const answers = allAnswers(lesson, key)
  const revealed = lesson.phase === 'reveal' || lesson.phase === 'podium' || lesson.phase === 'closed'
  const right = stepAnswer(lesson)
  const wrong = new Map<string, number>()
  for (const { answer: a } of answers) if (!a.correct) wrong.set(a.text, (wrong.get(a.text) ?? 0) + 1)
  const answered = new Set(answers.map((a) => a.id))
  const everyone = [...demoPupils(), ...roster]
  const first = stepOf(lesson) === 0 && attemptOf(lesson) === 2 ? allAnswers(lesson, '0-1') : null
  return {
    id: lesson.id,
    classId: schoolClass.id,
    className: schoolClass.name,
    classCode: schoolClass.code,
    comicId: lesson.comicId,
    panel: lesson.panel,
    phase: lesson.phase,
    students: everyone.length,
    answered: answers.length,
    correct: revealed ? answers.filter((a) => a.answer.correct).length : null,
    wrong: revealed ? [...wrong].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, count]) => ({ text, count })) : [],
    chart: revealed ? chartOf(answers.map((a) => a.answer), right) : [],
    answer: right,
    present,
    answeredIds: [...answered],
    waiting: lesson.phase === 'answering' ? everyone.filter((p) => !answered.has(p.id)).map((p) => p.name) : [],
    attempt: attemptOf(lesson),
    firstAnswered: first ? first.length : null,
    firstCorrect: first ? first.filter((a) => a.answer.correct).length : null,
    step: stepOf(lesson),
    quiz: (lesson.quiz ?? []).map((t) => t.comicId),
    timer: lesson.timer ?? 0,
    secondsLeft: lesson.phase === 'answering' && lesson.deadline ? Math.max(0, Math.round((lesson.deadline - Date.now()) / 1000)) : null,
    podium: lesson.podium ?? [],
  }
}

export function studentLessonOf(lesson: MockLesson, userId: number): StudentLesson {
  const mine = realAnswers(lesson, roundKey(lesson))[userId]
  const revealed = lesson.phase === 'reveal' || lesson.phase === 'podium' || lesson.phase === 'closed'
  let points = 0
  for (let step = 1; step <= (lesson.quiz?.length ?? 0); step++) points += realAnswers(lesson, `${step}-1`)[userId]?.points ?? 0
  const award = lesson.podium?.find((p) => p.id === userId)
  return {
    id: lesson.id,
    comicId: lesson.comicId,
    panel: lesson.panel,
    phase: lesson.phase,
    myAnswer: mine?.text ?? null,
    correct: mine && revealed ? mine.correct : null,
    attempt: attemptOf(lesson),
    step: stepOf(lesson),
    stepComicId: stepOf(lesson) && lesson.quiz ? lesson.quiz[stepOf(lesson) - 1].comicId : null,
    quizSize: lesson.quiz?.length ?? 0,
    secondsLeft: lesson.phase === 'answering' && lesson.deadline ? Math.max(0, Math.round((lesson.deadline - Date.now()) / 1000)) : null,
    points: revealed ? points : 0,
    place: award?.place ?? null,
    stars: award?.stars ?? 0,
  }
}

/** The class page: the last lessons, who was right on each try (demo classmates included). */
export function lessonReportsOf(lessons: MockLesson[], classId: number, roster: { id: number; name: string }[]): LessonReport[] {
  const everyone = [...demoPupils(), ...roster]
  return lessons
    .filter((l) => l.classId === classId)
    .reverse()
    .slice(0, 10)
    .flatMap((lesson) => {
      const tries = [1, 2].map((attempt) => new Map(allAnswers(lesson, `0-${attempt}`).map((a) => [a.id, a.answer.correct])))
      if (!tries[0].size && !lesson.quiz) return []
      const summary = (answers: Map<number, boolean>) => ({ answered: answers.size, correct: [...answers.values()].filter(Boolean).length })
      return [{
        id: lesson.id,
        comicId: lesson.comicId,
        createdAt: new Date(lesson.createdAt).toISOString(),
        first: summary(tries[0]),
        second: attemptOf(lesson) === 2 ? summary(tries[1]) : null,
        students: everyone.map((p) => ({ id: p.id, name: p.name, first: tries[0].get(p.id) ?? null, second: tries[1].get(p.id) ?? null })),
        quiz: (lesson.quiz ?? []).map((t) => t.comicId),
        podium: lesson.podium ?? [],
      }]
    })
}

export function currentLesson(lessons: MockLesson[], classId: number) {
  const lesson = [...lessons].reverse().find((l) => l.classId === classId && l.phase !== 'closed')
  return lesson && Date.now() - lesson.createdAt < 3 * 3600_000 ? lesson : null
}

/** "12", "12,0" or "x = 12" → 12; anything else → null. */
export function wholeAnswer(text: string): number | null {
  const value = text.trim().replace(/^x\s*=\s*/i, '').replace(/[,.]0+$/, '').replace(/[\s  ]/g, '')
  return /^\d+$/.test(value) ? Number(value) : null
}

const almatyToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)

export interface PracticeDone {
  userId: number
  topic: string
  at: number
}

function isDone(item: MockHomework, pupil: MockPupil, practice: PracticeDone[]) {
  if (item.kind === 'chapter') return pupil.completedChapters.includes(item.target)
  return practice.some((p) => p.userId === pupil.id && p.topic === item.target && p.at >= item.createdAt)
}

const shortName = (name: string) => {
  const [first, second] = name.trim().split(/\s+/)
  return second ? `${first} ${second[0]}.` : first
}

export function homeworkOf(item: MockHomework, pupils: MockPupil[], practice: PracticeDone[]): HomeworkItem {
  const students = pupils
    .filter((p) => p.classId === item.classId && (!item.studentIds || item.studentIds.includes(p.id)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((p) => ({ id: p.id, name: shortName(p.displayName), done: isDone(item, p, practice) }))
  return {
    id: item.id,
    kind: item.kind,
    target: item.target,
    dueDate: item.dueDate,
    createdAt: new Date(item.createdAt).toISOString(),
    overdue: almatyToday() > item.dueDate,
    done: students.filter((s) => s.done).length,
    total: students.length,
    students,
    targeted: !!item.studentIds,
  }
}

export function myHomeworkOf(item: MockHomework, pupil: MockPupil, practice: PracticeDone[]): MyHomework {
  const done = isDone(item, pupil, practice)
  return { id: item.id, kind: item.kind, target: item.target, dueDate: item.dueDate, overdue: !done && almatyToday() > item.dueDate, done }
}
