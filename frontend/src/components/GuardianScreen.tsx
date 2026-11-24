import { useEffect, useId, useRef, useState } from 'react'
import type { CheckStatus, Lang } from '../api/types'
import type { GuardianRound, useGuardianChallenge } from '../guardian'
import { GUARDIAN_SETUP } from '../guardianAssignment'
import { STRINGS } from '../i18n'
import { SECTION_HREFS } from '../route'
import { FAIR_FINALE_ID } from '../rewards'
import { FinaleRewardNotes } from './FinaleRewardNotes'
import { RichText } from './RichText'
import { PifikSprite } from './PifikSprite'

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink px-4 py-2 text-center font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:shadow-none'
const CARD = 'rounded-[28px] border-[3px] border-ink bg-white p-4 shadow-[0_6px_0_var(--shadow-ink)] sm:p-6'

type Challenge = ReturnType<typeof useGuardianChallenge>
/** `lit`: a lantern lights up; `notYet`: the Keeper gently shakes his head; `open`: the arch opens. */
type ArchMove = 'lit' | 'notYet' | 'open'
type ArchAnimation = { id: number; move: ArchMove; phase: GuardianRound['id']; playing: boolean }
const ARCH_ANIMATION_MS = 1100

/** The fair arch: Pifik lights one lantern per solved round while the friendly Fair Keeper watches. */
function GuardianArena({ lang, lit, total, phase, animation }: {
  lang: Lang
  lit: number
  total: number
  phase: GuardianRound['id'] | 'won'
  animation?: ArchAnimation
}) {
  const t = STRINGS[lang]
  const move = animation?.playing ? animation.move : undefined
  return (
    <div className="guardian-arena mt-3 rounded-2xl border-[3px] border-ink" data-phase={phase}
      data-move-phase={animation?.playing ? animation.phase : undefined}>
      <div key={animation?.id} className="guardian-stage" data-move={move} aria-hidden="true">
        <PifikSprite eager className="guardian-hero" />
        <div className="guardian-energy" />
        <div className="guardian-arch">
          <div className="guardian-gate"><i /><i /></div>
          <div className="guardian-lanterns">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="guardian-lantern" data-lit={i < lit} data-new={move !== undefined && move !== 'notYet' && i === lit - 1} />
            ))}
          </div>
          {phase === 'won' && <span className="guardian-confetti">🎉</span>}
        </div>
        <div className="guardian-keeper">
          <div className="guardian-mask"><i /><i /></div>
        </div>
      </div>
      <div className="relative px-3 pb-3 text-white">
        <p className="font-black">{t.guardian.name}</p>
        <p className="text-sm font-bold">{t.guardian.progress(lit, total)}</p>
        <div role="progressbar" aria-label={t.guardian.progress(lit, total)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={lit}
          className="mt-1 h-3 overflow-hidden rounded-lg bg-slate-950">
          <div className="guardian-hp h-full bg-sun" style={{ width: `${(lit / total) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function RoundExercise({ lang, index, round, submit }: {
  lang: Lang
  index: number
  round: GuardianRound
  submit: Challenge['submit']
}) {
  const t = STRINGS[lang]
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckStatus | null>(null)
  const [showHint, setShowHint] = useState(false)
  const inputId = useId()
  const hintId = useId()

  return (
    <>
      <p className="mt-2 font-semibold text-ink sm:text-lg"><RichText text={round.text[lang].prompt} /></p>
      <form className="mt-4" onSubmit={event => {
        event.preventDefault()
        if (!value.trim()) return
        const status = submit(index, value)
        if (status && status !== 'correct') setResult(status)
      }}>
        <label className="mb-1 block text-sm font-black" htmlFor={inputId}>{t.answerLabel}</label>
        <div className="flex flex-wrap gap-2">
          <input
            id={inputId}
            value={value}
            maxLength={256}
            onChange={event => setValue(event.target.value)}
            placeholder={round.kind === 'fraction' ? t.answerPlaceholder : t.wholeNumberPlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink px-2 font-mono focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <button type="submit" className={`${BUTTON} bg-sun`} disabled={!value.trim()}>{t.check}</button>
        </div>
      </form>
      <div role="status" className="mt-2 text-sm font-bold text-ink">
        {result === 'incorrect' && <p className="rounded-xl bg-rose-50 p-2">{t.guardian.wrong}</p>}
        {result === 'invalid' && (
          <p className="rounded-xl bg-sun/25 p-2">
            {round.kind === 'fraction' ? t.guardian.invalidFraction : t.guardian.invalidNumber}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-expanded={showHint}
        aria-controls={hintId}
        onClick={() => setShowHint(!showHint)}
        className={`${BUTTON} mt-3 bg-white`}
      >
        {t.askHint}
      </button>
      <div id={hintId} hidden={!showHint} className="mt-3 rounded-xl border-2 border-ink bg-sky p-3">
        <p className="text-xs font-black text-brand-dark">{t.pifikName}</p>
        <p className="mt-1 text-sm font-semibold"><RichText text={round.text[lang].hint} /></p>
      </div>
    </>
  )
}

export default function GuardianScreen({ lang, remaining, challenge, assigned = false }: {
  lang: Lang
  remaining: number
  challenge: Challenge
  assigned?: boolean
}) {
  const t = STRINGS[lang]
  const c = t.guardian
  const copy = GUARDIAN_SETUP[lang]
  const { run, rounds, submit, replay } = challenge
  const total = rounds.length
  const roundHeading = useRef<HTMLHeadingElement>(null)
  const lastRound = useRef(run.cleared)
  const [animation, setAnimation] = useState<ArchAnimation>()
  const submitRound: Challenge['submit'] = (index, value) => {
    const result = submit(index, value)
    if (result === 'correct' || result === 'incorrect') {
      const move = result === 'incorrect' ? 'notYet' : index === total - 1 ? 'open' : 'lit'
      setAnimation(previous => ({
        id: (previous?.id ?? 0) + 1, move, phase: rounds[index].id, playing: true,
      }))
    } else if (result === 'invalid') {
      setAnimation(undefined)
    }
    return result
  }
  const current = rounds[run.cleared]
  const icons = { pizzas: '🍕', prize: '🏷️', map: '🗺️' }

  useEffect(() => {
    if (!animation?.playing) return
    const timeout = window.setTimeout(() => {
      setAnimation(previous => previous?.id === animation.id ? { ...previous, playing: false } : previous)
    }, ARCH_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [animation])

  useEffect(() => {
    if (lastRound.current !== run.cleared) {
      lastRound.current = run.cleared
      roundHeading.current?.focus({ preventScroll: true })
    }
  }, [run.cleared])

  const catalog = <a href={SECTION_HREFS.map} className={`${BUTTON} bg-white`}><span aria-hidden>←&nbsp;</span>{t.fairRoute.title}</a>
  if (remaining > 0) {
    return (
      <section className={`mx-auto max-w-2xl ${CARD}`}>
        <h1 className="text-2xl font-black text-ink">{c.title}</h1>
        <p className="mt-2 font-semibold">{c.locked}</p>
        <p className="mt-2 font-black text-brand-dark">{c.remaining(remaining)}</p>
        <div className="mt-4">{catalog}</div>
      </section>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{c.title}</h1>
        {assigned && <p className="font-bold text-brand-dark">{copy.task}</p>}
        <p className="mt-2 text-sm font-semibold sm:text-base">{assigned ? copy.lead : c.intro}</p>
        <GuardianArena lang={lang} lit={run.cleared} total={total} phase={current?.id ?? 'won'} animation={animation} />
        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-bold sm:text-sm">
          {rounds.map((round, index) => {
            const cleared = index < run.cleared
            const active = index === run.cleared
            return (
              <li key={round.id} aria-current={active ? 'step' : undefined} className={`rounded-xl border-2 border-ink p-1.5 ${cleared ? 'bg-emerald-100' : active ? 'bg-sun' : 'bg-sky-100'}`}>
                <p className="font-black"><span aria-hidden="true">{icons[round.id]} </span>{round.text[lang].title}</p>
                <p>{cleared ? c.cleared : active ? c.active : c.upcoming}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className={CARD}>
        <h2 ref={roundHeading} tabIndex={-1} className="text-xl font-black text-ink">
          {current ? c.round(run.cleared + 1, total) : c.victory}
        </h2>
        <div role="status">
          {animation && animation.move !== 'notYet' && (
            <p className="mt-2 w-fit rounded-lg bg-emerald-100 px-2 py-1 text-sm font-bold text-emerald-950">
              <span aria-hidden>💡 </span>{c.hit} · {c.progress(run.cleared, total)}
            </p>
          )}
        </div>
        {current ? (
          <>
            <RoundExercise key={`${run.variant}-${current.id}`} lang={lang} index={run.cleared} round={current} submit={submitRound} />
            {challenge.boosts && (
              <fieldset className="mt-4 grid gap-2">
                <legend className="font-black">{copy.powers}</legend>
                {(['example', 'plan'] as const).map((id) => (
                  <div key={id}>
                    <button type="button" className={`${BUTTON} bg-white`} disabled={run.used[id] !== undefined} onClick={() => challenge.useBoost(id, run.cleared)}>
                      {copy[id]}{run.used[id] !== undefined ? ` · ${copy.used}` : ''}
                    </button>
                    {run.used[id] === run.cleared && <p role="status" className="mt-2 rounded-xl bg-sky p-2 font-semibold">
                      {id === 'example' ? copy.examples[current.id] : copy.plans[current.id]}
                    </p>}
                  </div>
                ))}
              </fieldset>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 font-semibold">{assigned ? copy.finished : c.victoryText}</p>
            {!assigned && <FinaleRewardNotes lang={lang} progressId={FAIR_FINALE_ID} />}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setAnimation(undefined); replay() }} className={`${BUTTON} bg-sun`}>{c.replay}</button>
              {catalog}
            </div>
          </>
        )}
      </section>
      {current && <div>{catalog}</div>}
    </div>
  )
}
