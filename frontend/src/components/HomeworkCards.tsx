import { useEffect, useId, useState, type FormEvent } from 'react'
import { dayMonth } from '../dates'
import { accounts, isAbortError, LOCAL_COMICS, type HomeworkItem, type HomeworkKind, type Lang, type MyHomework } from '../api'
import { useAccount } from '../account'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CURRICULUM } from '../curriculum'
import { comicHref } from '../route'
import { CARD, PRIMARY } from './AuthScreen'
import { chapterTitle } from './CurriculumCard'
import { HOMEWORK_CHANGED } from './LessonReports'
import { practiceHref, PRACTICE_TOPICS } from './PracticeScreen'

// Homework with a due date: a bundled chapter or a five-problem drill. The teacher sees who has
// done it (a chapter counts once the student's progress has it; a drill once one is finished on
// that topic after the homework was set). Students see it on the home page.

export const HOMEWORK_COPY = {
  ru: {
    title: 'Домашнее задание',
    lead: 'Выберите главу или тренировку и срок. Выполнение отмечается само.',
    kind: 'Что задать',
    chapter: 'Глава',
    practice: 'Тренировка (5 задач)',
    what: 'Задание',
    due: 'Срок',
    give: 'Задать',
    giving: 'Сохраняем…',
    none: 'Домашних заданий пока нет.',
    done: (n: number, total: number) => `Выполнили ${n} из ${total}`,
    until: (d: string) => `до ${d}`,
    overdue: 'срок прошёл',
    who: 'Кто выполнил',
    remove: 'Удалить',
    confirmRemove: 'Удалить это задание? Отметки о выполнении тоже пропадут.',
    error: 'Не получилось сохранить.',
    drill: (topic: string) => `Тренировка: ${topic}`,
    targeted: (n: number) => `для ${n} уч.`,
    studentTitle: 'Домашнее задание',
    doneMark: 'сделано',
    open: 'Открыть',
  },
  kk: {
    title: 'Үй жұмысы',
    lead: 'Тарауды немесе жаттығуды және мерзімді таңдаңыз. Орындалуы өзі белгіленеді.',
    kind: 'Не беру керек',
    chapter: 'Тарау',
    practice: 'Жаттығу (5 есеп)',
    what: 'Тапсырма',
    due: 'Мерзімі',
    give: 'Беру',
    giving: 'Сақтап жатырмыз…',
    none: 'Әзірге үй жұмысы жоқ.',
    done: (n: number, total: number) => `${total}-ден ${n} оқушы орындады`,
    until: (d: string) => `${d} дейін`,
    overdue: 'мерзімі өтті',
    who: 'Кім орындады',
    remove: 'Жою',
    confirmRemove: 'Бұл тапсырманы жою керек пе? Орындалу белгілері де жойылады.',
    error: 'Сақтау мүмкін болмады.',
    drill: (topic: string) => `Жаттығу: ${topic}`,
    targeted: (n: number) => `${n} оқушыға`,
    studentTitle: 'Үй жұмысы',
    doneMark: 'орындалды',
    open: 'Ашу',
  },
}

export const formatDate = (iso: string, lang: Lang) =>
  dayMonth(new Date(`${iso}T00:00:00`), lang)

export function homeworkTitle(kind: HomeworkKind, target: string, lang: Lang) {
  if (kind === 'chapter') return chapterTitle(target, lang)
  const topics = CLASSROOM_COPY[lang].board.topics
  return HOMEWORK_COPY[lang].drill(topics[target as keyof typeof topics] ?? target)
}

const inWeek = () => new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)

