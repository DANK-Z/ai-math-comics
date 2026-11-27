import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { accounts, type BattleBoard, type BattleDifficulty, type BattleTopic, type Lang, type StudentBattle } from '../api'
import { useAccount } from '../account'
import { BOSS_COPY } from '../boss'
import { BATTLE_BOSS, CLASSROOM_COPY } from '../classroomCopy'
import { usePolled } from '../usePolled'
import { canRun3D, markSlow } from '../arena3d'
import { battleBoardHref, joinHref, SECTION_HREFS, teacherClassHref } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { BossAvatar } from './BossFight'
import { Lobby } from './Lobby'
import { QrCode } from './QrCode'
import { RichText } from './RichText'
import { Celebration } from './Celebration'

// Class battle. The teacher puts a giant boss on the class board; students fight it from their
// phones. The server chooses every problem and keeps the answers; the screens poll it.

export const BATTLE_TOPICS = ['equations', 'fractions', 'decimals', 'gcd', 'parts'] as const

const BattleArena3D = lazy(() => import('./BattleArena3D'))

const STUDENT_POLL_MS = 3000
const BOARD_POLL_MS = 2000

function HpBar({ hp, max, big = false }: { hp: number; max: number; big?: boolean }) {
  const share = max ? hp / max : 0
  return (
    <div className={`overflow-hidden rounded-full border-[3px] border-ink bg-white ${big ? 'h-9' : 'h-5'}`}
      role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-label="HP">
      <div
        className={`h-full transition-[width] duration-500 ${share > 0.5 ? 'bg-rose-500' : share > 0.2 ? 'bg-amber-500' : 'bg-rose-700'}`}
        style={{ width: `${Math.max(0, Math.min(100, share * 100))}%` }}
      />
    </div>
  )
}

const PHONE_COPY = {
  ru: {
    mine: (mine: number, all: number) => (all ? `Твой вклад: ${mine} из ${all} ударов класса` : ''),
    slash: 'дробь',
    comma: 'запятая',
    keys: 'Быстрые знаки',
  },
  kk: {
    mine: (mine: number, all: number) => (all ? `Сенің үлесің: сыныптың ${all} соққысының ${mine}` : ''),
    slash: 'бөлшек',
    comma: 'үтір',
    keys: 'Жылдам белгілер',
  },
}

/** Who hit since the last update: the student's own hits carry their name, the class's don't. */
function useHitNames(myHits: number, classHits: number, name: string) {
  const last = useRef({ mine: myHits, all: classHits, names: [] as string[] })
  if (classHits !== last.current.all) {
    const mine = Math.max(0, myHits - last.current.mine)
    const others = Math.max(0, classHits - last.current.all - mine)
    last.current = { mine: myHits, all: classHits, names: [...Array(mine).fill(name), ...Array(others).fill('')] }
  }
  return last.current.names
}

