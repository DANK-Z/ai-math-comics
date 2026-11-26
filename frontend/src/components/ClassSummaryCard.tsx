import { useEffect, useId, useState } from 'react'
import { accounts, isAbortError, type ClassSummary, type Lang } from '../api'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CURRICULUM } from '../curriculum'
import { dayMonth } from '../dates'
import { CARD } from './AuthScreen'

// Class page («Аналитика»): the class over a week, a month or a quarter. Which topics the class
// knows and where it slips (boss fights and lessons on the board, merged by course section),
// who lags behind, and a table of every student. «Сохранить в PDF» prints only this card.

type Period = 7 | 30 | 90

const COPY = {
  ru: {
    title: 'Сводка по классу',
    lead: 'Какие темы класс знает, где проседает и кому нужна помощь. Можно сохранить в PDF для завуча или родительского собрания.',
    periods: { 7: 'Неделя', 30: 'Месяц', 90: 'Четверть' } as Record<Period, string>,
    period: 'Период',
    since: (from: string, to: string) => `${from} — ${to}`,
    print: '🖨️ Сохранить в PDF',
    active: 'Занимались',
    accuracy: 'Верных ответов',
    solved: 'Решено задач',
    lagging: 'Нужна помощь',
    topics: 'Темы',
    topicsNone: 'За этот период ответов по темам ещё нет.',
    strong: 'знают',
    weak: 'проседает',
    middle: 'в процессе',
    answers: (n: number) => `${n} отв.`,
    lag: 'Кому нужна помощь',
    lagNone: 'Все занимаются и решают уверенно 🎉',
    lagIdle: 'не занимался за период',
    lagLow: (p: number) => `верно только ${p}% ответов`,
    table: 'Все ученики',
    name: 'Ученик',
    colAnswers: 'Ответы',
    colAccuracy: 'Верно',
    colSolved: 'Задачи',
    colChapters: 'Главы',
    colDays: 'Дней',
    colLast: 'Последний раз',
    never: '—',
    error: 'Не удалось загрузить сводку.',
  },
  kk: {
    title: 'Сынып бойынша жиынтық',
    lead: 'Сынып қай тақырыптарды біледі, қай жерде әлсіз және кімге көмек керек. Оқу ісінің меңгерушісі немесе ата-аналар жиналысы үшін PDF-ке сақтауға болады.',
    periods: { 7: 'Апта', 30: 'Ай', 90: 'Тоқсан' } as Record<Period, string>,
    period: 'Кезең',
    since: (from: string, to: string) => `${from} — ${to}`,
    print: '🖨️ PDF-ке сақтау',
    active: 'Айналысқандар',
    accuracy: 'Дұрыс жауаптар',
    solved: 'Шығарылған есептер',
    lagging: 'Көмек керек',
    topics: 'Тақырыптар',
    topicsNone: 'Бұл кезеңде тақырыптар бойынша жауаптар әлі жоқ.',
    strong: 'біледі',
    weak: 'әлсіз',
    middle: 'үйреніп жатыр',
    answers: (n: number) => `${n} жауап`,
    lag: 'Кімге көмек керек',
    lagNone: 'Бәрі айналысып, сенімді шешіп жүр 🎉',
    lagIdle: 'кезең ішінде айналыспады',
    lagLow: (p: number) => `жауаптардың тек ${p}%-ы дұрыс`,
    table: 'Барлық оқушылар',
    name: 'Оқушы',
    colAnswers: 'Жауаптар',
    colAccuracy: 'Дұрыс',
    colSolved: 'Есептер',
    colChapters: 'Тараулар',
    colDays: 'Күн',
    colLast: 'Соңғы рет',
    never: '—',
    error: 'Жиынтықты жүктеу мүмкін болмады.',
  },
}

const pct = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0)

/** Boss topics and lesson chapters, merged by the course section's name. */
function topicRows(summary: ClassSummary, lang: Lang) {
  const names = CLASSROOM_COPY[lang].board.topics as Record<string, string>
  const rows = new Map<string, { answers: number; correct: number }>()
  const add = (label: string, answers: number, correct: number) => {
    const row = rows.get(label) ?? { answers: 0, correct: 0 }
    rows.set(label, { answers: row.answers + answers, correct: row.correct + correct })
  }
  for (const t of summary.topics) add(names[t.topic] ?? t.topic, t.answers, t.correct)
  for (const l of summary.lessons) add(CURRICULUM[l.comicId]?.section[lang] ?? l.comicId, l.answered, l.correct)
  return [...rows].map(([label, r]) => ({ label, ...r, pct: pct(r.correct, r.answers) })).sort((a, b) => a.pct - b.pct)
}

