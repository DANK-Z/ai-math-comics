import { useEffect, useId, useRef, useState } from 'react'
import type { CheckStatus, Lang } from '../api/types'
import { PORTRAITS } from '../art/sheet'
import { STRINGS } from '../i18n'
import { MOTION_COPY } from '../motionLeague'
import { ROAD_COPY, ROAD_DAMAGE, ROAD_MAX_HP, ROAD_ROUNDS, type RoadPhase, type useRoadGuardian } from '../roadGuardian'
import gate1 from '../assets/roads/gate-1.webp'
import gate2 from '../assets/roads/gate-2.webp'
import gate3 from '../assets/roads/gate-3.webp'
import gate4 from '../assets/roads/gate-4.webp'
import { findOperation, operationHref } from '../operations'
import { SECTION_HREFS } from '../route'
import { RichText } from './RichText'
import { SheetCrop } from './SheetCrop'

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink px-4 py-2 text-center font-black text-ink shadow-[0_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:shadow-none'
const CARD = 'rounded-[28px] border-[3px] border-ink p-4 shadow-[0_6px_0_var(--color-ink)] sm:p-6'
const CHIP = 'rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-ink sm:text-xs'

type Challenge = ReturnType<typeof useRoadGuardian>

/** The finish gates: one lamp lights up per cleared phase, and the gates open on victory. */
const GATES = [gate1, gate2, gate3, gate4]
const GATE_COPY = {
  ru: (lit: number) => lit >= 3 ? 'Все три фонаря горят — ворота открыты!' : `Фонари на воротах: ${lit} из 3`,
  kk: (lit: number) => lit >= 3 ? 'Үш шам да жанып тұр — қақпа ашық!' : `Қақпадағы шамдар: ${lit} / 3`,
}

function FinishGates({ lit, lang }: { lit: number; lang: Lang }) {
  const caption = GATE_COPY[lang](lit)
  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border-[3px] border-ink bg-ink">
      <div className="relative" style={{ aspectRatio: '827 / 463' }}>
        {GATES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={i === Math.min(lit, 3) ? caption : ''}
            aria-hidden={i !== Math.min(lit, 3)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === Math.min(lit, 3) ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>
      <figcaption aria-live="polite" className="bg-sun px-3 py-1.5 text-center text-sm font-black text-ink">
        <span aria-hidden>{'💡'.repeat(Math.min(lit, 3))}{'⚪'.repeat(3 - Math.min(lit, 3))} </span>{caption}
      </figcaption>
    </figure>
  )
}

/** The Guardian: a clockwork robot on wheels. */
function BossIcon({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`relative grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-rose-200 text-2xl sm:size-14 sm:text-3xl ${className}`}>
      🤖
      <span className="absolute -right-1.5 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-ink bg-sun text-sm">⏱️</span>
    </span>
  )
}

function PlayerIcon({ className = '' }: { className?: string }) {
  return <SheetCrop rect={PORTRAITS.aldiyar} eager className={`size-12 shrink-0 rounded-full border-[3px] border-ink bg-white sm:size-14 ${className}`} />
}

function Road({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-28 overflow-hidden rounded-2xl border-[3px] border-ink bg-slate-600 sm:h-32">
      <div aria-hidden className="road-dash absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#fff_0_26px,transparent_26px_48px)] [background-size:48px_100%]" />
      {children}
    </div>
  )
}

/** Phase picture: the health bar becomes a road (or a river) for each kind of motion. */
function PhaseScene({ phase, lang }: { phase: RoadPhase; lang: Lang }) {
  const copy = ROAD_COPY[lang]
  const label = ROAD_ROUNDS.find((r) => r.id === phase)!.text[lang].scene

  if (phase === 'chase') {
    return (
      <div role="img" aria-label={label}>
        <Road>
          <div className="absolute top-1/2 left-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <PlayerIcon className="road-bob" />
            <span className={CHIP}>→ 15 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2"><span className={`${CHIP} bg-sun`}>← 18 км →</span></div>
          <div className="absolute top-1/2 right-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <BossIcon className="road-bob [animation-delay:-0.4s]" />
            <span className={CHIP}>→ 9 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
        </Road>
      </div>
    )
  }

  if (phase === 'meeting') {
    return (
      <div role="img" aria-label={label} className="flex flex-col gap-2">
        <p className="road-alarm rounded-xl border-[3px] border-ink bg-[repeating-linear-gradient(135deg,#f8cd45_0_14px,#fde68a_14px_28px)] px-3 py-1 text-center text-sm font-black text-ink uppercase sm:text-base">
          <span aria-hidden>⚠️ </span>{copy.collision}
        </p>
        <Road>
          <div className="road-approach-right absolute top-1/2 left-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <PlayerIcon />
            <span className={CHIP}>→ 12 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-2xl" aria-hidden>💥</div>
          <div className="road-approach-left absolute top-1/2 right-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <BossIcon />
            <span className={CHIP}>18 км/{lang === 'kk' ? 'сағ' : 'ч'} ←</span>
          </div>
        </Road>
      </div>
    )
  }

  return (
    <div role="img" aria-label={label}>
      <div className="relative h-28 overflow-hidden rounded-2xl border-[3px] border-ink bg-[linear-gradient(180deg,#7cc4f5,#2f7fd0)] sm:h-32">
        <div aria-hidden className="river-current absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_30px,rgb(255_255_255/0.55)_30px_34px,transparent_34px_64px)] [background-size:64px_100%] opacity-70" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2"><span className={`${CHIP} bg-sky-100`}>{copy.current} →</span></div>
        {/* Upstream is to the left: both boats fight the current. */}
        <div className="absolute top-1/2 left-[8%] flex -translate-y-1/3 flex-col items-center gap-1">
          <span className="road-bob flex items-end"><BossIcon /><span aria-hidden className="-ml-2 text-2xl">🛥️</span></span>
        </div>
        <div className="absolute top-1/2 right-[8%] flex -translate-y-1/3 flex-col items-center gap-1">
          <span className="road-bob flex items-end [animation-delay:-0.5s]"><span aria-hidden className="-mr-2 text-2xl">🚤</span><PlayerIcon /></span>
        </div>
      </div>
    </div>
  )
}

export function MotionExercise({ lang, round, check }: { lang: Lang; round: (typeof ROAD_ROUNDS)[number]; check: (answer: string) => CheckStatus | null }) {
  const t = STRINGS[lang]
  const copy = ROAD_COPY[lang]
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckStatus | null>(null)
  const [showHint, setShowHint] = useState(false)
  const inputId = useId()
  const hintId = useId()

  return (
    <>
      <p className="mt-2 font-semibold text-ink sm:text-lg"><RichText text={round.text[lang].prompt} /></p>
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!value.trim()) return
          const status = check(value)
          if (status) setResult(status)
        }}
      >
        <label className="mb-1 block text-sm font-black" htmlFor={inputId}>{t.answerLabel}</label>
        <div className="flex flex-wrap gap-2">
          <input
            id={inputId}
            value={value}
            maxLength={32}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
            placeholder={copy.placeholder}
            className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-2 font-mono text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <button type="submit" className={`${BUTTON} bg-sun`} disabled={!value.trim()}>{t.check}</button>
        </div>
      </form>
      <div role="status" className="mt-2 text-sm font-bold text-ink">
        {result === 'incorrect' && <p className="rounded-xl bg-rose-50 p-2">{copy.wrong}</p>}
        {result === 'invalid' && <p className="rounded-xl bg-sun/25 p-2">{copy.invalid}</p>}
        {result === 'correct' && <p className="rounded-xl bg-emerald-100 p-2">{t.status.correct}</p>}
      </div>
      <button type="button" aria-expanded={showHint} aria-controls={hintId} onClick={() => setShowHint(!showHint)} className={`${BUTTON} mt-3 bg-white`}>
        {t.askHint}
      </button>
      <div id={hintId} hidden={!showHint} className="mt-3 rounded-xl border-2 border-ink bg-sky p-3">
        <p className="text-xs font-black text-brand-dark">{t.pifikName}</p>
        <p className="mt-1 text-sm font-semibold"><RichText text={round.text[lang].hint} /></p>
      </div>
    </>
  )
}

