import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { accounts, isAbortError, type DailyTask, type Lang, type ReviewItem } from '../api'
import { useAccount } from '../account'
import { skillCopy } from '../accountCopy'
import { CLASSROOM_COPY } from '../classroomCopy'
import { dayMonth } from '../dates'
import { comicHref } from '../route'
import { PRIMARY, SECONDARY } from './AuthScreen'
import { chapterTitle } from './CurriculumCard'
import { practiceHref } from './PracticeScreen'

// The student's daily habit: one short problem a day with a streak (bonuses at 3, 7 and 14
// days), and the review of past mistakes: what went wrong in a lesson or a boss fight comes
// back after a couple of days, until the chapter is solved or the skill is drilled.

const COPY = {
  ru: {
    title: 'Задача дня',
    streak: (n: number) => (n ? `🔥 Серия: ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней'} подряд` : '🔥 Начни серию сегодня'),
    nextBonus: (left: number, coins: number) => `До бонуса +${coins} 🪙: ещё ${left} ${left === 1 ? 'день' : left <= 4 ? 'дня' : 'дней'}`,
    reward: (coins: number) => `+${coins} 🪙 за решение`,
    answer: 'Ответ',
    check: 'Проверить',
    checking: 'Проверяем…',
    solved: 'Задача дня решена! Возвращайся завтра — серия продолжится.',
    paid: (coins: number) => `+${coins} 🪙`,
    bonus: (days: number, coins: number) => `🎉 Серия ${days} дней — бонус +${coins} 🪙!`,
    error: 'Нет связи. Попробуй ещё раз.',
    reviewTitle: 'Повтори ошибки',
    reviewLead: 'Эти задачи не получились пару дней назад. Реши ещё раз — и они исчезнут из списка.',
    chapter: (title: string) => `Глава «${title}»`,
    drill: (skill: string) => `Тренировка: ${skill}`,
    fromLesson: (n: number) => (n > 1 ? `ошибок на уроке: ${n}` : 'ошибка на уроке'),
    fromBoss: (n: number) => `ошибок в бою: ${n}`,
    when: (d: string) => `с ${d}`,
    solveAgain: 'Решить снова',
    train: 'Потренироваться',
    optional: 'по желанию',
  },
  kk: {
    title: 'Күн есебі',
    streak: (n: number) => (n ? `🔥 Қатарынан ${n} күн` : '🔥 Сериянды бүгін баста'),
    nextBonus: (left: number, coins: number) => `+${coins} 🪙 бонусқа дейін: тағы ${left} күн`,
    reward: (coins: number) => `шешкенің үшін +${coins} 🪙`,
    answer: 'Жауап',
    check: 'Тексеру',
    checking: 'Тексеріп жатырмыз…',
    solved: 'Күн есебі шешілді! Ертең орал — серия жалғасады.',
    paid: (coins: number) => `+${coins} 🪙`,
    bonus: (days: number, coins: number) => `🎉 ${days} күндік серия — +${coins} 🪙 бонус!`,
    error: 'Байланыс жоқ. Қайта көр.',
    reviewTitle: 'Қателерді қайтала',
    reviewLead: 'Бұл есептер бірнеше күн бұрын шықпады. Қайта шеш — сонда олар тізімнен кетеді.',
    chapter: (title: string) => `«${title}» тарауы`,
    drill: (skill: string) => `Жаттығу: ${skill}`,
    fromLesson: (n: number) => (n > 1 ? `сабақтағы қателер: ${n}` : 'сабақтағы қате'),
    fromBoss: (n: number) => `шайқастағы қателер: ${n}`,
    when: (d: string) => `${d} бастап`,
    solveAgain: 'Қайта шешу',
    train: 'Жаттығу',
    optional: 'қалауың бойынша',
  },
}

const CARD = 'rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4'

