import { useEffect, useRef, useState } from 'react'
import { accounts, isAbortError, LOCAL_COMICS, type Lang, type PupilStat, type StudentCard } from '../api'
import { skillCopy } from '../accountCopy'
import { CLASSROOM_COPY } from '../classroomCopy'
import { dayMonth } from '../dates'
import { DrillButton, pct, pupilIn, weakestTopic, type Period, type TopicRow } from './ClassAnalytics'
import { chapterTitle } from './CurriculumCard'
import { formatDate, homeworkTitle } from './HomeworkCards'

// One student for the teacher, in a dialog over the analytics: how it goes by topic, the
// typical slips with the chapter's hint, homework, activity over two weeks, and two actions
// (a drill on the weakest topic, a short note to copy for the parent).

const COPY = {
  ru: {
    close: 'Закрыть',
    login: (l: string) => `логин ${l}`,
    period: (d: Period) => (d === 7 ? 'за неделю' : d === 30 ? 'за месяц' : 'за четверть'),
    answers: 'Ответы',
    accuracy: 'Верно',
    solved: 'Задачи',
    chapters: 'Главы',
    activity: 'Активность за 2 недели',
    activityDay: (d: string, n: number) => `${d}: ${n}`,
    topics: 'Темы',
    noTopics: 'Пока нет ответов по темам.',
    mistakes: 'Типичные ошибки',
    noMistakes: 'Ошибок за период нет 🎉',
    bossSlip: (skill: string, answer: string, n: number) => `${skill}: ответ «${answer}»${n > 1 ? ` × ${n}` : ''}`,
    lessonSlip: (chapter: string, answer: string, n: number) => `«${chapter}» на уроке: ответ «${answer}»${n > 1 ? ` × ${n}` : ''}`,
    homework: 'Домашнее задание',
    noHomework: 'Домашних заданий нет.',
    done: 'сделано',
    overdue: 'просрочено',
    until: (d: string) => `до ${d}`,
    drill: (topic: string) => `📒 Тренировка: ${topic}`,
    copy: '📋 Скопировать для родителя',
    copied: '✓ Скопировано',
    note: (name: string, period: string, p: number, n: number, days: number, weak: string | null, hw: string) =>
      `${name} ${period}: ${n} ответов, верно ${p}%, занимался ${days} дн.${weak ? ` Стоит повторить: ${weak}.` : ''}${hw ? ` Домашнее задание: ${hw}.` : ''}`,
    error: 'Не удалось загрузить карточку.',
  },
  kk: {
    close: 'Жабу',
    login: (l: string) => `логин ${l}`,
    period: (d: Period) => (d === 7 ? 'апта ішінде' : d === 30 ? 'ай ішінде' : 'тоқсан ішінде'),
    answers: 'Жауаптар',
    accuracy: 'Дұрыс',
    solved: 'Есептер',
    chapters: 'Тараулар',
    activity: '2 аптадағы белсенділік',
    activityDay: (d: string, n: number) => `${d}: ${n}`,
    topics: 'Тақырыптар',
    noTopics: 'Тақырыптар бойынша жауаптар әлі жоқ.',
    mistakes: 'Жиі кездесетін қателер',
    noMistakes: 'Кезеңде қате жоқ 🎉',
    bossSlip: (skill: string, answer: string, n: number) => `${skill}: «${answer}» жауабы${n > 1 ? ` × ${n}` : ''}`,
    lessonSlip: (chapter: string, answer: string, n: number) => `Сабақтағы «${chapter}»: «${answer}» жауабы${n > 1 ? ` × ${n}` : ''}`,
    homework: 'Үй жұмысы',
    noHomework: 'Үй жұмысы жоқ.',
    done: 'орындалды',
    overdue: 'мерзімі өтті',
    until: (d: string) => `${d} дейін`,
    drill: (topic: string) => `📒 Жаттығу: ${topic}`,
    copy: '📋 Ата-анаға көшіру',
    copied: '✓ Көшірілді',
    note: (name: string, period: string, p: number, n: number, days: number, weak: string | null, hw: string) =>
      `${name} ${period}: ${n} жауап, ${p}% дұрыс, ${days} күн айналысты.${weak ? ` Қайталау керек: ${weak}.` : ''}${hw ? ` Үй жұмысы: ${hw}.` : ''}`,
    error: 'Карточканы жүктеу мүмкін болмады.',
  },
}

