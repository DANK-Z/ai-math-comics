import { useEffect, useId, useState } from 'react'
import { accounts, isAbortError, type Lang, type LessonReport } from '../api'
import { practiceTopicFor } from '../curriculum'
import { dayMonth } from '../dates'
import { CARD, SECONDARY } from './AuthScreen'
import { chapterTitle } from './CurriculumCard'

// Class page («Бои и лига»): the last lessons on the board. Who got the exercise right on the
// first and on the second try, the quiz podium, and one click to set a drill only for those who
// still slipped (the chapter's review drill, or the chapter itself when it has no drill).

export const HOMEWORK_CHANGED = 'amc:homework-changed'

const COPY = {
  ru: {
    title: 'Итоги уроков',
    lead: 'Кто решил задачу урока с первой и со второй попытки. Тем, кто ошибся, можно задать тренировку одним нажатием.',
    none: 'Здесь появятся итоги, когда класс ответит на задачу урока на доске.',
    first: (p: number) => `1-я попытка: ${p}%`,
    second: (p: number) => `2-я: ${p}%`,
    right: 'верно',
    wrong: 'ошибся',
    absent: 'не ответил',
    legend: 'Зелёный — верно, оранжевый — ошибся, серый — не ответил.',
    podium: 'Пьедестал викторины:',
    drill: (n: number) => `Задать тренировку тем, кто ошибся (${n})`,
    repeat: (n: number) => `Задать главу повторно тем, кто ошибся (${n})`,
    given: (n: number) => `✓ Задано ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ученику' : 'ученикам'} на 2 дня — видно во вкладке «Задания».`,
    allRight: 'Все, кто ответил, решили верно 🎉',
    error: 'Не получилось задать. Попробуйте ещё раз.',
    more: (n: number) => `Показать все уроки (${n})`,
    less: 'Свернуть',
  },
  kk: {
    title: 'Сабақ қорытындылары',
    lead: 'Сабақтың есебін кім бірінші және екінші әрекетте шешті. Қателескендерге жаттығуды бір басумен беруге болады.',
    none: 'Сынып тақтадағы сабақ есебіне жауап бергенде, қорытынды осында шығады.',
    first: (p: number) => `1-әрекет: ${p}%`,
    second: (p: number) => `2-әрекет: ${p}%`,
    right: 'дұрыс',
    wrong: 'қателесті',
    absent: 'жауап бермеді',
    legend: 'Жасыл — дұрыс, қызғылт сары — қате, сұр — жауап бермеді.',
    podium: 'Викторина тұғыры:',
    drill: (n: number) => `Қателескендерге жаттығу беру (${n})`,
    repeat: (n: number) => `Қателескендерге тарауды қайта беру (${n})`,
    given: (n: number) => `✓ ${n} оқушыға 2 күнге берілді — «Тапсырмалар» қойындысында көрінеді.`,
    allRight: 'Жауап бергендердің бәрі дұрыс шешті 🎉',
    error: 'Беру мүмкін болмады. Қайта көріңіз.',
    more: (n: number) => `Барлық сабақтарды көрсету (${n})`,
    less: 'Жию',
  },
}

const SHOWN = 2

const pct = (t: { answered: number; correct: number }) => (t.answered ? Math.round((t.correct / t.answered) * 100) : 0)

/** The last word of a student on the lesson's exercise: the second try if there was one. */
const finalOf = (s: LessonReport['students'][number]) => (s.second ?? s.first ?? null)

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10)

/** Who still slipped on a lesson's exercise (wrong on their last try). */
export const slippedIn = (report: LessonReport) => report.students.filter((s) => finalOf(s) === false)

/** Sets the chapter's drill (or the chapter itself) for those who slipped, due in two days. */
export async function giveDrill(classId: number, report: LessonReport) {
  const slipped = slippedIn(report)
  if (!slipped.length) return 0
  const topic = practiceTopicFor(report.comicId)
  await accounts.setHomework(classId, {
    kind: topic ? 'practice' : 'chapter',
    target: topic ?? report.comicId,
    dueDate: inDays(2),
    studentIds: slipped.map((s) => s.id),
  })
  window.dispatchEvent(new Event(HOMEWORK_CHANGED))
  return slipped.length
}

