import type { ClassInfo, HomeworkItem, HomeworkKind, LessonBoard, LessonPhase, MyHomework, StudentLesson } from './types'

// Demo lessons and homework (no backend). Demo classmates answer a lesson a few seconds after
// the teacher opens answering, so the board fills up like in a real class.

export interface MockLesson {
  id: string
  classId: number
  comicId: string
  answer: number
  panel: number
  phase: LessonPhase
  createdAt: number
  answeringAt?: number
  answers: Record<number, { text: string; correct: boolean }>
}

export interface MockHomework {
  id: string
  classId: number
  kind: HomeworkKind
  target: string
  dueDate: string
  createdAt: number
}

export interface MockPupil {
  id: number
  displayName: string
  classId?: number
  completedChapters: string[]
}

const DEMO_ANSWER_MS = 1800
// Demo classmates: four right, two with the usual slips.
const DEMO_SLIPS = [0, 0, 7, 0, 3, 0]

function demoAnswers(lesson: MockLesson) {
  if (!lesson.answeringAt) return []
  const count = Math.min(DEMO_SLIPS.length, Math.floor((Date.now() - lesson.answeringAt) / DEMO_ANSWER_MS))
  return DEMO_SLIPS.slice(0, count).map((slip) => {
    const value = slip ? lesson.answer + slip : lesson.answer
    return { text: String(value), correct: !slip }
  })
}

export function lessonBoardOf(schoolClass: ClassInfo, lesson: MockLesson, classStudents: number): LessonBoard {
  const answers = [...Object.values(lesson.answers), ...demoAnswers(lesson)]
  const revealed = lesson.phase === 'reveal' || lesson.phase === 'closed'
  const wrong = new Map<string, number>()
  for (const a of answers) if (!a.correct) wrong.set(a.text, (wrong.get(a.text) ?? 0) + 1)
  return {
    id: lesson.id,
    classId: schoolClass.id,
    className: schoolClass.name,
    classCode: schoolClass.code,
    comicId: lesson.comicId,
    panel: lesson.panel,
    phase: lesson.phase,
    students: classStudents + DEMO_SLIPS.length,
    answered: answers.length,
    correct: revealed ? answers.filter((a) => a.correct).length : null,
    wrong: revealed ? [...wrong].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, count]) => ({ text, count })) : [],
    answer: lesson.answer,
  }
}

export function studentLessonOf(lesson: MockLesson, userId: number): StudentLesson {
  const mine = lesson.answers[userId]
  const revealed = lesson.phase === 'reveal' || lesson.phase === 'closed'
  return {
    id: lesson.id,
    comicId: lesson.comicId,
    panel: lesson.panel,
    phase: lesson.phase,
    myAnswer: mine?.text ?? null,
    correct: mine && revealed ? mine.correct : null,
  }
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
    .filter((p) => p.classId === item.classId)
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
  }
}

export function myHomeworkOf(item: MockHomework, pupil: MockPupil, practice: PracticeDone[]): MyHomework {
  const done = isDone(item, pupil, practice)
  return { id: item.id, kind: item.kind, target: item.target, dueDate: item.dueDate, overdue: !done && almatyToday() > item.dueDate, done }
}
