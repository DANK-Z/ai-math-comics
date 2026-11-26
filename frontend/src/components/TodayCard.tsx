import { useCallback, useEffect, useId, useState } from 'react'
import { accounts, type Lang, type MyHomework } from '../api'
import { useAccount } from '../account'
import { comicHref } from '../route'
import { formatDate, HOMEWORK_COPY, homeworkTitle } from './HomeworkCards'
import { practiceHref, PRACTICE_TOPICS } from './PracticeScreen'
import { DailyCard, ReviewCard } from './StudentDaily'

// «На сегодня»: what the student should do today, in one card. Homework first (the one thing
// that is required), most urgent on top with «сегодня / завтра» in orange; then the daily task;
// then past mistakes to repeat (optional). A counter shows how much of today is done.

const COPY = {
  ru: {
    title: 'На сегодня',
    progress: (done: number, total: number) => `Сделано ${done} из ${total}`,
    allDone: 'Всё на сегодня сделано — отлично! 🎉',
    today: 'сегодня',
    tomorrow: 'завтра',
    homework: 'Домашнее задание',
    doneHomework: (n: number) => `Сделано: ${n}`,
  },
  kk: {
    title: 'Бүгінге',
    progress: (done: number, total: number) => `${total}-ден ${done} орындалды`,
    allDone: 'Бүгінгінің бәрі орындалды — керемет! 🎉',
    today: 'бүгін',
    tomorrow: 'ертең',
    homework: 'Үй жұмысы',
    doneHomework: (n: number) => `Орындалды: ${n}`,
  },
}

const almatyToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
const daysLeft = (due: string) => Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${almatyToday()}T00:00:00Z`)) / 86400_000)

export function TodayCard({ lang }: { lang: Lang }) {
  const copy = COPY[lang]
  const hw = HOMEWORK_COPY[lang]
  const user = useAccount().user
  const id = useId()
  const inClass = user?.role === 'student' && !!user.schoolClass
  const chapters = user?.profile?.completedChapters.length
  const [homework, setHomework] = useState<MyHomework[]>([])
  const [daily, setDaily] = useState<boolean | null>(null)
  const onSolved = useCallback((solved: boolean) => setDaily(solved), [])

  useEffect(() => {
    if (!inClass) return
    const ctrl = new AbortController()
    accounts.myHomework(ctrl.signal).then(setHomework, () => {})
    return () => ctrl.abort()
    // Refresh when progress changes (a chapter done).
  }, [inClass, chapters])

  if (user?.role !== 'student') return null
  const pending = homework.filter((h) => !h.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const finished = homework.filter((h) => h.done)
  const total = homework.length + (daily === null ? 0 : 1)
  const done = finished.length + (daily ? 1 : 0)

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📋</span>{copy.title}</h2>
        {total > 0 && (
          <div className="flex min-w-40 flex-1 items-center gap-2">
            <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
              <div className="h-full bg-[#16a36a] transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-sm font-black whitespace-nowrap text-ink">{copy.progress(done, total)}</span>
          </div>
        )}
      </div>
      {total > 0 && done === total && <p className="mt-2 rounded-xl bg-emerald-100 px-3 py-1.5 font-black text-emerald-900" role="status">{copy.allDone}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {pending.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-black text-ink"><span aria-hidden>📒</span>{copy.homework}</h3>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {pending.map((item) => {
                const left = daysLeft(item.dueDate)
                const urgent = !item.overdue && left <= 1
                const when = item.overdue ? hw.overdue : left <= 0 ? copy.today : left === 1 ? copy.tomorrow : hw.until(formatDate(item.dueDate, lang))
                return (
                  <li key={item.id}>
                    <a href={item.kind === 'chapter' ? comicHref(item.target) : practiceHref(item.target as (typeof PRACTICE_TOPICS)[number])}
                      className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 font-bold hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand ${
                        item.overdue ? 'border-rose-700 bg-rose-50' : urgent ? 'border-orange-500 bg-orange-50' : 'border-ink/30'}`}>
                      <span aria-hidden>{item.overdue ? '⏰' : '📝'}</span>
                      <span className="min-w-0 flex-1 text-ink">{homeworkTitle(item.kind, item.target, lang)}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${
                        item.overdue ? 'bg-rose-600 text-white' : urgent ? 'bg-orange-500 text-white' : 'text-ink/70'}`}>{when}</span>
                      <span aria-hidden className="font-black text-ink">→</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <DailyCard lang={lang} embedded onSolved={onSolved} />

        {inClass && <ReviewCard lang={lang} embedded />}

        {finished.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-bold text-emerald-800">✅ {copy.homework}: {copy.doneHomework(finished.length)}</summary>
            <ul className="mt-1 flex flex-col gap-1">
              {finished.map((item) => (
                <li key={item.id} className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-900">
                  ✓ {homeworkTitle(item.kind, item.target, lang)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
