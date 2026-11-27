import { useEffect, useId, useState, type ReactNode } from 'react'
import { accounts, isAbortError, type BattleTopic, type ClassSummary, type Lang, type PupilStat } from '../api'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CURRICULUM, practiceTopicFor } from '../curriculum'
import { dayMonth } from '../dates'
import { printMeetingReport } from '../meetingReport'
import { CARD } from './AuthScreen'
import { ReviewBattleButton } from './ClassBattle'
import { HOMEWORK_CHANGED } from './LessonReports'
import { StudentCardDialog } from './StudentCardDialog'

// «Аналитика» of a class as one story: the main thing of the period with what to do about it,
// then topics (each with an action), then students (who needs help first, each with an action
// and a card), and the details (error map by boss round, battle ranking, the full table) folded.
// «Сохранить в PDF» prints this card only.

export type Period = 7 | 30 | 90

const COPY = {
  ru: {
    title: 'Аналитика класса',
    periods: { 7: 'Неделя', 30: 'Месяц', 90: 'Четверть' } as Record<Period, string>,
    period: 'Период',
    print: '🖨️ Сохранить в PDF',
    meeting: '👪 Отчёт к собранию',
    meetingHint: 'По странице на каждого ученика — для родительского собрания',
    main: (p: Period) => (p === 7 ? 'Главное за неделю' : p === 30 ? 'Главное за месяц' : 'Главное за четверть'),
    weak: (topic: string, pct: number) => `Проседает тема «${topic}» — верно только ${pct}% ответов.`,
    strong: (topic: string, pct: number) => `Лучше всего — «${topic}» (${pct}%).`,
    allGood: 'Класс уверенно решает все темы этого периода.',
    middle: (topic: string, pct: number) => `Ещё не закреплена тема «${topic}» — ${pct}% верных ответов.`,
    noData: 'Пока мало ответов, чтобы делать выводы. Проведите урок на доске или батл — и здесь появится картина класса.',
    helpCount: (n: number) => (n ? `Помощь нужна ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ученику' : 'ученикам'} — они первые в списке ниже.` : 'Все ученики занимаются и решают уверенно.'),
    active: 'Занимались',
    accuracy: 'Верных ответов',
    solved: 'Решено задач',
    lagging: 'Нужна помощь',
    topics: 'Темы',
    topicsLead: 'Сначала самые слабые. Кнопка задаёт тренировку только тем, у кого тема не получается.',
    statusStrong: 'знают',
    statusMiddle: 'в процессе',
    statusWeak: 'проседает',
    answers: (n: number) => `${n} отв.`,
    drill: (n: number) => `📒 Тренировка (${n})`,
    drillTitle: (names: string) => `Задать на 3 дня: ${names}`,
    given: '✓ Задано',
    students: 'Ученики',
    studentsLead: 'Кому нужна помощь — сверху. Нажмите на имя, чтобы открыть карточку ученика.',
    idle: 'не занимался',
    low: (p: number) => `верно ${p}%`,
    ok: (p: number) => `${p}%`,
    days: (n: number) => `${n} дн.`,
    giveDrill: 'Задать тренировку',
    details: 'Подробнее',
    table: 'Таблица всех учеников',
    name: 'Ученик',
    colAnswers: 'Ответы',
    colAccuracy: 'Верно',
    colSolved: 'Задачи',
    colChapters: 'Главы',
    colDays: 'Дней',
    colLast: 'Последний раз',
    error: 'Не удалось загрузить аналитику.',
    drillError: 'Не получилось задать. Попробуйте ещё раз.',
  },
  kk: {
    title: 'Сынып аналитикасы',
    periods: { 7: 'Апта', 30: 'Ай', 90: 'Тоқсан' } as Record<Period, string>,
    period: 'Кезең',
    print: '🖨️ PDF-ке сақтау',
    meeting: '👪 Жиналысқа есеп',
    meetingHint: 'Әр оқушыға бір беттен — ата-аналар жиналысына',
    main: (p: Period) => (p === 7 ? 'Аптаның басты қорытындысы' : p === 30 ? 'Айдың басты қорытындысы' : 'Тоқсанның басты қорытындысы'),
    weak: (topic: string, pct: number) => `«${topic}» тақырыбы әлсіз — жауаптардың тек ${pct}%-ы дұрыс.`,
    strong: (topic: string, pct: number) => `Ең жақсысы — «${topic}» (${pct}%).`,
    allGood: 'Сынып осы кезеңнің барлық тақырыбын сенімді шешеді.',
    middle: (topic: string, pct: number) => `«${topic}» тақырыбы әлі бекімеді — жауаптардың ${pct}%-ы дұрыс.`,
    noData: 'Қорытынды жасауға жауаптар әлі аз. Тақтада сабақ немесе шайқас өткізіңіз — сынып көрінісі осында шығады.',
    helpCount: (n: number) => (n ? `${n} оқушыға көмек керек — олар төмендегі тізімде бірінші.` : 'Барлық оқушы айналысып, сенімді шешіп жүр.'),
    active: 'Айналысқандар',
    accuracy: 'Дұрыс жауаптар',
    solved: 'Шығарылған есептер',
    lagging: 'Көмек керек',
    topics: 'Тақырыптар',
    topicsLead: 'Алдымен ең әлсіздері. Батырма жаттығуды тек тақырып шықпай жүргендерге береді.',
    statusStrong: 'біледі',
    statusMiddle: 'үйреніп жатыр',
    statusWeak: 'әлсіз',
    answers: (n: number) => `${n} жауап`,
    drill: (n: number) => `📒 Жаттығу (${n})`,
    drillTitle: (names: string) => `3 күнге беру: ${names}`,
    given: '✓ Берілді',
    students: 'Оқушылар',
    studentsLead: 'Көмек керектер — жоғарыда. Оқушы карточкасын ашу үшін атын басыңыз.',
    idle: 'айналыспады',
    low: (p: number) => `дұрыс ${p}%`,
    ok: (p: number) => `${p}%`,
    days: (n: number) => `${n} күн`,
    giveDrill: 'Жаттығу беру',
    details: 'Толығырақ',
    table: 'Барлық оқушылар кестесі',
    name: 'Оқушы',
    colAnswers: 'Жауаптар',
    colAccuracy: 'Дұрыс',
    colSolved: 'Есептер',
    colChapters: 'Тараулар',
    colDays: 'Күн',
    colLast: 'Соңғы рет',
    error: 'Аналитиканы жүктеу мүмкін болмады.',
    drillError: 'Беру мүмкін болмады. Қайта көріңіз.',
  },
}

