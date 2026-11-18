import { useEffect } from 'react'
import type { Comic, Lang } from '../api'
import { useAnswerCheck } from '../hooks'
import { STRINGS } from '../i18n'
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
    <div className="flex flex-col gap-5">
      <figure className="overflow-hidden rounded-2xl border-[3px] border-stone-900 bg-white shadow-[6px_6px_0_#1c1917]">
        <div className="relative aspect-[32/19] border-b-[3px] border-stone-900">
          <PanelArt imageKey={panel.imageKey} label={`${panel.speaker}: ${panel.text}`} />
          <span className="absolute top-2 left-2 rounded-md border-2 border-stone-900 bg-amber-300 px-2 py-0.5 text-xs font-black">
            {panel.id}
          </span>
        </div>
        <figcaption className="p-4 sm:p-5">
          <p className="text-sm font-black tracking-wide text-amber-700 uppercase">{panel.speaker}</p>
          <p className="text-xl leading-snug font-semibold text-stone-900 sm:text-2xl">{panel.text}</p>
        </figcaption>
      </figure>

      <nav className="flex items-center justify-between gap-3" aria-label={t.panelOf(current + 1, total)}>
        <button
          type="button"
          onClick={() => onIndexChange(current - 1)}
          disabled={current === 0}
          className="rounded-xl border-2 border-stone-900 bg-white px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917] disabled:opacity-40 disabled:shadow-none"
        >
          ← {t.prev}
        </button>

        <ol className="flex items-center gap-1.5">
          {comic.panels.map((p, i) => {
            const reachable = i <= maxIndex
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-label={t.goToPanel(i + 1)}
                  aria-current={i === current ? 'step' : undefined}
                  disabled={!reachable}
                  onClick={() => onIndexChange(i)}
                  className={`block h-3 rounded-full border-2 border-stone-900 transition-all ${
                    i === current ? 'w-7 bg-stone-900' : reachable ? 'w-3 bg-amber-300' : 'w-3 bg-stone-200 opacity-60'
                  }`}
                />
              </li>
            )
          })}
        </ol>

        {current < total - 1 ? (
          <button
            type="button"
            onClick={() => onIndexChange(current + 1)}
            disabled={locked}
            title={locked ? t.locked : undefined}
            className="rounded-xl border-2 border-stone-900 bg-amber-400 px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917] disabled:opacity-40 disabled:shadow-none"
          >
            {t.next} →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onIndexChange(0)}
            className="rounded-xl border-2 border-stone-900 bg-white px-4 py-2 font-bold shadow-[3px_3px_0_#1c1917]"
          >
            ↺ {t.restart}
          </button>
        )}
      </nav>
      <p className="-mt-3 text-center text-sm font-semibold text-stone-600">
        {t.panelOf(current + 1, total)}
        {locked && <span className="block text-amber-700">🔒 {t.locked}</span>}
      </p>

      {/* Kept mounted (hidden) off the exercise panel so the typed answer and hints survive navigation. */}
      <div hidden={!isExercisePanel}>
        <ExerciseCard exercise={comic.exercise} lang={lang} check={check} />
      </div>
    </div>
  )
}