export function ClassSummaryCard({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = COPY[lang]
  const id = useId()
  const [days, setDays] = useState<Period>(7)
  const [summary, setSummary] = useState<ClassSummary | null>(null)
  const [failed, setFailed] = useState(false)

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

  const topics = summary ? topicRows(summary, lang) : []
  const pupils = summary?.pupils ?? []
  const answers = pupils.reduce((s, p) => s + p.answers, 0)
  const correct = pupils.reduce((s, p) => s + p.correct, 0)
  const lagging = pupils.filter((p) => p.lagging)

  return (
    <section className={`${CARD} print-summary`} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📈</span>{copy.title}</h2>
          <p className="mt-1 text-sm font-semibold text-ink/80 print:hidden">{copy.lead}</p>
          {summary && <p className="mt-1 text-sm font-bold text-ink/70">{copy.since(dayMonth(new Date(summary.since), lang), dayMonth(new Date(), lang))}</p>}
        </div>
        <button type="button" onClick={print} disabled={!summary}
          className="min-h-10 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand print:hidden">
          {copy.print}
        </button>
      </div>

      <fieldset className="mt-3 print:hidden">
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

      {failed && <p role="alert" className="mt-3 font-bold text-rose-700">{copy.error}</p>}
      {summary && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              [copy.active, `${pupils.filter((p) => p.activeDays > 0).length} / ${summary.students}`],
              [copy.accuracy, answers ? `${pct(correct, answers)}%` : '—'],
              [copy.solved, String(pupils.reduce((s, p) => s + p.solved, 0))],
              [copy.lagging, String(lagging.length)],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl border-2 border-ink/30 p-2">
                <dt className="text-xs font-bold text-ink/70">{label}</dt>
                <dd className="text-2xl font-black text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="min-w-0">
          <h3 className="font-black text-ink">{copy.topics}</h3>
          {topics.length === 0 ? <p className="mt-1 text-sm font-semibold text-ink/70">{copy.topicsNone}</p> : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {topics.map((t) => {
                const tone = t.pct >= 80 ? ['bg-[#16a36a]', 'text-emerald-800', copy.strong] : t.pct < 60 ? ['bg-[#fb9a3c]', 'text-orange-800', copy.weak] : ['bg-[#f5c542]', 'text-ink/80', copy.middle]
                return (
                  <li key={t.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                    <span className="truncate font-black text-ink" title={t.label}>{t.label}</span>
                    <span className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                      <span className={`block h-full ${tone[0]}`} style={{ width: `${Math.max(4, t.pct)}%` }} />
                    </span>
                    <span className="font-bold whitespace-nowrap text-ink tabular-nums">
                      {t.pct}% <span className={`text-xs ${tone[1]}`}>· {tone[2]} · {copy.answers(t.answers)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          </div>
          <div className="min-w-0">
          <h3 className="font-black text-ink">{copy.lag}</h3>
          {lagging.length === 0 ? <p className="mt-1 text-sm font-bold text-emerald-700">{copy.lagNone}</p> : (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {lagging.map((p) => (
                <li key={p.id} className="rounded-lg bg-orange-100 px-2 py-0.5 text-sm font-bold text-orange-900">
                  {p.name}: {p.activeDays === 0 ? copy.lagIdle : copy.lagLow(pct(p.correct, p.answers))}
                </li>
              ))}
            </ul>
          )}
          </div>
          </div>

          <details className="mt-4 print:block">
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
                  {pupils.map((p) => (
                    <tr key={p.id} className={`border-b border-ink/15 font-semibold text-ink ${p.lagging ? 'bg-orange-50' : ''}`}>
                      <th scope="row" className="px-1.5 py-1 font-black">{p.lagging ? '⚠️ ' : ''}{p.name}</th>
                      <td className="px-1.5 py-1 tabular-nums">{p.answers}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.answers ? `${pct(p.correct, p.answers)}%` : '—'}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.solved}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.chapters}</td>
                      <td className="px-1.5 py-1 tabular-nums">{p.activeDays}</td>
                      <td className="px-1.5 py-1">{p.lastActive ? dayMonth(new Date(p.lastActive), lang) : copy.never}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
