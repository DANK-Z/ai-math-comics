import { useEffect, useId, useRef, useState } from 'react'
import type { CheckStatus, Lang } from '../api/types'
import { PORTRAITS } from '../art/sheet'
import { STRINGS } from '../i18n'
import { MOTION_COPY } from '../motionLeague'
import { ROAD_COPY, ROAD_ROUNDS, type RoadPhase, type useRoadGuardian } from '../roadGuardian'
import gate1 from '../assets/roads/gate-1.webp'
import gate2 from '../assets/roads/gate-2.webp'
import gate3 from '../assets/roads/gate-3.webp'
import gate4 from '../assets/roads/gate-4.webp'
import { FINALE_LOCK, findOperation, operationHref } from '../operations'
import { SECTION_HREFS } from '../route'
import { RichText } from './RichText'
import { SheetCrop } from './SheetCrop'

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink px-4 py-2 text-center font-black text-ink shadow-[0_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:shadow-none'
const CARD = 'rounded-[28px] border-[3px] border-ink p-4 shadow-[0_6px_0_var(--color-ink)] sm:p-6'
const CHIP = 'rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-ink sm:text-xs'

type Challenge = ReturnType<typeof useRoadGuardian>

/**
 * The finish gates: one lamp lights up per opened lock, and the gates open on victory.
 * The artwork has frames for 0, 1 and 3 lamps plus the open gates; the second lamp is
 * drawn over the one-lamp frame, and the three-lamp frame shows briefly before the gates open.
 */
const GATES = [gate1, gate2, gate3, gate4]
const GATE_COPY = {
  ru: (lit: number) => lit >= 3 ? 'Все три фонаря горят — ворота открыты!' : `Фонари на воротах: ${lit} из 3`,
  kk: (lit: number) => lit >= 3 ? 'Үш шам да жанып тұр — қақпа ашық!' : `Қақпадағы шамдар: ${lit} / 3`,
}

function FinishGates({ lit, lang }: { lit: number; lang: Lang }) {
  const caption = GATE_COPY[lang](lit)
  // Opening the last lock shows all three lamps first; a revisit after victory starts open.
  const [opened, setOpened] = useState(lit >= 3)
  useEffect(() => {
    if (lit < 3) {
      setOpened(false)
      return
    }
    const timer = window.setTimeout(() => setOpened(true), 1600)
    return () => window.clearTimeout(timer)
  }, [lit])
  const frame = lit <= 0 ? 0 : lit <= 2 ? 1 : opened ? 3 : 2
  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border-[3px] border-ink bg-ink">
      <div className="relative" style={{ aspectRatio: '827 / 463' }}>
        {GATES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={i === frame ? caption : ''}
            aria-hidden={i !== frame}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === frame ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        {/* The middle lamp sits higher than the side ones (the arch curves): its centre is at
            51.9% × 12% of the frame and its glass is ~7% of the width (measured on the art). */}
        <span
          aria-hidden
          className={`absolute top-[12%] left-[51.9%] aspect-square w-[7.2%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fffbe6_0%,#fde68a_40%,#f5b729_68%,#e59a1d_100%)] shadow-[0_0_14px_5px_rgb(253_224_71/0.65)] transition-opacity duration-700 ${lit === 2 ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <figcaption aria-live="polite" className="bg-sun px-3 py-1.5 text-center text-sm font-black text-ink">
        <span aria-hidden>{'💡'.repeat(Math.min(lit, 3))}{'⚪'.repeat(3 - Math.min(lit, 3))} </span>{caption}
      </figcaption>
    </figure>
  )
}

/** The Guardian, cropped from the gate artwork: a friendly keeper in a road-patterned robe. */
function GuardianIcon({ className = '' }: { className?: string }) {
  return (
    // Zoom into the Guardian's face (upper right of the first gate panel).
    <span
      aria-hidden
      style={{ backgroundImage: `url(${gate1})`, backgroundSize: '600% auto', backgroundPosition: '94% 29%' }}
      className={`block size-12 shrink-0 rounded-full border-[3px] border-ink bg-sky bg-no-repeat sm:size-14 ${className}`}
    />
  )
}

function Rider({ who, className = '' }: { who: 'aruna' | 'aldiyar'; className?: string }) {
  return <SheetCrop rect={PORTRAITS[who]} eager className={`size-12 shrink-0 rounded-full border-[3px] border-ink bg-white sm:size-14 ${className}`} />
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
            <Rider who="aruna" className="road-bob" />
            <span className={CHIP}>→ 15 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2"><span className={`${CHIP} bg-sun`}>← 18 км →</span></div>
          <div className="absolute top-1/2 right-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <Rider who="aldiyar" className="road-bob [animation-delay:-0.4s]" />
            <span className={CHIP}>→ 9 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
        </Road>
      </div>
    )
  }

  if (phase === 'meeting') {
    return (
      <div role="img" aria-label={label}>
        <Road>
          <div className="road-approach-right absolute top-1/2 left-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <Rider who="aruna" />
            <span className={CHIP}>→ 12 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
          </div>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl" aria-hidden>🌉</div>
          <div className="road-approach-left absolute top-1/2 right-[6%] flex -translate-y-1/2 flex-col items-center gap-1">
            <Rider who="aldiyar" />
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
        {/* Upstream is to the left: the friends' boat first goes against the current. */}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/3 flex-col items-center gap-1">
          <span className="road-bob flex items-end"><span aria-hidden className="-mr-1 text-2xl">🚤</span><Rider who="aruna" /><Rider who="aldiyar" className="-ml-3" /></span>
          <span className={CHIP}>← 20 км/{lang === 'kk' ? 'сағ' : 'ч'}</span>
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

export function RoadGuardianScreen({ lang, challenge, remaining = 0 }: { lang: Lang; challenge: Challenge; remaining?: number }) {
  const t = STRINGS[lang]
  const copy = ROAD_COPY[lang]
  const { run, submit, replay } = challenge
  const total = ROAD_ROUNDS.length
  const heading = useRef<HTMLHeadingElement>(null)
  const lastRound = useRef(run.cleared)
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

  if (remaining > 0 && !run.won) {
    return (
      <section className={`mx-auto max-w-2xl ${CARD} bg-white`}>
        <h1 className="text-2xl font-black text-ink">{copy.title}</h1>
        <p className="mt-2 font-semibold"><span aria-hidden>🔒 </span>{FINALE_LOCK[lang].locked}</p>
        <p className="mt-2 font-black text-brand-dark">{FINALE_LOCK[lang].left(remaining)}</p>
        <div className="mt-4">{catalog}</div>
      </section>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className={`${CARD} transition-colors duration-500 ${river ? 'bg-[linear-gradient(180deg,#e0f2ff,#bfe3ff)]' : 'bg-white'}`}>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{copy.title}</h1>
        <p className="text-sm font-bold text-brand-dark">{copy.subtitle}</p>
        <a href={SECTION_HREFS.motionLeague} className={`${BUTTON} mt-3 bg-white`}>{MOTION_COPY[lang].title}</a>
        <div className="mt-3 flex items-center gap-3">
          <GuardianIcon className="size-16 sm:size-20" />
          <p className="min-w-0 text-sm font-semibold sm:text-base">{copy.intro}</p>
        </div>

        <FinishGates lit={run.cleared} lang={lang} />

        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-bold sm:text-sm">
          {ROAD_ROUNDS.map((round, index) => {
            const cleared = index < run.cleared
            const active = index === run.cleared
            return (
              <li key={round.id} aria-current={active ? 'step' : undefined} className={`rounded-xl border-2 border-ink p-1.5 ${cleared ? 'bg-emerald-100' : active ? 'bg-sun' : 'bg-sky-100'}`}>
                <p className="font-black"><span aria-hidden>{cleared ? '🔓' : '🔒'} </span>{round.text[lang].tab}</p>
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
