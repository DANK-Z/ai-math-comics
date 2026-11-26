import { useCallback, useId, useState, type FormEvent } from 'react'
import { accounts, type CastHeroId, type Lang, type SeasonEvent, type TeacherTaskItem } from '../api'
import { COSMETICS, frameClass, isCosmetic } from '../cosmetics'
import { SECTION_HREFS } from '../route'
import { HERO_PORTRAITS, sceneArt } from '../sceneArt'
import { useLoaded } from '../usePolled'
import { CARD, PRIMARY } from './AuthScreen'

// «Мой класс» extras for a student: the seasonal event, the teacher's own problems drawn as
// comic panels, and quick links to the learning path, duels and the NIS/BIL mock test.

export const HERO_NAMES: Record<CastHeroId, Record<Lang, string>> = {
  pifik: { ru: 'Пифик', kk: 'Пифик' },
  aldiyar: { ru: 'Алдияр', kk: 'Алдияр' },
  aruna: { ru: 'Аруна', kk: 'Аруна' },
  timur: { ru: 'Тимур', kk: 'Тимур' },
  dana: { ru: 'Дана', kk: 'Дана' },
}

const COPY = {
  ru: {
    events: { knowledge: '📚 Событие «День знаний»', winter: '❄️ Новогоднее событие', nauryz: '🌷 Событие «Наурыз»' } as Record<SeasonEvent['id'], string>,
    eventLead: (target: number, end: string) => `Реши ${target} задач дня до ${end} — и получи особую рамку для героя.`,
    progress: (p: number, t: number) => `${Math.min(p, t)} из ${t}`,
    claim: '🎁 Забрать рамку',
    claimed: 'Рамка твоя! Надень её в рюкзаке.',
    toBackpack: 'В рюкзак',
    tasks: 'Задачи от учителя',
    answer: 'Ответ',
    send: 'Проверить',
    hint: 'Подсказка',
    correct: '✅ Верно!',
    wrong: 'Пока неверно — попробуй ещё',
    invalid: 'Запиши ответ числом',
    tries: (n: number) => `Попыток: ${n}`,
    path: '🧭 Мой путь',
    duel: '⚔️ Дуэль 1 на 1',
    prep: '🎓 НИШ / БИЛ',
    more: 'Ещё',
    error: 'Нет связи. Попробуй ещё раз.',
  },
  kk: {
    events: { knowledge: '📚 «Білім күні» оқиғасы', winter: '❄️ Жаңа жылдық оқиға', nauryz: '🌷 «Наурыз» оқиғасы' } as Record<SeasonEvent['id'], string>,
    eventLead: (target: number, end: string) => `${end} дейін ${target} күн есебін шеш — кейіпкерге ерекше жиек ал.`,
    progress: (p: number, t: number) => `${t}-тен ${Math.min(p, t)}`,
    claim: '🎁 Жиекті алу',
    claimed: 'Жиек сенікі! Оны рюкзакта киіп ал.',
    toBackpack: 'Рюкзакқа',
    tasks: 'Мұғалімнің есептері',
    answer: 'Жауап',
    send: 'Тексеру',
    hint: 'Кеңес',
    correct: '✅ Дұрыс!',
    wrong: 'Әзірге дұрыс емес — тағы көр',
    invalid: 'Жауапты санмен жаз',
    tries: (n: number) => `Талпыныс: ${n}`,
    path: '🧭 Менің жолым',
    duel: '⚔️ 1-ге 1 жекпе-жек',
    prep: '🎓 НЗМ / БИЛ',
    more: 'Тағы',
    error: 'Байланыс жоқ. Қайта көр.',
  },
}

function shortDate(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'long' })
}