export const pct = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0)
const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10)
const BATTLE_TOPICS: BattleTopic[] = ['fractions', 'equations', 'gcd', 'decimals', 'parts', 'addfractions', 'negatives', 'linear', 'decimalops']
const MIN_ANSWERS = 2
const WEAK = 60
const STRONG = 80

/** A topic row: boss topics and lesson chapters merged by the course section's name. */
export interface TopicRow {
  label: string
  answers: number
  correct: number
  pct: number
  /** The drill that fits the topic, if there is one; otherwise the first chapter is set again. */
  practice?: BattleTopic
  chapter?: string
  /** Students for whom this topic does not work yet. */
  weak: PupilStat[]
}

function topicKeyOf(topic: string, lang: Lang) {
  return (CLASSROOM_COPY[lang].board.topics as Record<string, string>)[topic] ?? topic
}

/** The student's answers in a topic row (boss topic or lesson chapters of that section). */
export function pupilIn(row: { label: string }, p: PupilStat, lang: Lang) {
  let answers = 0
  let correct = 0
  for (const t of p.topics ?? []) if (topicKeyOf(t.topic, lang) === row.label) [answers, correct] = [answers + t.answers, correct + t.correct]
  for (const l of p.lessons ?? []) if ((CURRICULUM[l.comicId]?.section[lang] ?? l.comicId) === row.label) [answers, correct] = [answers + l.answered, correct + l.correct]
  return { answers, correct }
}

