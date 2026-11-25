import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Celebration } from './Celebration'
import type { Boss, BossKind, BossRound, CheckResponse, Lang, Reward } from '../api'
import { useAccount } from '../account'
import { BOSS_COPY } from '../boss'
import { useAnswerCheck } from '../hooks'
import { STRINGS } from '../i18n'
import { RichText } from './RichText'
import { EmotionAvatar } from './EmotionAvatar'
import { TriumphModal } from './TriumphModal'

// Panel four of a generated comic as a boss fight: three server-owned rounds,
// each correct answer deals maxHp / rounds damage. Radii follow 16 / 12 / 8.

const HIT_MS = 900
const MISS_SHAKE_MS = 320

function SlimeArt() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-full">
      <path d="M8 52c0-18 9-36 24-36s24 18 24 36c0 4-4 6-8 6H16c-4 0-8-2-8-6z" fill="#7ad34f" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M18 28c2-6 6-9 10-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
      <circle cx="24" cy="36" r="5" fill="#fff" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="40" cy="36" r="5" fill="#fff" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="25" cy="37" r="2.2" fill="var(--color-ink)" />
      <circle cx="41" cy="37" r="2.2" fill="var(--color-ink)" />
      <path d="M26 47q6 4 12 0" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* A pizza-slice crown: this slime hoards unfair shares. */}
      <path d="M26 17l6-13 6 13z" fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="31" cy="11" r="1.6" fill="#e2553b" />
      <circle cx="34" cy="14" r="1.4" fill="#e2553b" />
    </svg>
  )
}

export function BossAvatar({ kind, shielded, hitKey, big = false }: { kind: BossKind; shielded: boolean; hitKey: number; big?: boolean }) {
  return (
    <span
      key={hitKey}
      data-idle={hitKey === 0 || undefined}
      aria-hidden
      className={`boss-hit relative grid shrink-0 place-items-center rounded-2xl border-[3px] border-ink ${big ? 'size-32 sm:size-44' : 'size-20 sm:size-24'} ${
        kind === 'x-master' ? (big ? 'bg-violet-200 text-7xl sm:text-8xl' : 'bg-violet-200 text-5xl sm:text-6xl') : 'bg-lime-100 p-1.5'
      } ${shielded ? 'boss-shield' : ''}`}
    >
      {kind === 'x-master' ? '🧙' : <SlimeArt />}
      {kind === 'x-master' && (
        <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-lg border-2 border-ink bg-sun font-mono text-lg font-black text-ink">x</span>
      )}
    </span>
  )
}

