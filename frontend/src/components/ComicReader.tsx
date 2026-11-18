import { useEffect } from 'react'
import type { Comic, Lang } from '../api'
import { useAnswerCheck } from '../hooks'
import { STRINGS } from '../i18n'
import { CastCard } from './CastCard'
import { ExerciseCard } from './ExerciseCard'
import { PanelArt } from './PanelArt'

// Panels after the exercise panel stay locked until the answer is correct,
// so later panels don't spoil the solution.
const GATE_AFTER_EXERCISE = true

interface Props {
  comic: Comic
  lang: Lang
  index: number
  onIndexChange: (i: number) => void
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-[3px] border-ink px-4 py-2 font-black shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

export function ComicReader({ comic, lang, index, onIndexChange }: Props) {
  const t = STRINGS[lang]
  const check = useAnswerCheck(comic.exercise.id, lang)
  const total = comic.panels.length
  const exerciseIndex = comic.panels.findIndex((p) => p.id === comic.exercise.panelId)
  const maxIndex = GATE_AFTER_EXERCISE && exerciseIndex >= 0 && !check.solved ? exerciseIndex : total - 1
  const current = Math.min(index, maxIndex)
  const panel = comic.panels[current]
  const isExercisePanel = panel.id === comic.exercise.panelId
  const locked = current === maxIndex && maxIndex < total - 1
  const justUnlocked = check.solved && isExercisePanel && current < total - 1

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' && current < maxIndex) onIndexChange(current + 1)
      if (e.key === 'ArrowLeft' && current > 0) onIndexChange(current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, maxIndex, onIndexChange])

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-7">
      <section
        aria-label={comic.title}
        className="rounded-[28px] border-[3px] border-ink/10 bg-white p-3 shadow-[0_10px_30px_rgb(36_57_159/0.15)] sm:p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="rounded-full bg-brand px-4 py-1 text-sm font-black text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] sm:text-base">
            {comic.title}
          </h2>
          <p className="shrink-0 text-sm font-extrabold text-ink/70" aria-live="polite">
            {t.panelOf(current + 1, total)}
          </p>
        </div>

        <figure
          key={panel.id}
          className="panel-enter relative overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100"
          aria-label={`${panel.speaker}: ${panel.text}`}
        >
          <PanelArt imageKey={panel.imageKey} speaker={panel.speaker} text={panel.text} priority />
          <span className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-full border-[3px] border-ink bg-sun text-lg font-black text-ink">
            {panel.id}
          </span>
        </figure>

        <nav aria-label={t.panelOf(current + 1, total)} className="mt-4 flex flex-col gap-3">
          <ol className="mx-auto grid w-full max-w-xl grid-cols-6 gap-1.5 sm:gap-2.5">
            {comic.panels.map((p, i) => {
              const reachable = i <= maxIndex
              const active = i === current
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-label={reachable ? t.goToPanel(i + 1) : `${t.goToPanel(i + 1)} — ${t.locked}`}
                    aria-current={active ? 'step' : undefined}
                    disabled={!reachable}
                    onClick={() => onIndexChange(i)}
                    className={`relative block w-full overflow-hidden rounded-lg border-[3px] transition sm:rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun ${
                      active
                        ? 'border-ink ring-4 ring-sun'
                        : reachable
                          ? 'border-ink/70 hover:-translate-y-0.5 hover:border-ink'
                          : 'cursor-not-allowed border-ink/30'
                    }`}
                  >
                    <div className={reachable ? '' : 'blur-[3px] grayscale'}>
                      <PanelArt imageKey={p.imageKey} speaker={p.speaker} text="" thumb />
                    </div>
                    <span
                      className={`absolute top-0.5 left-0.5 grid h-4 min-w-4 place-items-center rounded-full border-[1.5px] border-ink px-0.5 text-[10px] font-black sm:top-1 sm:left-1 sm:h-5 sm:min-w-5 sm:border-2 sm:text-[11px] ${
                        active ? 'bg-sun text-ink' : 'bg-white text-ink'
                      }`}
                    >
                      {p.id}
                    </span>
                    {!reachable && (
                      <span aria-hidden className="absolute inset-0 grid place-items-center bg-ink/30 text-base sm:text-xl">
                        🔒
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => onIndexChange(current - 1)} disabled={current === 0} className={`${BTN} bg-white text-ink`}>
              <span aria-hidden>←</span> {t.prev}
            </button>
            {current < total - 1 ? (
              <button
                type="button"
                onClick={() => onIndexChange(current + 1)}
                disabled={locked}
                title={locked ? t.locked : undefined}
                className={`${BTN} bg-sun text-ink`}
              >
                {t.next} <span aria-hidden>→</span>
              </button>
            ) : (
              <button type="button" onClick={() => onIndexChange(0)} className={`${BTN} bg-white text-ink`}>
                <span aria-hidden>↺</span> {t.restart}
              </button>
            )}
          </div>
          {locked && (
            <p className="rounded-xl bg-sun/30 px-3 py-2 text-center text-sm font-extrabold text-ink">
              <span aria-hidden>🔒 </span>
              {t.locked}
            </p>
          )}
          {justUnlocked && (
            <button
              type="button"
              onClick={() => onIndexChange(current + 1)}
              className="rounded-xl bg-emerald-100 px-3 py-2 text-center text-sm font-extrabold text-emerald-900 hover:bg-emerald-200"
            >
              {t.unlocked}
            </button>
          )}
        </nav>
      </section>

      <aside className="flex flex-col gap-5">
        {/* Kept mounted (hidden) off the exercise panel so the typed answer and hints survive navigation. */}
        <div hidden={!isExercisePanel}>
          <ExerciseCard exercise={comic.exercise} lang={lang} check={check} />
        </div>
        <CastCard lang={lang} activeSpeaker={panel.speaker} compact={isExercisePanel} />
      </aside>
    </div>
  )
}