function ReportItem({ report, classId, lang }: { report: LessonReport; classId: number; lang: Lang }) {
  const copy = COPY[lang]
  const slipped = slippedIn(report)
  const topic = practiceTopicFor(report.comicId)
  const [given, setGiven] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function give() {
    setBusy(true)
    setError(false)
    try {
      setGiven(await giveDrill(classId, report))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const tone = (s: LessonReport['students'][number]) => {
    const last = finalOf(s)
    return last === true ? 'bg-emerald-100 text-emerald-900' : last === false ? 'bg-orange-100 text-orange-900' : 'bg-ink/10 text-ink/60'
  }
  const label = (value: boolean | null | undefined) => (value === true ? copy.right : value === false ? copy.wrong : copy.absent)

  return (
    <li className="rounded-xl border-2 border-ink/25 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 font-black text-ink">{chapterTitle(report.comicId, lang)}</span>
        <span className="text-sm font-bold text-ink/60">{dayMonth(new Date(report.createdAt), lang)}</span>
      </div>
      <p className="mt-1 text-sm font-black text-ink">
        {copy.first(pct(report.first))}
        {report.second && <> → {copy.second(pct(report.second))}</>}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {report.students.filter((s) => s.first != null || s.second != null).map((s) => (
          <li key={s.id} className={`rounded-lg px-2 py-0.5 text-xs font-bold ${tone(s)}`}
            title={`${label(s.first)}${report.second ? ` → ${label(s.second)}` : ''}`}>
            {finalOf(s) === true ? '✓ ' : finalOf(s) === false ? '✗ ' : ''}{s.name}
            <span className="sr-only">: {label(s.first)}{report.second ? `, ${label(s.second)}` : ''}</span>
          </li>
        ))}
      </ul>
      {report.podium.length > 0 && (
        <p className="mt-2 text-sm font-bold text-ink">
          🏆 {copy.podium} {report.podium.map((p) => `${['🥇', '🥈', '🥉'][p.place - 1]} ${p.name}`).join(' · ')}
        </p>
      )}
      <div className="mt-2">
        {given != null ? (
          <p className="font-bold text-emerald-700" role="status">{copy.given(given)}</p>
        ) : slipped.length ? (
          <button type="button" disabled={busy} onClick={give} className={`${SECONDARY} text-sm`}>
            📒 {topic ? copy.drill(slipped.length) : copy.repeat(slipped.length)}
          </button>
        ) : report.first.answered > 0 ? (
          <p className="text-sm font-bold text-emerald-700">{copy.allRight}</p>
        ) : null}
        {error && <p role="alert" className="mt-1 text-sm font-bold text-rose-700">{copy.error}</p>}
      </div>
    </li>
  )
}

export function LessonReports({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = COPY[lang]
  const id = useId()
  const [reports, setReports] = useState<LessonReport[] | null>(null)
  const [all, setAll] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    accounts.lessonReports(classId, ctrl.signal).then(setReports, (err) => { if (!isAbortError(err)) setReports([]) })
    return () => ctrl.abort()
  }, [classId])

  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📊</span>{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      {reports && (reports.length === 0 ? <p className="mt-3 font-semibold text-ink/70">{copy.none}</p> : (
        <>
          <p className="mt-2 text-xs font-semibold text-ink/65">{copy.legend}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {(all ? reports : reports.slice(0, SHOWN)).map((r) => <ReportItem key={r.id} report={r} classId={classId} lang={lang} />)}
          </ul>
          {reports.length > SHOWN && (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 text-sm font-black text-brand-dark underline">
              {all ? copy.less : copy.more(reports.length)}
            </button>
          )}
        </>
      ))}
    </section>
  )
}