export function topicRows(summary: ClassSummary, lang: Lang): TopicRow[] {
  const rows = new Map<string, Omit<TopicRow, 'pct' | 'weak'>>()
  const add = (label: string, answers: number, correct: number, practice?: BattleTopic, chapter?: string) => {
    const row = rows.get(label) ?? { label, answers: 0, correct: 0 }
    rows.set(label, { ...row, answers: row.answers + answers, correct: row.correct + correct, practice: row.practice ?? practice, chapter: row.chapter ?? chapter })
  }
  for (const t of summary.topics) add(topicKeyOf(t.topic, lang), t.answers, t.correct, BATTLE_TOPICS.includes(t.topic as BattleTopic) ? t.topic as BattleTopic : undefined)
  for (const l of summary.lessons) add(CURRICULUM[l.comicId]?.section[lang] ?? l.comicId, l.answered, l.correct, practiceTopicFor(l.comicId), l.comicId)
  return [...rows.values()]
    .map((r) => ({
      ...r,
      pct: pct(r.correct, r.answers),
      weak: summary.pupils.filter((p) => {
        const mine = pupilIn(r, p, lang)
        return mine.answers >= MIN_ANSWERS ? pct(mine.correct, mine.answers) < WEAK : mine.answers > mine.correct
      }),
    }))
    .sort((a, b) => a.pct - b.pct)
}

/** The weakest topic of one student (for «Задать тренировку» on the student's row). */
export function weakestTopic(p: PupilStat, rows: TopicRow[], lang: Lang): TopicRow | undefined {
  return rows
    .map((r) => ({ r, mine: pupilIn(r, p, lang) }))
    .filter(({ mine }) => mine.answers > 0)
    .sort((a, b) => pct(a.mine.correct, a.mine.answers) - pct(b.mine.correct, b.mine.answers))[0]?.r ?? rows[0]
}

/** Sets a drill (or the chapter again) for some students, due in three days. */
export async function giveTopicDrill(classId: number, row: TopicRow, studentIds: number[]) {
  await accounts.setHomework(classId, {
    kind: row.practice ? 'practice' : 'chapter',
    target: row.practice ?? row.chapter ?? 'equations',
    dueDate: inDays(3),
    studentIds,
  })
  window.dispatchEvent(new Event(HOMEWORK_CHANGED))
}

