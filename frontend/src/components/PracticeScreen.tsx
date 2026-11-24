import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { accounts, isAbortError, type BattleTopic, type Lang, type PracticeTask, type WeakSpot } from '../api'
import { useAccount } from '../account'
import { skillCopy } from '../accountCopy'
import { CLASSROOM_COPY } from '../classroomCopy'
import { SECTION_HREFS } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { PifikSprite } from './PifikSprite'
import { RichText } from './RichText'

// Review drill: five server-checked problems on one topic (or one skill a student keeps missing).
// Reached from the home page («Повтори слабое место»), from a chapter after two wrong answers,
// and from the topic list here.

export const PRACTICE_TOPICS: readonly BattleTopic[] = ['fractions', 'equations', 'decimals', 'gcd', 'parts']

export function practiceHref(topic: BattleTopic, skill?: string | null) {
  return `#/practice/${topic}${skill ? `?skill=${encodeURIComponent(skill)}` : ''}`
}

export const PRACTICE_COPY = {
  ru: {
    title: 'Тренировка',
    lead: 'Пять коротких задач на одну тему. Пифик проверяет каждую — ошибся, попробуй ещё раз.',
    pick: 'Выбери тему',
    signIn: 'Войди как ученик, чтобы тренироваться: ответы проверяет сервер.',
    progress: (n: number, total: number) => `Задача ${n} из ${total}`,
    answer: 'Твой ответ',
    check: 'Проверить',
    checking: 'Проверяем…',
    done: 'Тренировка пройдена! Тема закреплена.',
    again: 'Ещё 5 задач',
    other: 'Другая тема',
    home: 'На главную',
    error: 'Нет связи. Попробуй ещё раз.',
    weakTitle: 'Повтори слабое место',
    weakText: (skill: string, n: number) => `В боях с боссами ты ${n} раз ошибся в теме «${skill}». Пять задач — и тема закреплена.`,
    weakGo: 'Тренироваться',
    chapterTitle: 'Давай потренируемся?',
    chapterText: (topic: string) => `Пифик: «Эта задача пока не поддаётся. Реши пять похожих задач на тему «${topic}» — и возвращайся».`,
    chapterGo: 'К тренировке',
  },
  kk: {
    title: 'Жаттығу',
    lead: 'Бір тақырыпқа бес қысқа есеп. Пифик әрқайсысын тексереді — қателессең, қайта көр.',
    pick: 'Тақырып таңда',
    signIn: 'Жаттығу үшін оқушы ретінде кір: жауаптарды сервер тексереді.',
    progress: (n: number, total: number) => `${total} есептің ${n}-і`,
    answer: 'Жауабың',
    check: 'Тексеру',
    checking: 'Тексеріп жатырмыз…',
    done: 'Жаттығу аяқталды! Тақырып бекітілді.',
    again: 'Тағы 5 есеп',
    other: 'Басқа тақырып',
    home: 'Басты бетке',
    error: 'Байланыс жоқ. Қайта көр.',
    weakTitle: 'Әлсіз тұсыңды қайтала',
    weakText: (skill: string, n: number) => `Босспен шайқаста сен «${skill}» тақырыбында ${n} рет қателестің. Бес есеп — және тақырып бекітіледі.`,
    weakGo: 'Жаттығу',
    chapterTitle: 'Жаттығайық па?',
    chapterText: (topic: string) => `Пифик: «Бұл есеп әзірге көнбей тұр. «${topic}» тақырыбына бес ұқсас есеп шығар да, қайта орал».`,
    chapterGo: 'Жаттығуға',
  },
}

/** Home page: the student's weakest skill from boss fights, with a drill on it. */
export function WeakSpotCard({ lang }: { lang: Lang }) {
  const copy = PRACTICE_COPY[lang]
  const user = useAccount().user
  const student = user?.role === 'student'
  const [weak, setWeak] = useState<WeakSpot | null>(null)
  useEffect(() => {
    if (!student) return
    const ctrl = new AbortController()
    accounts.weakSpot(ctrl.signal).then(setWeak, (err) => { if (!isAbortError(err)) setWeak(null) })
    return () => ctrl.abort()
  }, [student])
  if (!student || !weak) return null
  const skill = skillCopy(lang, weak.skill)?.review ?? CLASSROOM_COPY[lang].board.topics[weak.topic]
  return (
    <section className="rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#fff4d1,#ffe4ec)] p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>🎯</span>{copy.weakTitle}</h2>
      <p className="mt-1 text-sm leading-snug font-semibold text-ink/85">{copy.weakText(skill, weak.mistakes)}</p>
      <a href={practiceHref(weak.topic, weak.skill)} className={`${PRIMARY} mt-2`}>{copy.weakGo} →</a>
    </section>
  )
}

/** Under a chapter's exercise after two wrong answers: a drill on the chapter's topic. */
export function ChapterPracticeHint({ lang, topic }: { lang: Lang; topic: BattleTopic }) {
  const copy = PRACTICE_COPY[lang]
  return (
    <aside className="flex items-start gap-3 rounded-2xl border-[3px] border-ink bg-cream p-3 shadow-[0_3px_0_var(--shadow-ink)]">
      <PifikSprite className="w-12 shrink-0 rounded-xl border-2 border-ink bg-sky-100" />
      <div className="min-w-0">
        <p className="font-black text-ink">{copy.chapterTitle}</p>
        <p className="mt-0.5 text-sm leading-snug font-semibold text-ink/85">{copy.chapterText(CLASSROOM_COPY[lang].board.topics[topic])}</p>
        <a href={practiceHref(topic)} className={`${SECONDARY} mt-2`}>{copy.chapterGo} →</a>
      </div>
    </aside>
  )
}