/** The student's battle screen (#/battle): the arena on top, the problem under it. */
export function BattleScreen({ lang }: { lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].battle
  const phone = PHONE_COPY[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myBattle(lang, signal), [lang])
  const { value: battle, setValue, failed } = usePolled(load, STUDENT_POLL_MS, inClass)
  const id = useId()
  const [threeD, setThreeD] = useState(() => import.meta.env.MODE !== 'test' && canRun3D())
  // Kept here: a hit brings a new problem (a fresh form), but "Hit!" should stay visible.
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [misses, setMisses] = useState(0)
  const firstName = user?.displayName.split(' ')[0] ?? ''
  const names = useHitNames(battle?.myHits ?? 0, battle?.classHits ?? 0, firstName)

  const header = (
    <div>
      <h1 className="text-3xl font-black text-ink">{copy.title}</h1>
      <p className="mt-1 font-semibold text-ink/80">{copy.lead}</p>
    </div>
  )
  if (!inClass) return <div className="flex max-w-2xl flex-col gap-4">{header}<p className={CARD}>{copy.noClass}</p></div>
  if (battle === undefined) return <div className="flex max-w-2xl flex-col gap-4">{header}{failed && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}</div>
  if (battle === null) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {header}
        <p className={`${CARD} font-bold`}>{copy.none}</p>
        <a href={SECTION_HREFS.map} className={`${SECONDARY} self-start`}>{copy.back}</a>
      </div>
    )
  }
  const kind = BATTLE_BOSS[battle.topic]
  const dark = kind === 'x-master' ? 'bg-[linear-gradient(160deg,#2a1f6b,#5b3cc4)]' : 'bg-[linear-gradient(160deg,#1f5132,#3f9a4d)]'
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <section aria-labelledby={`${id}-boss`} className="overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_6px_0_var(--shadow-ink)]">
        {threeD && (
          <Suspense fallback={<div className={`h-56 sm:h-64 ${dark}`} />}>
            <BattleArena3D lite kind={kind} topic={battle.topic} hits={battle.classHits} damage={battle.damagePerHit} hp={battle.hp} maxHp={battle.maxHp}
              recent={names} status={battle.status} lang={lang} attackKey={misses} onSlow={() => { markSlow(); setThreeD(false) }} />
          </Suspense>
        )}
        {/* The boss strip: name, HP and the hit counters, compact under the arena. */}
        <div className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${dark} ${threeD ? 'border-t-[3px] border-ink' : ''}`}>
          {!threeD && <BossAvatar kind={kind} shielded={false} hitKey={battle.classHits} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <h2 id={`${id}-boss`} className="text-xl leading-tight font-black text-white sm:text-2xl">{BOSS_COPY[lang].names[kind]}</h2>
              <p className="shrink-0 text-sm font-black text-white tabular-nums" aria-live="polite">{copy.hp(battle.hp, battle.maxHp)}</p>
            </div>
            <div className="mt-1.5"><HpBar hp={battle.hp} max={battle.maxHp} /></div>
            <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-black sm:text-sm">
              <span className="rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-ink">⚔️ {copy.myHits(battle.myHits)}</span>
              <span className="rounded-lg border-2 border-ink bg-white/90 px-2 py-0.5 text-ink">👥 {copy.classHits(battle.classHits)}</span>
            </p>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <Celebration when={battle.status === 'won'} />
          {battle.status === 'won' ? (
            <div className="rounded-xl border-[3px] border-ink bg-emerald-100 p-3 text-emerald-950">
              <p className="text-xl font-black"><span aria-hidden>🏆 </span>{copy.won}</p>
              {battle.myHits > 0 && <p className="mt-1 font-bold">{phone.mine(battle.myHits, battle.classHits)}</p>}
            </div>
          ) : battle.status === 'stopped' ? (
            <p className="rounded-xl bg-sky-100 p-3 font-black">{copy.stopped}</p>
          ) : battle.task && (
            <BattleTaskForm key={battle.task.id} battle={battle} lang={lang} onResult={setValue} feedback={feedback} onFeedback={setFeedback}
              onMiss={() => setMisses((n) => n + 1)} />
          )}
        </div>
      </section>
      <a href={SECTION_HREFS.map} className={`${SECONDARY} self-start`}>{copy.back}</a>
    </div>
  )
}

type Feedback = { status: string; message: string; damage?: number }

function BattleTaskForm({ battle, lang, onResult, feedback, onFeedback: setFeedback, onMiss }: {
  battle: StudentBattle
  lang: Lang
  onResult: (b: StudentBattle) => void
  feedback: Feedback | null
  onFeedback: (f: Feedback) => void
  onMiss: () => void
}) {
  const copy = CLASSROOM_COPY[lang].battle
  const phone = PHONE_COPY[lang]
  const task = battle.task!
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  // Phone keypads have no «/» and sometimes no «,»: one tap adds them.
  const extraKey = task.answerFormat === 'fraction' ? { key: '/', label: phone.slash } : task.answerFormat === 'decimal' ? { key: ',', label: phone.comma } : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !answer.trim()) return
    setBusy(true)
    try {
      const result = await accounts.answerBattle(battle.id, { taskId: task.id, answer, lang })
      setFeedback({ status: result.status, message: result.message, damage: result.damage })
      if (result.status === 'incorrect') { setFlash((n) => n + 1); onMiss() }
      if (result.status !== 'invalid') setAnswer('')
      onResult(result.battle)
    } catch {
      setFeedback({ status: 'invalid', message: copy.error })
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-2.5">
      {flash > 0 && <span key={flash} aria-hidden className="boss-miss-flash pointer-events-none absolute -inset-2 rounded-xl bg-rose-600/25 opacity-0" />}
      <p className="text-xl leading-snug font-extrabold text-ink sm:text-2xl"><RichText text={task.prompt} /></p>
      <label htmlFor={inputId} className="sr-only">{copy.answer}</label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={inputId}
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          inputMode={task.answerFormat === 'fraction' ? 'text' : task.answerFormat === 'decimal' ? 'decimal' : 'numeric'}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={task.answerFormat === 'fraction' ? copy.fractionHint : task.answerFormat === 'decimal' ? copy.decimalHint : copy.wholeHint}
          aria-invalid={feedback?.status === 'incorrect' || undefined}
          className="min-h-14 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-3xl font-bold tabular-nums outline-none placeholder:font-sans placeholder:text-base placeholder:font-semibold focus-visible:ring-4 focus-visible:ring-sun aria-invalid:border-rose-600 aria-invalid:bg-rose-50"
        />
        <button type="submit" disabled={busy || !answer.trim()} className={`${PRIMARY} min-h-14 shrink-0 px-4 text-lg`}>
          {busy ? copy.checking : <><span aria-hidden>⚔️ </span>{copy.hit}</>}
        </button>
      </div>
      {extraKey && (
        <div className="flex gap-2" role="group" aria-label={phone.keys}>
          <button type="button" onClick={() => { setAnswer((a) => (a.includes(extraKey.key) ? a : a + extraKey.key)); input.current?.focus() }}
            className="min-h-10 rounded-xl border-2 border-ink bg-sky-50 px-4 font-mono text-xl font-black text-ink hover:bg-sky" aria-label={extraKey.label}>
            {extraKey.key}
          </button>
        </div>
      )}
      <p aria-live="polite" className="min-h-7">
        {feedback && (
          <span key={`${feedback.status}-${battle.myHits}`} className={`boss-enter inline-flex items-center gap-2 rounded-xl px-3 py-1 text-base font-black ${feedback.status === 'correct' ? 'bg-emerald-100 text-emerald-800' : feedback.status === 'incorrect' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>
            {feedback.message}
          </span>
        )}
      </p>
    </form>
  )
}