/** Class page («Задания»): set homework and see who has done it. */
export function HomeworkCard({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = HOMEWORK_COPY[lang]
  const id = useId()
  const chapters = LOCAL_COMICS.filter((d) => CURRICULUM[d.id])
  const [kind, setKind] = useState<HomeworkKind>('chapter')
  const [target, setTarget] = useState(chapters[0]?.id ?? '')
  const [due, setDue] = useState(inWeek)
  const [items, setItems] = useState<HomeworkItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ctrl = new AbortController()
    const reload = () => {
      ctrl.abort()
      ctrl = new AbortController()
      accounts.classHomework(classId, ctrl.signal).then(setItems, (err) => { if (!isAbortError(err)) setItems([]) })
    }
    reload()
    // A drill set from the lesson report on another tab of the class page.
    window.addEventListener(HOMEWORK_CHANGED, reload)
    return () => {
      ctrl.abort()
      window.removeEventListener(HOMEWORK_CHANGED, reload)
    }
  }, [classId])

  function pickKind(next: HomeworkKind) {
    setKind(next)
    setTarget(next === 'chapter' ? chapters[0]?.id ?? '' : PRACTICE_TOPICS[0])
  }

  async function give(e: FormEvent) {
    e.preventDefault()
    if (busy || !target || !due) return
    setBusy(true)
    setError(false)
    try {
      const item = await accounts.setHomework(classId, { kind, target, dueDate: due })
      setItems((prev) => [item, ...(prev ?? [])])
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: HomeworkItem) {
    if (!window.confirm(copy.confirmRemove)) return
    await accounts.deleteHomework(item.id)
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id))
  }

  const field = 'mt-1 min-h-11 w-full rounded-xl border-[3px] border-ink bg-white px-3 font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun'
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📒</span>{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      <form onSubmit={give} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-end">
        <div>
          <label htmlFor={`${id}-kind`} className="text-sm font-black text-ink/80">{copy.kind}</label>
          <select id={`${id}-kind`} value={kind} onChange={(e) => pickKind(e.target.value as HomeworkKind)} className={field}>
            <option value="chapter">{copy.chapter}</option>
            <option value="practice">{copy.practice}</option>
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-target`} className="text-sm font-black text-ink/80">{copy.what}</label>
          <select id={`${id}-target`} value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
            {kind === 'chapter'
              ? chapters.map((d) => <option key={d.id} value={d.id}>{chapterTitle(d.id, lang)}</option>)
              : PRACTICE_TOPICS.map((t) => <option key={t} value={t}>{CLASSROOM_COPY[lang].board.topics[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-due`} className="text-sm font-black text-ink/80">{copy.due}</label>
          <input id={`${id}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} required className={field} />
        </div>
        <button type="submit" disabled={busy} className={`${PRIMARY} sm:justify-self-start`}>{busy ? copy.giving : copy.give}</button>
      </form>
      {error && <p role="alert" className="mt-2 font-bold text-rose-700">{copy.error}</p>}

      {items && (items.length === 0 ? <p className="mt-3 font-semibold text-ink/70">{copy.none}</p> : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border-2 border-ink/25 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-black text-ink">{homeworkTitle(item.kind, item.target, lang)}</span>
                {item.targeted && <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-900">{copy.targeted(item.total)}</span>}
                <span className={`rounded-lg px-2 py-0.5 text-xs font-black ${item.overdue ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-ink'}`}>
                  {item.overdue ? copy.overdue : copy.until(formatDate(item.dueDate, lang))}
                </span>
                <button type="button" onClick={() => remove(item)} className="text-sm font-bold text-ink/60 underline hover:text-rose-700">{copy.remove}</button>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                <div className="h-full bg-emerald-500" style={{ width: `${item.total ? (item.done / item.total) * 100 : 0}%` }} />
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-sm font-bold text-ink/80">{copy.done(item.done, item.total)}</summary>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {item.students.map((s) => (
                    <li key={s.id} className={`rounded-lg px-2 py-0.5 text-xs font-bold ${s.done ? 'bg-emerald-100 text-emerald-900' : 'bg-ink/10 text-ink/70'}`}>
                      {s.done ? '✓ ' : ''}{s.name}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      ))}
    </section>
  )
}

/** Home page: the student's homework with due dates. */
export function MyHomeworkCard({ lang }: { lang: Lang }) {
  const copy = HOMEWORK_COPY[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const chapters = user?.profile?.completedChapters.length
  const [items, setItems] = useState<MyHomework[]>([])
  useEffect(() => {
    if (!inClass) return
    const ctrl = new AbortController()
    accounts.myHomework(ctrl.signal).then(setItems, () => {})
    return () => ctrl.abort()
    // Refresh when progress changes (a chapter done).
  }, [inClass, chapters])
  if (!inClass || items.length === 0) return null
  return (
    <section className="rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>📒</span>{copy.studentTitle}</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.kind === 'chapter' ? comicHref(item.target) : practiceHref(item.target as (typeof PRACTICE_TOPICS)[number])}
              className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-sm font-bold hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand ${item.done ? 'border-emerald-700/40 bg-emerald-50' : item.overdue ? 'border-rose-700/50 bg-rose-50' : 'border-ink/25'}`}>
              <span aria-hidden>{item.done ? '✅' : item.overdue ? '⏰' : '📝'}</span>
              <span className="min-w-0 flex-1 text-ink">{homeworkTitle(item.kind, item.target, lang)}</span>
              <span className={`shrink-0 text-xs font-black ${item.done ? 'text-emerald-800' : item.overdue ? 'text-rose-700' : 'text-ink/70'}`}>
                {item.done ? copy.doneMark : item.overdue ? copy.overdue : copy.until(formatDate(item.dueDate, lang))}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