/** #/practice and #/practice/{topic}: pick a topic, then solve five problems. */
export function PracticeScreen({ lang, topic, skill }: { lang: Lang; topic: BattleTopic | null; skill: string | null }) {
  const copy = PRACTICE_COPY[lang]
  const topics = CLASSROOM_COPY[lang].board.topics
  const student = useAccount().user?.role === 'student'
  const header = (
    <div>
      <h1 className="text-3xl font-black text-ink">{copy.title}{topic && <span className="text-brand-dark"> · {skillCopy(lang, skill)?.review ?? topics[topic]}</span>}</h1>
      <p className="mt-1 font-semibold text-ink/80">{copy.lead}</p>
    </div>
  )
  if (!student) {
    return <div className="flex max-w-2xl flex-col gap-4">{header}<p className={`${CARD} font-bold`}>{copy.signIn}</p><a href={SECTION_HREFS.login} className={`${PRIMARY} self-start`}>→</a></div>
  }
  if (!topic) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {header}
        <section className={CARD}>
          <h2 className="text-lg font-black">{copy.pick}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PRACTICE_TOPICS.map((t) => (
              <li key={t}><a href={practiceHref(t)} className={`${SECONDARY} w-full justify-between`}>{topics[t]} <span aria-hidden>→</span></a></li>
            ))}
          </ul>
        </section>
      </div>
    )
  }
  return <div className="flex max-w-2xl flex-col gap-4">{header}<Drill key={`${topic}-${skill}`} lang={lang} topic={topic} skill={skill} /></div>
}

function Drill({ lang, topic, skill }: { lang: Lang; topic: BattleTopic; skill: string | null }) {
  const copy = PRACTICE_COPY[lang]
  const hints = CLASSROOM_COPY[lang].battle
  const [task, setTask] = useState<PracticeTask | null>(null)
  const [solved, setSolved] = useState(0)
  const [done, setDone] = useState(false)
  const [run, setRun] = useState(0)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ status: string; message: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    let live = true
    setTask(null); setSolved(0); setDone(false); setFeedback(null); setFailed(false)
    accounts.startPractice({ topic, skill, lang }).then((t) => { if (live) setTask(t) }, () => { if (live) setFailed(true) })
    return () => { live = false }
    // Language changes keep the current drill; a new run starts a fresh one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, skill, run])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!task || busy || !answer.trim()) return
    setBusy(true)
    try {
      const result = await accounts.answerPractice({ taskId: task.id, answer, lang })
      setFeedback({ status: result.status, message: result.message })
      setSolved(result.solved)
      if (result.status === 'correct') setAnswer('')
      if (result.next) setTask(result.next)
      else if (result.status === 'correct') setDone(true)
    } catch {
      setFeedback({ status: 'invalid', message: copy.error })
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  if (failed) return <p role="alert" className="font-bold text-rose-700">{copy.error}</p>
  if (!task) return <p aria-busy="true" className="py-6 text-center font-bold text-ink/60">…</p>
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <ol aria-hidden className="flex gap-1.5">
        {Array.from({ length: task.total }, (_, i) => (
          <li key={i} className={`h-3 flex-1 rounded-full border-2 border-ink ${i < solved ? 'bg-emerald-400' : i === solved && !done ? 'bg-sun' : 'bg-white'}`} />
        ))}
      </ol>
      {done ? (
        <div className="mt-4">
          <p className="rounded-xl bg-emerald-100 p-3 text-lg font-black text-emerald-900"><span aria-hidden>🏆 </span>{copy.done}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} onClick={() => setRun((n) => n + 1)}>{copy.again}</button>
            <a href="#/practice" className={SECONDARY}>{copy.other}</a>
            <a href={SECTION_HREFS.map} className={SECONDARY}>{copy.home}</a>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <h2 id={`${id}-title`} className="text-sm font-black text-ink/70">{copy.progress(task.number, task.total)}</h2>
          <p className="text-lg leading-snug font-extrabold text-ink"><RichText text={task.prompt} /></p>
          <label htmlFor={`${id}-answer`} className="text-sm font-black text-ink/80">{copy.answer}</label>
          <div className="flex gap-2">
            <input
              ref={input}
              id={`${id}-answer`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoComplete="off"
              autoFocus
              inputMode={task.answerFormat === 'fraction' ? 'text' : task.answerFormat === 'decimal' ? 'decimal' : 'numeric'}
              placeholder={task.answerFormat === 'fraction' ? hints.fractionHint : task.answerFormat === 'decimal' ? hints.decimalHint : hints.wholeHint}
              aria-invalid={feedback?.status === 'incorrect' || undefined}
              className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-2xl font-bold tabular-nums outline-none placeholder:font-sans placeholder:text-base placeholder:font-semibold focus-visible:ring-4 focus-visible:ring-sun aria-invalid:border-rose-600 aria-invalid:bg-rose-50"
            />
            <button type="submit" disabled={busy || !answer.trim()} className={`${PRIMARY} shrink-0`}>{busy ? copy.checking : copy.check}</button>
          </div>
          <p aria-live="polite" className={`min-h-6 font-black ${feedback?.status === 'correct' ? 'text-emerald-700' : 'text-rose-700'}`}>{feedback?.message}</p>
        </form>
      )}
    </section>
  )
}
