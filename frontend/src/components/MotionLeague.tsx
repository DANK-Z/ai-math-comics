import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../api'
import { MOTION_COPY } from '../motionLeague'
import { checkRoadAnswer, MOTION_ROUNDS, ROAD_COPY } from '../roadGuardian'
import { SECTION_HREFS } from '../route'
import { MotionExercise } from './RoadGuardianScreen'

const BUTTON = 'inline-flex min-h-11 items-center rounded-xl border-[3px] border-ink px-3 py-2 text-start font-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun'
const DURATION_SECONDS = 180

interface Run {
  index: number
  hearts: number | null
  expiresAt: number | null
  crystals: boolean
}

export default function MotionLeague({ lang }: { lang: Lang }) {
  const t = MOTION_COPY[lang]
  const [mode, setMode] = useState<'practice' | 'challenge'>('practice')
  const [practiceRound, setPracticeRound] = useState(MOTION_ROUNDS[0].id)
  const [options, setOptions] = useState({ hearts: false, timer: false, crystals: false })
  const [run, setRun] = useState<Run | null>(null)
  const latestRun = useRef(run)
  const roundHeading = useRef<HTMLHeadingElement>(null)
  const [now, setNow] = useState(0)
  const deadline = run?.expiresAt
  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null
  const isFinished = run?.index === MOTION_ROUNDS.length
  const expired = remaining === 0
  const noHearts = run?.hearts === 0
  const terminal = isFinished || expired || noHearts

  useEffect(() => {
    if (!deadline || terminal) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [deadline, terminal])
  const roundIndex = run?.index
  useEffect(() => {
    if (mode === 'challenge') roundHeading.current?.focus()
  }, [mode, roundIndex, terminal])

  function update(next: Run | null) {
    latestRun.current = next
    setRun(next)
  }

  function start() {
    const started = Date.now()
    setNow(started)
    update({ index: 0, hearts: options.hearts ? 3 : null, expiresAt: options.timer ? started + DURATION_SECONDS * 1000 : null, crystals: options.crystals })
  }

  const practice = MOTION_ROUNDS.find((round) => round.id === practiceRound) ?? MOTION_ROUNDS[0]
  const activeRound = run ? MOTION_ROUNDS[run.index] : undefined

  return (
    <section className="mx-auto grid max-w-2xl gap-4 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_5px_0_var(--color-ink)] sm:p-6">
      <h1 className="text-2xl font-black sm:text-3xl">{t.title}</h1>
      <div className="flex flex-wrap gap-2">
        {(['practice', 'challenge'] as const).map((name) => (
          <button key={name} type="button" aria-pressed={mode === name} className={`${BUTTON} ${mode === name ? 'bg-sun' : 'bg-white'}`} onClick={() => setMode(name)}>
            {mode === name && <span aria-hidden="true" className="me-1">✓</span>}{t[name]}
          </button>
        ))}
      </div>
      {mode === 'practice' ? (
        <div>
          <label className="grid gap-1 font-bold">
            {t.topic}
            <select value={practiceRound} className={`${BUTTON} max-w-full bg-white`} onChange={(event) => {
              const selected = MOTION_ROUNDS.find(({ id }) => id === event.target.value)
              if (selected) setPracticeRound(selected.id)
            }}>
              {MOTION_ROUNDS.map(({ id, text }) => <option key={id} value={id}>{text[lang].tab}</option>)}
            </select>
          </label>
          <MotionExercise key={practice.id} lang={lang} round={practice} check={(answer) => checkRoadAnswer(practice, answer)} />
        </div>
      ) : run ? (
        <div>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            {run.hearts !== null && <p>{t.hearts(run.hearts)}</p>}
            {remaining !== null && <p>{t.seconds(remaining)}</p>}
            {run.crystals && <p>{t.crystals(run.index)}</p>}
          </div>
          {terminal ? (
            <h2 ref={roundHeading} tabIndex={-1} className="mt-2 text-lg font-black">{isFinished ? t.finished : expired ? t.expired : t.noHearts}</h2>
          ) : activeRound && (
            <div>
              <h2 ref={roundHeading} tabIndex={-1} className="mt-2 text-lg font-black">{ROAD_COPY[lang].phase(run.index + 1, MOTION_ROUNDS.length)} · {activeRound.text[lang].tab}</h2>
              <MotionExercise key={activeRound.id} lang={lang} round={activeRound} check={(answer) => {
                const current = latestRun.current
                if (!current || current.index !== run.index || current.hearts === 0 || (current.expiresAt && current.expiresAt <= Date.now())) return null
                const result = checkRoadAnswer(activeRound, answer)
                if (result === 'correct') update({ ...current, index: current.index + 1 })
                if (result === 'incorrect' && current.hearts !== null) update({ ...current, hearts: current.hearts - 1 })
                return result
              }} />
            </div>
          )}
          <button type="button" className={`${BUTTON} mt-3 bg-white`} onClick={() => (terminal ? start() : update(null))}>
            {terminal ? ROAD_COPY[lang].replay : t.stop}
          </button>
        </div>
      ) : (
        <div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-black">{t.options}</legend>
            {(['hearts', 'timer', 'crystals'] as const).map((name) => (
              <label key={name} className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-ink px-3 font-bold has-checked:bg-sun">
                <input type="checkbox" checked={options[name]} onChange={(event) => setOptions({ ...options, [name]: event.target.checked })} />
                {t[`${name}Option`]}
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={start} className={`${BUTTON} mt-3 bg-sun`}>{t.start}</button>
        </div>
      )}
      <a href={SECTION_HREFS.roadGuardian} className={`${BUTTON} w-fit bg-white`}>{t.guardian}</a>
    </section>
  )
}