export function RoadGuardianScreen({ lang, challenge }: { lang: Lang; challenge: Challenge }) {
  const t = STRINGS[lang]
  const copy = ROAD_COPY[lang]
  const { run, submit, replay } = challenge
  const total = ROAD_ROUNDS.length
  const heading = useRef<HTMLHeadingElement>(null)
  const lastRound = useRef(run.cleared)
  const hpId = useId()
  const hp = ROAD_MAX_HP - run.cleared * ROAD_DAMAGE
  const current = ROAD_ROUNDS[run.cleared]
  const river = current?.id === 'river'

  useEffect(() => {
    if (lastRound.current !== run.cleared) {
      lastRound.current = run.cleared
      heading.current?.focus({ preventScroll: true })
    }
  }, [run.cleared])

  const season = findOperation('roads')
  const catalog = season
    ? <a href={operationHref(season.id)} className={`${BUTTON} bg-white`}><span aria-hidden>←&nbsp;</span>{season.title[lang]}</a>
    : <a href={SECTION_HREFS.comics} className={`${BUTTON} bg-white`}>{t.backToCatalog}</a>

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className={`${CARD} transition-colors duration-500 ${river ? 'bg-[linear-gradient(180deg,#e0f2ff,#bfe3ff)]' : 'bg-white'}`}>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{copy.title}</h1>
        <p className="text-sm font-bold text-brand-dark">{copy.subtitle}</p>
        <a href={SECTION_HREFS.motionLeague} className={`${BUTTON} mt-3 bg-white`}>{MOTION_COPY[lang].title}</a>
        <div className="mt-3 flex items-center gap-3">
          <BossIcon className="size-16 text-4xl sm:size-20" />
          <p className="min-w-0 text-sm font-semibold sm:text-base">{copy.intro}</p>
        </div>

        <FinishGates lit={run.cleared} lang={lang} />

        <p id={hpId} aria-live="polite" className="mt-3 font-black">{copy.hp(hp, ROAD_MAX_HP)}</p>
        <progress aria-labelledby={hpId} max={ROAD_MAX_HP} value={hp} className="mt-1 block h-3 w-full accent-rose-600" />

        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-bold sm:text-sm">
          {ROAD_ROUNDS.map((round, index) => {
            const cleared = index < run.cleared
            const active = index === run.cleared
            return (
              <li key={round.id} aria-current={active ? 'step' : undefined} className={`rounded-xl border-2 border-ink p-1.5 ${cleared ? 'bg-emerald-100' : active ? 'bg-sun' : 'bg-sky-100'}`}>
                <p className="font-black">{round.text[lang].tab}</p>
                <p>{cleared ? copy.status.cleared : active ? copy.status.active : copy.status.upcoming}</p>
              </li>
            )
          })}
        </ol>

        <div className="mt-4">
          {current ? (
            <PhaseScene key={current.id} phase={current.id} lang={lang} />
          ) : (
            <div className="road-victory relative grid h-28 place-items-center overflow-hidden rounded-2xl border-[3px] border-ink bg-[radial-gradient(circle,#fff6c7,#f8cd45)] sm:h-32" aria-hidden>
              <span className="text-5xl">🏆</span>
              {['✨', '🎉', '⭐', '✨', '🎊', '⭐'].map((s, i) => (
                <span key={i} className="road-spark absolute text-2xl" style={{ ['--i' as string]: i, left: `${12 + i * 15}%`, top: i % 2 ? '18%' : '62%' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${CARD} bg-white`}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-black text-ink">
          {current ? `${copy.phase(run.cleared + 1, total)} · ${current.text[lang].tab}` : copy.victory}
        </h2>
        {current ? (
          <MotionExercise key={current.id} lang={lang} round={current} check={(answer) => submit(run.cleared, answer)} />
        ) : (
          <>
            <p className="mt-2 font-semibold">{copy.victoryText}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={replay} className={`${BUTTON} bg-sun`}>{copy.replay}</button>
              {catalog}
            </div>
          </>
        )}
      </section>
      {current && <div>{catalog}</div>}
    </div>
  )
}
