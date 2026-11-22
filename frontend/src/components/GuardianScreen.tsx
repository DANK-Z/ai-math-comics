import { useEffect, useId, useRef, useState } from 'react'
import type { CheckStatus, Lang } from '../api/types'
import { DAMAGE_PER_ROUND, type GuardianRound, type useGuardianChallenge } from '../guardian'
import { GUARDIAN_SETUP } from '../guardianAssignment'
import { STRINGS } from '../i18n'
import { SECTION_HREFS } from '../route'
import { RichText } from './RichText'
import { PifikSprite } from './PifikSprite'

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink px-4 py-2 text-center font-black text-ink shadow-[0_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:shadow-none'
const CARD = 'rounded-[28px] border-[3px] border-ink bg-white p-4 shadow-[0_6px_0_var(--color-ink)] sm:p-6'

type Challenge = ReturnType<typeof useGuardianChallenge>

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
  const hpId = useId()
  const maxHp = rounds.length * DAMAGE_PER_ROUND
  const hp = maxHp - run.cleared * DAMAGE_PER_ROUND
  const current = rounds[run.cleared]
  const art = {
    pizzas: { icon: '🍕', background: 'bg-orange-100' },
    prize: { icon: '🏷️', background: 'bg-amber-100' },
    map: { icon: '🗺️', background: 'bg-sky-100' },
  }
  const phaseArt = current ? art[current.id] : { icon: '🏆', background: 'bg-emerald-100' }

  useEffect(() => {
    if (lastRound.current !== run.cleared) {
      lastRound.current = run.cleared
      roundHeading.current?.focus({ preventScroll: true })
    }
  }, [run.cleared])

  const catalog = <a href={SECTION_HREFS.comics} className={`${BUTTON} bg-white`}>{t.backToCatalog}</a>
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
        <div className="mt-3 flex items-center gap-3">
          <PifikSprite eager className="w-16 shrink-0 rounded-2xl border-[3px] border-ink bg-sky sm:w-24" />
          <div className="min-w-0">
            <p className="text-lg font-black text-brand-dark">{c.name}</p>
            <p className="text-sm font-semibold sm:text-base">{assigned ? copy.lead : c.intro}</p>
          </div>
        </div>
        <p id={hpId} aria-live="polite" className="mt-3 font-black">{c.hp(hp, maxHp)}</p>
        <progress aria-labelledby={hpId} max={maxHp} value={hp} className="mt-1 block h-3 w-full accent-brand" />
        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-bold sm:text-sm">
          {rounds.map((round, index) => {
            const cleared = index < run.cleared
            const active = index === run.cleared
            return (
              <li key={round.id} aria-current={active ? 'step' : undefined} className={`rounded-xl border-2 border-ink p-1.5 ${cleared ? 'bg-emerald-100' : active ? 'bg-sun' : 'bg-sky-100'}`}>
                <p className="font-black">{round.text[lang].title}</p>
                <p>{cleared ? c.cleared : active ? c.active : c.upcoming}</p>
              </li>
            )
          })}
        </ol>
        <div className={`mt-4 flex min-h-16 items-center justify-center gap-3 rounded-xl border-2 border-ink p-2 text-center font-black ${phaseArt.background}`}>
          <span aria-hidden="true" className="text-3xl">{phaseArt.icon}</span>
          {current ? current.text[lang].title : c.victory}
        </div>
      </section>

      <section className={CARD}>
        <h2 ref={roundHeading} tabIndex={-1} className="text-xl font-black text-ink">
          {current ? c.round(run.cleared + 1, total) : c.victory}
        </h2>
        {current ? (
          <>
            <RoundExercise key={`${run.variant}-${current.id}`} lang={lang} index={run.cleared} round={current} submit={submit} />
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
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={replay} className={`${BUTTON} bg-sun`}>{c.replay}</button>
              {catalog}
            </div>
          </>
        )}
      </section>
      {current && <div>{catalog}</div>}
    </div>
  )
}
