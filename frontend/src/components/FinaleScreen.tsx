import { useEffect, useId, useRef, useState } from 'react'
import type { CheckStatus, Lang } from '../api/types'
import mosaicDark from '../assets/lights/mosaic-1.webp'
import mosaicLit from '../assets/lights/mosaic-3.webp'
import mosaicConcert from '../assets/lights/mosaic-4.webp'
import hall1 from '../assets/museum/hall-1.webp'
import hall2 from '../assets/museum/hall-2.webp'
import hall3 from '../assets/museum/hall-3.webp'
import hall4 from '../assets/museum/hall-4.webp'
import stage1 from '../assets/weather/stage-1.webp'
import stage2 from '../assets/weather/stage-2.webp'
import stage3 from '../assets/weather/stage-3.webp'
import stage4 from '../assets/weather/stage-4.webp'
import { useFinale, type FinaleDef, type FinaleRound } from '../finales'
import { STRINGS } from '../i18n'
import { FINALE_LOCK, findOperation, operationHref } from '../operations'
import { RichText } from './RichText'

// A season finale: three rounds, each lighting up one part of the scene.

const BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink px-4 py-2 text-center font-black text-ink shadow-[0_4px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:shadow-none'
const CARD = 'rounded-[28px] border-[3px] border-ink bg-white p-4 shadow-[0_6px_0_var(--color-ink)] sm:p-6'

const COPY = {
  ru: { round: (n: number, total: number) => `Часть ${n} из ${total}`, wrong: 'Пока не так. Перечитай условие и попробуй ещё раз.', invalid: 'Введи только целое число, без единиц измерения.', placeholder: 'например, 15', cleared: 'решено', active: 'сейчас', upcoming: 'впереди' },
  kk: { round: (n: number, total: number) => `${n}-бөлік / ${total}`, wrong: 'Әзірге дұрыс емес. Шартты қайта оқып, тағы байқап көр.', invalid: 'Тек бүтін санды енгіз, өлшем бірлігінсіз.', placeholder: 'мысалы, 15', cleared: 'шешілді', active: 'қазір', upcoming: 'алда' },
}

/**
 * The light mosaic on the stage: the lit artwork is revealed over the dark one, one third
 * per solved round (the mosaic covers about x 49–100%, y 9–87% of the frame). After the
 * last round the concert frame fades in.
 */
function MosaicScene({ lit, total, caption }: { lit: number; total: number; caption: string }) {
  const done = lit >= total
  const [concert, setConcert] = useState(done)
  useEffect(() => {
    if (!done) {
      setConcert(false)
      return
    }
    const timer = window.setTimeout(() => setConcert(true), 1600)
    return () => window.clearTimeout(timer)
  }, [done])
  const bottom = 9 + (78 * Math.min(lit, total)) / total
  const reveal = done ? 'inset(0 0 0 0)' : `polygon(49% 9%, 100% 9%, 100% ${bottom}%, 49% ${bottom}%)`
  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border-[3px] border-ink bg-ink">
      <div className="relative" style={{ aspectRatio: '826 / 461' }}>
        <img src={mosaicDark} alt={concert ? '' : caption} aria-hidden={concert} className="absolute inset-0 h-full w-full object-cover" />
        <img
          src={mosaicLit}
          alt=""
          aria-hidden
          style={{ clipPath: lit > 0 ? reveal : 'polygon(49% 9%, 100% 9%, 100% 9%, 49% 9%)' }}
          className="absolute inset-0 h-full w-full object-cover transition-[clip-path] duration-700 ease-out"
        />
        <img
          src={mosaicConcert}
          alt={concert ? caption : ''}
          aria-hidden={!concert}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${concert ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <figcaption aria-live="polite" className="bg-sun px-3 py-1.5 text-center text-sm font-black text-ink">
        <span aria-hidden>{'✨'.repeat(Math.min(lit, total))}{'▫️'.repeat(total - Math.min(lit, total))} </span>{caption}
      </figcaption>
    </figure>
  )
}

/** Finales told as a sequence of frames: one frame per solved round (start, 1, 2, 3). */
const FRAME_SCENES: Record<string, { frames: string[]; aspect: string }> = {
  museum: { frames: [hall1, hall2, hall3, hall4], aspect: '824 / 460' },
  weather: { frames: [stage1, stage2, stage3, stage4], aspect: '826 / 460' },
}

function FramesScene({ frames, aspect, lit, caption, total }: { frames: string[]; aspect: string; lit: number; caption: string; total: number }) {
  const frame = Math.min(lit, frames.length - 1)
  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border-[3px] border-ink bg-ink">
      <div className="relative" style={{ aspectRatio: aspect }}>
        {frames.map((src, i) => (
          <img key={src} src={src} alt={i === frame ? caption : ''} aria-hidden={i !== frame}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === frame ? 'opacity-100' : 'opacity-0'}`} />
        ))}
      </div>
      <figcaption aria-live="polite" className="bg-sun px-3 py-1.5 text-center text-sm font-black text-ink">
        <span aria-hidden>{'✨'.repeat(Math.min(lit, total))}{'▫️'.repeat(total - Math.min(lit, total))} </span>{caption}
      </figcaption>
    </figure>
  )
}

function RoundExercise({ lang, round, onSubmit }: {
  lang: Lang
  round: FinaleRound
  onSubmit: (answer: string) => { status: CheckStatus; message?: string } | null
}) {
  const t = STRINGS[lang]
  const copy = COPY[lang]
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ status: CheckStatus; message?: string } | null>(null)
  const [showHint, setShowHint] = useState(false)
  const inputId = useId()
  const hintId = useId()
  return (
    <>
      <p className="mt-2 font-semibold text-ink sm:text-lg"><RichText text={round.prompt[lang]} /></p>
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault()
        if (!value.trim()) return
        const next = onSubmit(value)
        if (next && next.status !== 'correct') setResult(next)
      }}>
        <label className="mb-1 block text-sm font-black" htmlFor={inputId}>{t.answerLabel}</label>
        <div className="flex flex-wrap gap-2">
          <input id={inputId} value={value} maxLength={32} inputMode="numeric" autoComplete="off" placeholder={copy.placeholder}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-2 font-mono text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand" />
          <button type="submit" className={`${BUTTON} bg-sun`} disabled={!value.trim()}>{t.check}</button>
        </div>
      </form>
      <div role="status" className="mt-2 text-sm font-bold text-ink">
        {result?.status === 'incorrect' && <p className="rounded-xl bg-rose-50 p-2">{result.message ?? copy.wrong}</p>}
        {result?.status === 'invalid' && <p className="rounded-xl bg-sun/25 p-2">{copy.invalid}</p>}
      </div>
      <button type="button" aria-expanded={showHint} aria-controls={hintId} onClick={() => setShowHint(!showHint)} className={`${BUTTON} mt-3 bg-white`}>
        {t.askHint}
      </button>
      <div id={hintId} hidden={!showHint} className="mt-3 rounded-xl border-2 border-ink bg-sky p-3">
        <p className="text-xs font-black text-brand-dark">{t.pifikName}</p>
        <p className="mt-1 text-sm font-semibold"><RichText text={round.hint[lang]} /></p>
      </div>
    </>
  )
}

export function FinaleScreen({ lang, def, remaining }: { lang: Lang; def: FinaleDef; remaining: number }) {
  const copy = COPY[lang]
  const { run, submit, replay } = useFinale(def)
  const total = def.rounds.length
  const current = def.rounds[run.cleared]
  const heading = useRef<HTMLHeadingElement>(null)
  const lastRound = useRef(run.cleared)
  const operation = findOperation(def.id)
  const caption = def.progress(run.cleared, total, lang)

  useEffect(() => {
    if (lastRound.current !== run.cleared) {
      lastRound.current = run.cleared
      heading.current?.focus({ preventScroll: true })
    }
  }, [run.cleared])

  const back = operation && (
    <a href={operationHref(operation.id)} className={`${BUTTON} bg-white`}><span aria-hidden>←&nbsp;</span>{operation.title[lang]}</a>
  )

  if (remaining > 0 && !run.won) {
    return (
      <section className={`mx-auto max-w-2xl ${CARD}`}>
        <h1 className="text-2xl font-black text-ink">{def.title[lang]}</h1>
        <p className="mt-2 font-semibold"><span aria-hidden>🔒 </span>{FINALE_LOCK[lang].locked}</p>
        <p className="mt-2 font-black text-brand-dark">{FINALE_LOCK[lang].left(remaining)}</p>
        <div className="mt-4">{back}</div>
      </section>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{def.title[lang]}</h1>
        {operation && <p className="text-sm font-bold text-brand-dark">{operation.title[lang]} · {operation.finale.math[lang]}</p>}
        <p className="mt-2 text-sm font-semibold sm:text-base">{def.intro[lang]}</p>
        {FRAME_SCENES[def.id]
          ? <FramesScene {...FRAME_SCENES[def.id]} lit={run.cleared} total={total} caption={caption} />
          : <MosaicScene lit={run.cleared} total={total} caption={caption} />}
        <ol className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-bold sm:text-sm">
          {def.rounds.map((round, index) => {
            const cleared = index < run.cleared
            const active = index === run.cleared
            return (
              <li key={index} aria-current={active ? 'step' : undefined} className={`rounded-xl border-2 border-ink p-1.5 ${cleared ? 'bg-emerald-100' : active ? 'bg-sun' : 'bg-sky-100'}`}>
                <p className="font-black">{round.title[lang]}</p>
                <p>{cleared ? copy.cleared : active ? copy.active : copy.upcoming}</p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className={CARD}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-black text-ink">
          {current ? `${copy.round(run.cleared + 1, total)} · ${current.title[lang]}` : def.victory[lang]}
        </h2>
        {current ? (
          <RoundExercise key={run.cleared} lang={lang} round={current} onSubmit={(answer) => submit(run.cleared, answer, lang)} />
        ) : (
          <>
            <p className="mt-2 font-semibold">{def.victoryText[lang]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={replay} className={`${BUTTON} bg-sun`}>{def.replay[lang]}</button>
              {back}
            </div>
          </>
        )}
      </section>
      {current && back && <div>{back}</div>}
    </div>
  )
}