export function QuickLinks({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const link = 'rounded-xl border-[3px] border-ink bg-white px-3 py-2 text-sm font-black text-ink shadow-[2px_2px_0_#17233a] hover:bg-sky'
  return (
    <nav aria-label={c.more} className="flex flex-wrap gap-2">
      <a href={SECTION_HREFS.path} className={link}>{c.path}</a>
      <a href={SECTION_HREFS.duel} className={link}>{c.duel}</a>
      <a href={SECTION_HREFS.prep} className={link}>{c.prep}</a>
    </nav>
  )
}

export function EventCard({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const { value, setValue } = useLoaded(useCallback((s: AbortSignal) => accounts.myEvent(s), []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!value) return null
  const event = value
  const ready = event.progress >= event.target
  const frame = isCosmetic(event.frame) ? COSMETICS[event.frame] : null

  async function claim() {
    setBusy(true)
    setError(null)
    try {
      setValue(await accounts.claimEvent())
    } catch {
      setError(c.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${CARD} flex items-center gap-4`} aria-label={c.events[event.id]}>
      <div className={`grid size-16 shrink-0 place-items-center rounded-xl text-3xl ${frameClass(event.frame)}`} aria-hidden="true">{frame?.icon ?? '🎁'}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="font-black text-ink">{c.events[event.id]}</h2>
        <p className="text-sm font-semibold text-ink/80">{event.claimed ? c.claimed : c.eventLead(event.target, shortDate(event.end, lang))}</p>
        {!event.claimed && (
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuenow={Math.min(event.progress, event.target)} aria-valuemin={0} aria-valuemax={event.target}>
              <div className="h-full bg-[#2f9e44]" style={{ width: `${Math.min(100, (event.progress / event.target) * 100)}%` }} />
            </div>
            <span className="text-sm font-black tabular-nums">{c.progress(event.progress, event.target)}</span>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-bold text-rose-700">{error}</p>}
      </div>
      {ready && !event.claimed && <button type="button" disabled={busy} onClick={claim} className={`${PRIMARY} shrink-0`}>{c.claim}</button>}
      {event.claimed && <a href={SECTION_HREFS.backpack} className="shrink-0 font-black text-brand-dark underline">{c.toBackpack}</a>}
    </section>
  )
}

/** The teacher's problem as a comic panel: the chapter's scene, the hero and a speech bubble. */
export function TaskPanel({ task, lang, children }: { task: Pick<TeacherTaskItem, 'hero' | 'scene' | 'textRu' | 'textKk'>; lang: Lang; children?: React.ReactNode }) {
  const scene = sceneArt(task.scene)
  const text = (lang === 'kk' ? task.textKk : task.textRu) || task.textRu
  return (
    <figure className="relative overflow-hidden rounded-2xl border-[3px] border-ink bg-sky" style={scene ? { backgroundImage: `url(${scene})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="flex min-h-48 items-end gap-3 bg-gradient-to-t from-black/35 to-transparent p-3">
        <img src={HERO_PORTRAITS[task.hero]} alt={HERO_NAMES[task.hero][lang]} width={96} height={96} loading="lazy" className="size-24 shrink-0 rounded-full border-[3px] border-ink bg-white object-cover" />
        <figcaption className="relative mb-6 flex-1 rounded-2xl border-[3px] border-ink bg-white px-3 py-2 text-base leading-snug font-bold text-ink shadow-[2px_2px_0_#17233a]">
          <span className="block text-xs font-black text-ink/60">{HERO_NAMES[task.hero][lang]}</span>
          {text}
          <span className="absolute -left-2.5 bottom-3 size-4 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white" aria-hidden="true" />
        </figcaption>
      </div>
      {children}
    </figure>
  )
}

function TaskItem({ task, lang }: { task: TeacherTaskItem; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [answer, setAnswer] = useState('')
  const [solved, setSolved] = useState(!!task.mySolved)
  const [tries, setTries] = useState(task.myTries ?? 0)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const hint = lang === 'kk' ? task.hintKk || task.hintRu : task.hintRu

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!answer.trim()) return
    setBusy(true)
    try {
      const r = await accounts.answerTask(task.id, answer)
      setTries(r.tries)
      if (r.status === 'correct') setSolved(true)
      setMessage(r.status === 'correct' ? null : r.status === 'invalid' ? c.invalid : c.wrong)
    } catch {
      setMessage(c.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2">
      <TaskPanel task={task} lang={lang} />
      {solved ? <p className="font-black text-emerald-700">{c.correct} <span className="font-semibold text-ink/60">{c.tries(tries)}</span></p> : (
        <form onSubmit={send} className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-a`} className="sr-only">{c.answer}</label>
          <input id={`${id}-a`} value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" placeholder={c.answer}
            className="min-h-11 w-36 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-lg font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
          <button type="submit" disabled={busy || !answer.trim()} className={PRIMARY}>{c.send}</button>
          {hint && tries >= 1 && <details className="w-full text-sm"><summary className="cursor-pointer font-black text-brand-dark">{c.hint}</summary><p className="mt-1 font-semibold text-ink/85">{hint}</p></details>}
          {message && <p role="alert" className="w-full text-sm font-bold text-rose-700">{message}</p>}
        </form>
      )}
    </li>
  )
}

export function TeacherTasksCard({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const tasks = useLoaded(useCallback((s: AbortSignal) => accounts.myTasks(s), [])).value
  if (!tasks?.length) return null
  const open = [...tasks].sort((a, b) => Number(!!a.mySolved) - Number(!!b.mySolved)).slice(0, 3)
  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <h2 className="text-xl font-black text-ink">✏️ {c.tasks}</h2>
      <ul className="flex flex-col gap-4">{open.map((t) => <TaskItem key={t.id} task={t} lang={lang} />)}</ul>
    </section>
  )
}