export function StudentCardDialog({ classId, pupil, days, rows, lang, onClose }: { classId: number; pupil: PupilStat; days: Period; rows: TopicRow[]; lang: Lang; onClose: () => void }) {
  const copy = COPY[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  const [card, setCard] = useState<StudentCard | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
    const ctrl = new AbortController()
    accounts.studentCard(classId, pupil.id, days, ctrl.signal).then(setCard, (err) => { if (!isAbortError(err)) setFailed(true) })
    return () => ctrl.abort()
  }, [classId, pupil.id, days])

  const p = card?.pupil ?? pupil
  const accuracy = pct(p.correct, p.answers)
  const mine = rows.map((r) => ({ r, ...pupilIn(r, p, lang) })).filter((r) => r.answers > 0).sort((a, b) => pct(a.correct, a.answers) - pct(b.correct, b.answers))
  const weak = mine.find((m) => pct(m.correct, m.answers) < 60)?.r ?? (p.lagging ? weakestTopic(p, rows, lang) : undefined)
  const max = Math.max(1, ...(card?.activity.map((a) => a.count) ?? [1]))

  function mistakeText(m: StudentCard['mistakes'][number]) {
    if (m.source === 'lesson' && m.comicId) {
      const hint = LOCAL_COMICS.find((d) => d.id === m.comicId)?.text[lang].commonMistakes?.[Number(m.answer)]
      return { text: copy.lessonSlip(chapterTitle(m.comicId, lang), m.answer, m.count), hint }
    }
    const skill = skillCopy(lang, m.skill ?? null)?.name ?? (CLASSROOM_COPY[lang].board.topics as Record<string, string>)[m.topic ?? ''] ?? m.topic ?? ''
    return { text: copy.bossSlip(skill, m.answer, m.count), hint: undefined }
  }

  async function copyNote() {
    const pending = (card?.homework ?? []).filter((h) => !h.done).map((h) => homeworkTitle(h.kind, h.target, lang)).join(', ')
    const text = copy.note(card?.fullName ?? p.name, copy.period(days), accuracy, p.answers, p.activeDays, weak?.label ?? null, pending)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('', text)
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close() }}
      className="m-auto w-[min(44rem,calc(100vw-1.5rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border-[3px] border-ink bg-white p-0 text-ink shadow-[0_6px_0_var(--shadow-ink)] backdrop:bg-ink/50">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">{p.lagging ? '⚠️ ' : ''}{card?.fullName ?? p.name}</h2>
            <p className="text-sm font-bold text-ink/65">{card?.login ? `${copy.login(card.login)} · ` : ''}{copy.period(days)}</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={copy.close}
            className="grid size-10 shrink-0 place-items-center rounded-xl border-[3px] border-ink bg-white text-xl font-black hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand">×</button>
        </div>

        <dl className="grid grid-cols-4 gap-2">
          {([[copy.answers, p.answers], [copy.accuracy, p.answers ? `${accuracy}%` : '—'], [copy.solved, p.solved], [copy.chapters, p.chapters]] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl border-2 border-ink/25 px-2 py-1">
              <dt className="text-xs font-bold text-ink/65">{label}</dt>
              <dd className="text-xl font-black tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          {weak && <DrillButton classId={classId} row={weak} students={[p]} label={copy.drill(weak.label)} lang={lang} />}
          <button type="button" onClick={copyNote} className="rounded-lg border-2 border-ink bg-white px-2.5 py-1 text-sm font-black hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand">
            {copied ? copy.copied : copy.copy}
          </button>
        </div>

        {failed && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}

        <section>
          <h3 className="font-black">{copy.topics}</h3>
          {mine.length === 0 ? <p className="text-sm font-semibold text-ink/65">{copy.noTopics}</p> : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {mine.map(({ r, answers, correct }) => {
                const value = pct(correct, answers)
                return (
                  <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-2 text-sm">
                    <span className="truncate font-bold">{r.label}</span>
                    <span className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                      <span className={`block h-full ${value >= 80 ? 'bg-[#16a36a]' : value < 60 ? 'bg-[#fb9a3c]' : 'bg-[#f5c542]'}`} style={{ width: `${Math.max(6, value)}%` }} />
                    </span>
                    <span className="text-right font-black tabular-nums">{value}%</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {card && (
          <>
            <section>
              <h3 className="font-black">{copy.mistakes}</h3>
              {card.mistakes.length === 0 ? <p className="text-sm font-semibold text-emerald-700">{copy.noMistakes}</p> : (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {card.mistakes.map((m, i) => {
                    const { text, hint } = mistakeText(m)
                    return (
                      <li key={i} className="rounded-xl bg-orange-50 px-2.5 py-1.5 text-sm">
                        <span className="font-black">{text}</span> <span className="text-xs font-bold text-ink/55">· {dayMonth(new Date(m.last), lang)}</span>
                        {hint && <span className="mt-0.5 block font-semibold text-ink/80">💡 {hint}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="font-black">{copy.homework}</h3>
              {card.homework.length === 0 ? <p className="text-sm font-semibold text-ink/65">{copy.noHomework}</p> : (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {card.homework.map((h) => (
                    <li key={h.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-sm font-bold ${h.done ? 'bg-emerald-50' : h.overdue ? 'bg-rose-50' : 'bg-sky-50'}`}>
                      <span aria-hidden>{h.done ? '✅' : h.overdue ? '⏰' : '📝'}</span>
                      <span className="min-w-0 flex-1 truncate">{homeworkTitle(h.kind, h.target, lang)}</span>
                      <span className={`text-xs font-black ${h.done ? 'text-emerald-800' : h.overdue ? 'text-rose-700' : 'text-ink/65'}`}>
                        {h.done ? copy.done : h.overdue ? copy.overdue : copy.until(formatDate(h.dueDate, lang))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="font-black">{copy.activity}</h3>
              <div className="mt-1.5 flex h-16 items-end gap-1" role="img" aria-label={card.activity.map((a) => copy.activityDay(dayMonth(new Date(`${a.day}T00:00:00`), lang), a.count)).join(', ')}>
                {card.activity.map((a) => (
                  <span key={a.day} title={copy.activityDay(dayMonth(new Date(`${a.day}T00:00:00`), lang), a.count)}
                    className={`flex-1 rounded-t ${a.count ? 'bg-[#3366e0]' : 'bg-ink/10'}`} style={{ height: `${a.count ? Math.max(12, (a.count / max) * 100) : 6}%` }} />
                ))}
              </div>
              <div className="mt-0.5 flex justify-between text-[11px] font-bold text-ink/55">
                <span>{dayMonth(new Date(`${card.activity[0].day}T00:00:00`), lang)}</span>
                <span>{dayMonth(new Date(`${card.activity[card.activity.length - 1].day}T00:00:00`), lang)}</span>
              </div>
            </section>
          </>
        )}
      </div>
    </dialog>
  )
}