/** One problem a day; the streak and the next bonus on top. */
export function DailyCard({ lang, embedded = false, onSolved }: { lang: Lang; embedded?: boolean; onSolved?: (solved: boolean) => void }) {
  const copy = COPY[lang]
  const account = useAccount()
  const student = account.user?.role === 'student'
  const id = useId()
  const [task, setTask] = useState<DailyTask | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string; bonus?: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!student) return
    const ctrl = new AbortController()
    accounts.daily(lang, ctrl.signal).then(setTask, (err) => { if (!isAbortError(err)) setTask(null) })
    return () => ctrl.abort()
  }, [student, lang])

  useEffect(() => {
    if (task) onSolved?.(task.solved)
  }, [task, onSolved])

  if (!student || !task) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !answer.trim() || !task) return
    setBusy(true)
    try {
      const result = await accounts.answerDaily({ taskId: task.taskId, answer, lang })
      setTask(result.daily)
      if (result.status === 'correct') {
        setMessage({ ok: true, text: `${result.message} ${copy.paid(result.coins)}`, bonus: result.bonus ? copy.bonus(result.bonus.days, result.bonus.coins) : undefined })
        void account.refresh()
      } else {
        setMessage({ ok: false, text: result.message })
        input.current?.focus()
      }
    } catch {
      setMessage({ ok: false, text: copy.error })
    } finally {
      setBusy(false)
    }
  }

  const left = task.nextBonus ? task.nextBonus.days - task.streak : 0
  return (
    <section className={embedded ? 'rounded-xl border-2 border-ink/25 bg-[linear-gradient(135deg,#fff8e1,#e8f4ff)] p-3' : `${CARD} bg-[linear-gradient(135deg,#fff8e1,#e8f4ff)]`} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {embedded
          ? <h3 id={`${id}-title`} className="flex items-center gap-2 font-black text-ink"><span aria-hidden>{task.solved ? '✅' : '📅'}</span>{copy.title}</h3>
          : <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>📅</span>{copy.title}</h2>}
        <p className="font-black text-orange-700">{copy.streak(task.streak)}</p>
      </div>
      {task.nextBonus && (
        <div className="mt-1.5">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: task.nextBonus.days }, (_, i) => (
              <span key={i} className={`h-2.5 flex-1 rounded-full border border-ink/40 ${i < task.streak ? 'bg-[#fb9a3c]' : 'bg-white'}`} />
            ))}
          </div>
          <p className="mt-1 text-xs font-bold text-ink/75">{copy.nextBonus(left, task.nextBonus.coins)}</p>
        </div>
      )}
      {task.solved ? (
        <p className="mt-3 rounded-xl bg-emerald-100 p-3 font-black text-emerald-900" role="status">
          ✓ {copy.solved}
          {message?.bonus && <span className="mt-1 block text-lg">{message.bonus}</span>}
          {message?.ok && <span className="mt-0.5 block text-sm font-bold">{message.text}</span>}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <p className="text-lg leading-snug font-extrabold text-ink">{task.prompt} <span className="align-middle text-xs font-bold whitespace-nowrap text-ink/65">{copy.reward(task.coins)}</span></p>
          <div className="flex gap-2">
            <label htmlFor={`${id}-answer`} className="sr-only">{copy.answer}</label>
            <input ref={input} id={`${id}-answer`} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={copy.answer}
              inputMode={task.answerFormat === 'whole-number' ? 'numeric' : 'text'} autoComplete="off"
              className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-xl font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
            <button type="submit" disabled={busy || !answer.trim()} className={`${PRIMARY} shrink-0`}>{busy ? copy.checking : copy.check}</button>
          </div>
          {message && !message.ok && <p aria-live="polite" className="font-bold text-rose-700">{message.text}</p>}
        </form>
      )}
    </section>
  )
}

/** Past mistakes that came back: a chapter to solve again or a skill to drill. */
export function ReviewCard({ lang, embedded = false }: { lang: Lang; embedded?: boolean }) {
  const copy = COPY[lang]
  const student = useAccount().user?.role === 'student'
  const [items, setItems] = useState<ReviewItem[]>([])

  useEffect(() => {
    if (!student) return
    const ctrl = new AbortController()
    accounts.review(ctrl.signal).then(setItems, (err) => { if (!isAbortError(err)) setItems([]) })
    return () => ctrl.abort()
  }, [student])

  if (!student || !items.length) return null
  const topics = CLASSROOM_COPY[lang].board.topics as Record<string, string>
  return (
    <section className={embedded ? '' : CARD} aria-labelledby="review-title">
      {embedded
        ? <h3 id="review-title" className="flex items-center gap-2 font-black text-ink"><span aria-hidden>🔁</span>{copy.reviewTitle} <span className="text-xs font-bold text-ink/60">· {copy.optional}</span></h3>
        : <h2 id="review-title" className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>🔁</span>{copy.reviewTitle}</h2>}
      {!embedded && <p className="mt-1 text-sm font-semibold text-ink/80">{copy.reviewLead}</p>}
      <ul className={`${embedded ? 'mt-1.5' : 'mt-3'} flex flex-col gap-2`}>
        {items.map((item) => {
          const chapter = item.kind === 'chapter' && item.comicId
          const skill = item.skill ? skillCopy(lang, item.skill)?.review : null
          const title = chapter ? copy.chapter(chapterTitle(item.comicId!, lang)) : copy.drill(skill ?? topics[item.topic ?? ''] ?? '')
          const href = chapter ? comicHref(item.comicId!) : item.topic ? practiceHref(item.topic, item.skill) : null
          return (
            <li key={`${item.kind}-${item.comicId ?? item.skill}`} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink/25 p-2.5">
              <span aria-hidden className="text-xl">{chapter ? '📖' : '🎯'}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-ink">{title}</span>
                <span className="block text-xs font-bold text-ink/65">
                  {chapter ? copy.fromLesson(item.mistakes) : copy.fromBoss(item.mistakes)} · {copy.when(dayMonth(new Date(item.since), lang))}
                </span>
              </span>
              {href && <a href={href} className={`${chapter ? PRIMARY : SECONDARY} min-h-10 text-sm`}>{chapter ? copy.solveAgain : copy.train} →</a>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