/** A button that sets a drill once, then says so. */
export function DrillButton({ classId, row, students, label, lang, small = false }: { classId: number; row: TopicRow; students: PupilStat[]; label: string; lang: Lang; small?: boolean }) {
  const copy = COPY[lang]
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  if (!students.length) return null
  if (state === 'done') return <span className="text-sm font-black text-emerald-700" role="status">{copy.given}</span>
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={state === 'busy'} title={copy.drillTitle(students.map((s) => s.name).join(', '))}
        onClick={async () => {
          setState('busy')
          try {
            await giveTopicDrill(classId, row, students.map((s) => s.id))
            setState('done')
          } catch {
            setState('error')
          }
        }}
        className={`rounded-lg border-2 border-ink bg-white font-black text-ink hover:bg-sun focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-50 ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
        {label}
      </button>
      {state === 'error' && <span role="alert" className="text-xs font-bold text-rose-700">{copy.drillError}</span>}
    </span>
  )
}

export function ClassAnalytics({ classId, className, lang, details }: { classId: number; className?: string; lang: Lang; details?: ReactNode }) {
  const copy = COPY[lang]
  const id = useId()
  const [days, setDays] = useState<Period>(7)
  const [summary, setSummary] = useState<ClassSummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [card, setCard] = useState<PupilStat | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setFailed(false)
    accounts.classSummary(classId, days, ctrl.signal).then(setSummary, (err) => { if (!isAbortError(err)) setFailed(true) })
    return () => ctrl.abort()
  }, [classId, days])

  function print() {
    document.body.classList.add('printing-summary')
    const done = () => {
      document.body.classList.remove('printing-summary')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  const rows = summary ? topicRows(summary, lang) : []
  const pupils = summary?.pupils ?? []
  const answers = pupils.reduce((s, p) => s + p.answers, 0)
  const correct = pupils.reduce((s, p) => s + p.correct, 0)
  const lagging = pupils.filter((p) => p.lagging)
  const weakest = rows[0]
  const strongest = rows.length > 1 ? rows[rows.length - 1] : undefined
  const level = !weakest ? 'good' : weakest.pct < WEAK ? 'weak' : weakest.pct < STRONG ? 'middle' : 'good'
  // Who needs help first, then by accuracy.
  const ordered = [...pupils].sort((a, b) => Number(b.lagging) - Number(a.lagging) || pct(a.correct, a.answers) - pct(b.correct, b.answers) || a.name.localeCompare(b.name))

  return (
    <section className={`${CARD} print-summary`} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📈</span>{copy.title}</h2>
        {summary && <span className="text-sm font-bold text-ink/65">{dayMonth(new Date(summary.since), lang)} — {dayMonth(new Date(), lang)}</span>}
        <span className="flex-1" />
        <fieldset className="print:hidden">
          <legend className="sr-only">{copy.period}</legend>
          <div className="inline-flex rounded-xl border-[3px] border-ink bg-white p-0.5">
            {([7, 30, 90] as Period[]).map((d) => (
              <label key={d} className="cursor-pointer rounded-lg px-3 py-1 text-sm font-black text-ink has-checked:bg-sun has-focus-visible:outline-3 has-focus-visible:outline-brand">
                <input type="radio" name={`${id}-period`} className="sr-only" checked={days === d} onChange={() => setDays(d)} />
                {copy.periods[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={print} disabled={!summary}
          className="min-h-10 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand print:hidden">
          {copy.print}
        </button>
        <button type="button" onClick={() => summary && printMeetingReport(summary, className ?? '', lang)} disabled={!summary?.pupils.length} title={copy.meetingHint}
          className="min-h-10 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand print:hidden">
          {copy.meeting}
        </button>
      </div>

      {failed && <p role="alert" className="mt-3 font-bold text-rose-700">{copy.error}</p>}
      {summary && (
        <>
          {/* The main thing of the period and what to do about it. */}
          <div className={`mt-3 rounded-xl border-[3px] p-3 ${!answers ? 'border-ink/30 bg-sky-50' : level === 'weak' ? 'border-orange-500 bg-orange-50' : level === 'middle' ? 'border-amber-500 bg-amber-50' : 'border-emerald-600 bg-emerald-50'}`}>
            <p className="text-xs font-black tracking-wide text-ink/70 uppercase">{copy.main(days)}</p>
            <p className="mt-1 text-lg leading-snug font-black text-ink">
              {!answers ? copy.noData : level === 'weak' ? copy.weak(weakest!.label, weakest!.pct) : level === 'middle' ? copy.middle(weakest!.label, weakest!.pct) : copy.allGood}
              {answers > 0 && strongest && strongest.pct >= STRONG && <span className="font-bold text-ink/80"> {copy.strong(strongest.label, strongest.pct)}</span>}
            </p>
            {answers > 0 && <p className="mt-0.5 font-bold text-ink/85">{copy.helpCount(lagging.length)}</p>}
            {answers > 0 && weakest && level !== 'good' && (
              <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
                {weakest.practice && <ReviewBattleButton classId={classId} lang={lang} topic={weakest.practice} />}
                <DrillButton classId={classId} row={weakest} students={weakest.weak} label={copy.drill(weakest.weak.length)} lang={lang} />
              </div>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              [copy.active, `${pupils.filter((p) => p.activeDays > 0).length} / ${summary.students}`, ''],
              [copy.accuracy, answers ? `${pct(correct, answers)}%` : '—', ''],
              [copy.solved, String(pupils.reduce((s, p) => s + p.solved, 0)), ''],
              [copy.lagging, String(lagging.length), lagging.length ? 'bg-orange-50' : ''],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl border-2 border-ink/30 px-2.5 py-1.5 ${tone}`}>
                <dt className="text-xs font-bold text-ink/70">{label}</dt>
                <dd className="text-2xl font-black text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid items-start gap-x-6 gap-y-4 xl:grid-cols-2">
            {/* Topics: weakest first, each with a drill for those who slip on it. */}
            <div className="min-w-0">
              <h3 className="font-black text-ink">{copy.topics}</h3>
              <p className="text-xs font-semibold text-ink/65 print:hidden">{copy.topicsLead}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {rows.map((t) => {
                  const tone = t.pct >= STRONG ? ['bg-[#16a36a]', 'text-emerald-800', copy.statusStrong] : t.pct < WEAK ? ['bg-[#fb9a3c]', 'text-orange-800', copy.statusWeak] : ['bg-[#f5c542]', 'text-ink/80', copy.statusMiddle]
                  return (
                    <li key={t.label} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-black text-ink">{t.label}</span>
                        <span className="text-sm font-bold text-ink tabular-nums">{t.pct}% <span className={`text-xs ${tone[1]}`}>· {tone[2]} · {copy.answers(t.answers)}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                          <span className={`block h-full ${tone[0]}`} style={{ width: `${Math.max(4, t.pct)}%` }} />
                        </span>
                        <span className="print:hidden"><DrillButton classId={classId} row={t} students={t.weak} label={copy.drill(t.weak.length)} lang={lang} small /></span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Students: who needs help first; the name opens the card. */}
            <div className="min-w-0">
              <h3 className="font-black text-ink">{copy.students}</h3>
              <p className="text-xs font-semibold text-ink/65 print:hidden">{copy.studentsLead}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {ordered.map((p) => {
                  const accuracy = pct(p.correct, p.answers)
                  const weakTopic = p.lagging ? weakestTopic(p, rows, lang) : undefined
                  return (
                    <li key={p.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-2 px-2 py-1 ${p.lagging ? 'border-orange-400 bg-orange-50' : 'border-transparent bg-sky-50'}`}>
                      <button type="button" onClick={() => setCard(p)}
                        className="min-w-0 flex-1 truncate text-left font-black text-brand-dark underline decoration-2 underline-offset-2 hover:text-ink focus-visible:outline-3 focus-visible:outline-brand">
                        {p.lagging ? '⚠️ ' : ''}{p.name}
                      </button>
                      <span className="w-20 text-xs font-bold text-ink/75 tabular-nums">
                        {p.activeDays === 0 ? copy.idle : p.answers ? (p.lagging ? copy.low(accuracy) : copy.ok(accuracy)) : '—'}
                      </span>
                      <span className="h-2 w-16 overflow-hidden rounded-full border border-ink/50 bg-white" aria-hidden>
                        <span className={`block h-full ${accuracy >= 80 ? 'bg-[#16a36a]' : accuracy < WEAK ? 'bg-[#fb9a3c]' : 'bg-[#f5c542]'}`} style={{ width: `${p.answers ? Math.max(6, accuracy) : 0}%` }} />
                      </span>
                      <span className="w-12 text-right text-xs font-bold text-ink/60 tabular-nums">{copy.days(p.activeDays)}</span>
                      {weakTopic && <span className="print:hidden"><DrillButton classId={classId} row={weakTopic} students={[p]} label={copy.giveDrill} lang={lang} small /></span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <details className="mt-4 rounded-xl border-2 border-ink/20 p-2 print:block">
            <summary className="cursor-pointer font-black text-ink print:list-none">{copy.table}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-xs text-ink/70">
                    {[copy.name, copy.colAnswers, copy.colAccuracy, copy.colSolved, copy.colChapters, copy.colDays, copy.colLast].map((h) => (
                      <th key={h} scope="col" className="px-1.5 py-1 font-black">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((p) => (
                    <tr key={p.id} className={`border-b border-ink/15 font-semibold text-ink ${p.lagging ? 'bg-orange-50' : ''}`}>
                      <th scope="row" className="px-1.5 py-1 font-black">{p.lagging ? '⚠️ ' : ''}{p.name}</th>
                      <td className="px-1.5 py-1 tabular-nums">{p.answers}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.answers ? `${pct(p.correct, p.answers)}%` : '—'}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.solved}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.chapters}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.activeDays}</td>
                      <td className="px-1.5 py-1">{p.lastActive ? dayMonth(new Date(p.lastActive), lang) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {details && (
        <details className="mt-2 rounded-xl border-2 border-ink/20 p-2 print:hidden">
          <summary className="cursor-pointer font-black text-ink">{copy.details}</summary>
          <div className="mt-3 grid gap-4">{details}</div>
        </details>
      )}

      {card && summary && <StudentCardDialog classId={classId} pupil={card} days={days} rows={rows} lang={lang} onClose={() => setCard(null)} />}
    </section>
  )
}