function RoundForm({ round, lang, active, onHit, onMiss }: { round: BossRound; lang: Lang; active: boolean; onHit: (response: CheckResponse) => void; onMiss: () => void }) {
  const t = STRINGS[lang]
  const copy = BOSS_COPY[lang]
  const [answer, setAnswer] = useState('')
  const [draft, setDraft] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const awaiting = useRef(false)
  const check = useAnswerCheck(round.exerciseId, lang, onHit)
  const { result, checking, error, submit, solved } = check
  const wrong = !checking && !!result && result.status !== 'correct'

  // A miss marks the field red and hands focus back, like the My Story form.
  // Count it once per submitted answer (a language switch re-checks without a new answer).
  useEffect(() => {
    if (!wrong) return
    input.current?.focus()
    if (awaiting.current) {
      awaiting.current = false
      onMiss()
    }
  }, [wrong, result, onMiss])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (answer.trim() && !checking && !solved) {
      awaiting.current = true
      submit(answer.trim())
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <p className="text-lg leading-snug font-bold text-ink">
        <RichText text={round.prompt} />
      </p>
      <label htmlFor={inputId} className="mt-1 text-sm font-black text-ink/80">{copy.answerLabel}</label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          id={inputId}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={round.answerFormat === 'whole-number' ? t.wholeNumberPlaceholder : t.answerPlaceholder}
          inputMode={round.answerFormat === 'whole-number' ? 'numeric' : 'text'}
          autoComplete="off"
          disabled={solved}
          aria-invalid={wrong || undefined}
          aria-describedby={wrong ? `${inputId}-result` : undefined}
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-2xl font-bold tabular-nums outline-none placeholder:font-sans placeholder:text-base placeholder:font-semibold focus-visible:ring-4 focus-visible:ring-sun disabled:bg-stone-100 aria-invalid:border-rose-600 aria-invalid:bg-rose-50 aria-invalid:focus-visible:ring-rose-300"
        />
        {active && (
          <VoiceAnswer key={lang} lang={lang} kind={round.answerFormat === 'whole-number' ? 'equation' : 'fraction'}
            inputId={inputId} disabled={solved || checking} onAnswer={(value) => {
              setAnswer(value)
              input.current?.focus()
            }} />
        )}
        <button
          type="submit"
          disabled={!answer.trim() || checking || solved}
          className="min-h-12 w-full shrink-0 rounded-xl border-[3px] border-ink bg-sun px-5 text-lg font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none min-[390px]:w-auto"
        >
          {checking ? t.checking : t.check}
        </button>
      </div>
      <div>
        <button
          type="button"
          aria-expanded={draftOpen}
          aria-controls={`${inputId}-draft`}
          onClick={() => setDraftOpen(!draftOpen)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-dashed border-ink/60 bg-white px-3 text-sm font-black text-ink hover:border-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span aria-hidden>✏️</span>{copy.draft}<span aria-hidden className="text-xs">{draftOpen ? '▲' : '▼'}</span>
        </button>
        <textarea
          id={`${inputId}-draft`}
          hidden={!draftOpen}
          aria-label={copy.draftLabel}
          value={draft}
          rows={3}
          maxLength={500}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={copy.draftPlaceholder}
          className="mt-2 w-full resize-y rounded-xl border-2 border-dashed border-ink/60 bg-[repeating-linear-gradient(#fff_0_27px,#dbe6ff_27px_28px)] px-3 py-1.5 font-mono text-base leading-7 text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink/50 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand"
        />
      </div>
      <div id={`${inputId}-result`} aria-live="polite" className="min-h-6">
        {error && <p className="font-bold text-rose-700">{t.checkError}</p>}
        {wrong && !error && (
          <p className="rounded-lg border-2 border-rose-600 bg-rose-50 px-3 py-2 font-semibold text-rose-950">
            <span aria-hidden className="font-black">{result.status === 'invalid' ? '! ' : '✗ '}</span>
            <RichText text={result.message} />
          </p>
        )}
      </div>
    </form>
  )
}

interface Props {
  boss: Boss
  active: boolean
  lang: Lang
  cleared: number
  onRoundCleared: () => void
  /** Wrong or unreadable answers so far (saved with the fight progress). */
  misses: number
  onMiss: () => void
  /** Go to the panel after the boss (shown on the victory screen). */
  onReadOn?: () => void
}

export function BossFight({ boss, lang, active, cleared, onRoundCleared, misses, onMiss, onReadOn }: Props) {
  const copy = BOSS_COPY[lang]
  const character = boss.character
  const name = character?.name ?? copy.names[boss.kind]
  const total = boss.rounds.length
  const damage = Math.round(boss.maxHp / total)
  const [hit, setHit] = useState<{ round: number; at: number } | null>(null)
  const [triumph, setTriumph] = useState(false)
  const [reward, setReward] = useState<Reward | null>(null)
  const [missedRound, setMissedRound] = useState<string | null>(null)
  // A miss is the boss's counter-attack: a short red flash and shake of the arena.
  const [missCount, setMissCount] = useState(0)
  const [shaking, setShaking] = useState(false)
  useEffect(() => {
    if (!missCount) return
    const timer = setTimeout(() => setShaking(false), MISS_SHAKE_MS)
    return () => clearTimeout(timer)
  }, [missCount])
  const { setCoins } = useAccount()
  const hpId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  // While a hit plays, the bar already shows the new HP but the next round waits.
  const shownCleared = hit ? hit.round + 1 : cleared
  const hp = Math.max(0, boss.maxHp - shownCleared * damage)
  const defeated = cleared >= total
  const round = boss.rounds[Math.min(cleared, total - 1)]
  const miss = useCallback(() => {
    setMissedRound(round.exerciseId)
    setMissCount((n) => n + 1)
    setShaking(true)
    onMiss()
  }, [onMiss, round.exerciseId])

  const onHit = useCallback(
    (response: CheckResponse) => {
      setHit({ round: cleared, at: Date.now() })
      // The server pays a signed-in student once, on the answer that beats the boss.
      if (response.reward) {
        setReward(response.reward)
        setCoins(response.reward.totalCoins)
      }
    },
    [cleared, setCoins],
  )

  useEffect(() => {
    if (!hit) return
    const timer = setTimeout(() => {
      setHit(null)
      onRoundCleared()
      if (hit.round === total - 1) setTriumph(true)
    }, HIT_MS)
    return () => clearTimeout(timer)
  }, [hit, onRoundCleared, total])

  useEffect(() => {
    if (active && cleared > 0) heading.current?.focus({ preventScroll: true })
  }, [active, cleared])

  return (
    <section
      aria-labelledby={`${hpId}-title`}
      className={`${shaking ? 'boss-miss-shake' : 'boss-enter'} relative overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_6px_0_var(--shadow-ink)]`}
    >
      {shaking && (
        <span key={missCount} aria-hidden className="boss-miss-flash pointer-events-none absolute inset-0 z-10 bg-rose-600/30 opacity-0" />
      )}
      <div className={`relative p-4 sm:p-5 ${boss.kind === 'x-master' ? 'bg-[linear-gradient(160deg,#2a1f6b,#5b3cc4)]' : 'bg-[linear-gradient(160deg,#1f5132,#3f9a4d)]'}`}>
        <p className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black tracking-wide text-ink uppercase">
          <span aria-hidden>⚔️</span>{copy.arena}
        </p>
        <div className="mt-3 flex items-center gap-4">
          {!character && <BossAvatar kind={boss.kind} shielded={!defeated && boss.kind === 'x-master'} hitKey={hit?.at ?? 0} />}
          <div className="min-w-0">
            <h2 id={`${hpId}-title`} ref={heading} tabIndex={-1} className="text-2xl font-black text-white outline-none sm:text-3xl">
              {name}
            </h2>
            <p data-dialogue-emotion={!defeated && missedRound === round.exerciseId ? 'angry' : undefined}
              className={`mt-1 text-sm font-semibold text-white/90 sm:text-base ${!defeated && missedRound === round.exerciseId ? 'comic-bubble border-2 border-white/40 px-2 py-1 font-black' : ''}`}>
              {defeated ? (character?.farewell ?? copy.defeatedText[boss.kind]) : (character?.introduction ?? copy.taunts[boss.kind])}
            </p>
          </div>
        </div>

        <p id={hpId} aria-live="polite" className="mt-4 flex items-center justify-between gap-2 text-sm font-black text-white">
          <span>{copy.hp(hp, boss.maxHp)}</span>
          {hit && <span className="boss-damage rounded-lg bg-rose-600 px-2 py-0.5 text-white">−{damage} HP</span>}
        </p>
        <div
          role="progressbar"
          aria-labelledby={hpId}
          aria-valuemin={0}
          aria-valuemax={boss.maxHp}
          aria-valuenow={hp}
          className="mt-1.5 h-5 overflow-hidden rounded-lg border-[3px] border-ink bg-ink/60"
        >
          <div
            className="h-full rounded-r-md bg-[linear-gradient(180deg,#ff7a7a,#e11d48)] transition-[width] duration-700 ease-out"
            style={{ width: `${(hp / boss.maxHp) * 100}%` }}
          />
        </div>

        <ol className="mt-3 grid gap-1.5 text-center text-xs font-bold sm:text-sm" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {boss.rounds.map((r, index) => {
            const done = index < shownCleared
            const active = index === shownCleared
            return (
              <li key={r.exerciseId} aria-current={active ? 'step' : undefined} className={`rounded-lg border-2 border-ink px-1 py-1 text-ink ${done ? 'bg-emerald-200' : active ? 'bg-sun' : 'bg-white/85'}`}>
                <span aria-hidden>{done ? '✓ ' : ''}</span>
                {done ? copy.status.cleared : active ? copy.status.active : copy.status.upcoming}
              </li>
            )
          })}
        </ol>
      </div>

      <Celebration when={defeated} />
      <div className="bg-cream p-4 sm:p-5">
        {defeated ? (
          <div className="flex items-center gap-3">
            <EmotionAvatar speaker="Пифик" emotion="happy" className="w-11 bg-white" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black text-ink">{copy.defeated}</p>
              <p className="font-semibold text-ink/80">{copy.readOn} <span aria-hidden>→</span></p>
            </div>
            <button
              type="button"
              onClick={() => setTriumph(true)}
              className="min-h-11 shrink-0 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {copy.triumph.reopen}
            </button>
          </div>
        ) : hit ? (
          <p role="status" className="rounded-lg border-2 border-emerald-700 bg-emerald-50 px-3 py-3 font-black text-emerald-950">
            <span aria-hidden>💥 </span>{character ? copy.characterHit(damage) : copy.hit[boss.kind](damage)}
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <EmotionAvatar speaker="Пифик" emotion={missedRound === round.exerciseId ? 'confused' : 'neutral'} className="w-10 bg-white" />
              <p className="text-sm font-black text-brand-dark">{copy.round(cleared + 1, total)}</p>
            </div>
            <RoundForm key={round.exerciseId} round={round} lang={lang} active={active} onHit={onHit} onMiss={miss} />
          </>
        )}
      </div>
      <TriumphModal
        open={active && triumph}
        name={name}
        lang={lang}
        rounds={total}
        misses={reward?.misses ?? misses}
        reward={reward}
        onClose={() => setTriumph(false)}
        onReadOn={
          onReadOn &&
          (() => {
            setTriumph(false)
            onReadOn()
          })
        }
      />
    </section>
  )
}
import { VoiceAnswer } from './VoiceAnswer'