/** Class analytics: one click starts a short battle on the topic the class finds hardest. */
export function ReviewBattleButton({ classId, lang, topic }: { classId: number; lang: Lang; topic: BattleTopic }) {
  const copy = CLASSROOM_COPY[lang].board
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function start() {
    setBusy(true)
    setError(false)
    try {
      const board = await accounts.startBattle(classId, { topic, difficulty: 'basic', hp: 300 })
      window.location.hash = battleBoardHref(board.id)
    } catch {
      setError(true)
      setBusy(false)
    }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={start} disabled={busy} className={PRIMARY}>
        <span aria-hidden>⚔️ </span>{copy.reviewBattle(copy.topics[topic])}
      </button>
      <span className="text-sm font-semibold text-ink/75">{copy.reviewBattleHint}</span>
      {error && <p role="alert" className="w-full font-bold text-rose-700">{copy.error}</p>}
    </div>
  )
}

/** Class page: start a battle on the board, or reopen the current one. */
export function BattleLauncher({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].board
  const id = useId()
  const [topic, setTopic] = useState<BattleTopic>('equations')
  const [difficulty, setDifficulty] = useState<BattleDifficulty>('basic')
  const [hp, setHp] = useState(600)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const load = useCallback((signal: AbortSignal) => accounts.currentClassBattle(classId, signal), [classId])
  const { value: current } = usePolled(load, 15000)

  async function launch() {
    setBusy(true)
    setError(false)
    try {
      const board = await accounts.startBattle(classId, { topic, difficulty, hp })
      window.location.hash = battleBoardHref(board.id)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  const choice = (selected: boolean) =>
    `min-h-11 rounded-xl border-[3px] border-ink px-3 text-sm font-black shadow-[0_3px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${selected ? 'translate-y-[2px] bg-sun shadow-[0_1px_0_var(--shadow-ink)]' : 'bg-white hover:bg-sky'}`
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>⚔️</span>{copy.start}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.startLead}</p>
      {current?.status === 'active' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 p-3">
          <p className="flex-1 font-bold text-ink">{copy.current(current.hp, current.maxHp)}</p>
          <a href={battleBoardHref(current.id)} className={PRIMARY}>{copy.open} →</a>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-3">
        <fieldset>
          <legend className="mb-1.5 text-sm font-black text-ink/80">{copy.topic}</legend>
          <div className="flex flex-wrap gap-2">
            {BATTLE_TOPICS.map((t) => (
              <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)} className={choice(topic === t)}>{copy.topics[t]}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-black text-ink/80">{copy.difficulty}</legend>
          <div className="flex flex-wrap gap-2">
            {(['basic', 'intermediate', 'advanced'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} className={choice(difficulty === d)}>{copy.difficulties[d]}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-black text-ink/80">{copy.hp}</legend>
          <div className="flex flex-wrap gap-2">
            {[300, 600, 1000].map((value) => (
              <button key={value} type="button" aria-pressed={hp === value} onClick={() => setHp(value)} className={choice(hp === value)}>
                {value} HP <span className="font-semibold text-ink/70">· {copy.hpHint(value)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={launch} disabled={busy} className={`${PRIMARY} self-start`}>
          <span aria-hidden>⚔️ </span>{copy.launch}
        </button>
        {error && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}
      </div>
    </section>
  )
}

/** The class board (#/teacher/battle/{id}): big boss, HP, join instructions, live hits. */
export function BattleBoardScreen({ battleId, lang }: { battleId: string; lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].board
  const load = useCallback((signal: AbortSignal) => accounts.battleBoard(battleId, signal), [battleId])
  const [finished, setFinished] = useState(false)
  const { value: board, setValue, failed } = usePolled<BattleBoard>(load, BOARD_POLL_MS, !finished)
  const root = useRef<HTMLDivElement>(null)
  const [threeD, setThreeD] = useState(() => import.meta.env.MODE !== 'test' && canRun3D())

  useEffect(() => {
    if (board && board.status !== 'active') setFinished(true)
  }, [board])

  if (!board) return failed ? <p role="alert" className="font-bold text-rose-700">{copy.error}</p> : null
  const kind = BATTLE_BOSS[board.topic]
  const battleUrl = `${window.location.origin}${window.location.pathname}${joinHref(board.classCode, 'battle')}`
  return (
    <div ref={root} className="flex flex-col gap-4 bg-[var(--color-sky,#eef4ff)] p-1">
      <section className={`overflow-hidden rounded-3xl border-[4px] border-ink text-white shadow-[0_8px_0_var(--shadow-ink)] ${kind === 'x-master' ? 'bg-[linear-gradient(160deg,#1d1450,#5b3cc4)]' : 'bg-[linear-gradient(160deg,#14361f,#3f9a4d)]'} ${board.status === 'active' ? 'boss-arena' : ''}`}>
        {threeD && (
          <Suspense fallback={<div className="h-[46vh] min-h-72" />}>
            <BattleArena3D kind={kind} topic={board.topic} hits={board.hits} damage={board.damagePerHit} hp={board.hp} maxHp={board.maxHp}
              recent={board.recent.map((h) => h.name)} status={board.status} lang={lang} top={board.top.slice(0, 3).map((f) => f.name)} autoAttack onSlow={() => { markSlow(); setThreeD(false) }} />
          </Suspense>
        )}
        <div className={`flex flex-col items-center gap-5 p-5 sm:flex-row ${threeD ? 'border-t-4 border-ink sm:py-5' : 'sm:p-8'}`}>
          {!threeD && <BossAvatar kind={kind} shielded={false} hitKey={board.hits} big />}
          <div className="w-full min-w-0 flex-1">
            <p className="text-sm font-black tracking-wide text-sun uppercase">{board.className} · {copy.topics[board.topic]}</p>
            <h1 className="text-4xl font-black sm:text-6xl">{BOSS_COPY[lang].names[kind]}</h1>
            <p className="mt-2 mb-2 text-2xl font-black tabular-nums sm:text-4xl" aria-live="polite">{board.hp} / {board.maxHp} HP</p>
            <HpBar hp={board.hp} max={board.maxHp} big />
            <p className="mt-3 flex flex-wrap gap-2 text-base font-black sm:text-xl">
              <span className="rounded-xl bg-white/15 px-3 py-1">⚔️ {copy.hits(board.hits)}</span>
              <span className="rounded-xl bg-white/15 px-3 py-1">👥 {copy.fighters(board.fighters)}</span>
            </p>
          </div>
        </div>
        <Celebration when={board.status === 'won'} />
        {board.status === 'won' && (
          <p className="border-t-4 border-ink bg-sun p-4 text-center text-3xl font-black text-ink sm:text-5xl"><span aria-hidden>🏆 </span>{copy.won}</p>
        )}
        {board.status === 'stopped' && <p className="border-t-4 border-ink bg-white p-3 text-center text-xl font-black text-ink">{copy.stopped}</p>}
      </section>

      {board.status === 'active' && (
        <section className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-ink bg-sun p-4 text-ink sm:flex-row sm:p-5">
          <QrCode value={battleUrl} label={copy.qrLabel} className="size-44 shrink-0 border-[3px] border-ink p-1 sm:size-52" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-2xl font-black sm:text-3xl">{copy.qrTitle}</p>
            <p className="mt-1 text-lg font-bold sm:text-xl">{copy.join(board.classCode)}</p>
            <p className="mt-2 font-mono text-base font-bold break-all opacity-80 sm:text-lg">{battleUrl}</p>
          </div>
        </section>
      )}

      {board.status === 'active' && <Lobby classId={board.classId} present={board.present} lang={lang} />}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={CARD}>
          <h2 className="text-xl font-black">{copy.top}</h2>
          {board.top.length === 0 ? <p className="mt-2 font-bold text-ink/70">{copy.noHits}</p> : (
            <ol className="mt-2 flex flex-col gap-1.5">
              {board.top.map((f, i) => (
                <li key={f.name} className="flex items-center gap-2 text-lg font-black">
                  <span aria-hidden className="w-8 text-center">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="tabular-nums">{copy.hits(f.hits)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className={CARD}>
          <h2 className="text-xl font-black">{copy.recent}</h2>
          {board.recent.length === 0 ? <p className="mt-2 font-bold text-ink/70">{copy.noHits}</p> : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {board.recent.map((h, i) => (
                <li key={`${h.at}-${h.name}`} className={`flex items-center gap-2 text-lg font-bold ${i === 0 ? 'boss-enter' : ''}`}>
                  <span aria-hidden>💥</span><span className="flex-1 truncate">{h.name}</span>
                  <span className="font-black text-rose-600">−{board.damagePerHit} HP</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {board.status === 'active' ? (
          <button type="button" className={SECONDARY} onClick={() => accounts.stopBattle(board.id).then(setValue, () => {})}>{copy.stop}</button>
        ) : null}
        <a href={teacherClassHref(board.classId)} className={SECONDARY}>{copy.back}</a>
        {document.fullscreenEnabled && (
          <button type="button" className={SECONDARY} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch(() => {})}>
            {copy.fullscreen}
          </button>
        )}
      </div>
    </div>
  )
}

