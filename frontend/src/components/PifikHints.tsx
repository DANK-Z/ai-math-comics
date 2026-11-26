import { useEffect, useId, useState } from 'react'
import { HelperFace, useHelperName } from './HelperFace'
import type { Lang } from '../api'
import { useHints } from '../hooks'
import { STRINGS } from '../i18n'
import { MAP_HINT_IDS, MAP_HINTS } from '../mapHints'
import { readHintCount, rememberHint } from '../readingProgress'
import { RichText } from './RichText'
import { PifikSprite } from './PifikSprite'

function PifikAvatar() {
  return <HelperFace className="w-12 border-[3px]"><PifikSprite className="w-12 shrink-0 rounded-full border-[3px] border-ink bg-white" /></HelperFace>
}

export function PifikHints({ exerciseId, lang, mapHints, savedComicId, structured }: {
  exerciseId: string; lang: Lang; mapHints: boolean; savedComicId?: string; structured: boolean
}) {
  return mapHints ? <MapHints lang={lang} /> : <SequentialHints exerciseId={exerciseId} lang={lang} savedComicId={savedComicId} structured={structured} />
}

function MapHints({ lang }: { lang: Lang }) {
  const [selected, setSelected] = useState<(typeof MAP_HINT_IDS)[number] | null>(null)
  const resultId = useId()
  const copy = MAP_HINTS[lang]

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {MAP_HINT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={selected === id}
            aria-controls={resultId}
            onClick={() => setSelected(id)}
            className={`min-h-11 rounded-xl border-[3px] border-ink px-3 py-2 text-start text-sm font-black shadow-[0_3px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun ${selected === id ? 'bg-sun' : 'bg-white'}`}
          >
            {selected === id && <span aria-hidden="true">✓ </span>}{copy[id].label}
          </button>
        ))}
      </div>
      <div id={resultId} aria-live="polite">
        {selected && (
          <div className="rounded-2xl border-[3px] border-ink bg-white p-3 text-sm font-semibold">
            <p>{copy[selected].text}</p>
            {selected === 'diagram' && (
              <figure className="mt-3 text-center font-black">
                <div aria-hidden="true" className="grid h-5 grid-cols-6 rounded-sm border-2 border-ink bg-sky-100">
                  {Array.from({ length: 5 }, (_, i) => <span key={i} className="border-e-2 border-ink" />)}
                </div>
                <figcaption className="mt-1">{copy.diagram.caption}</figcaption>
              </figure>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SequentialHints({ exerciseId, lang, savedComicId, structured }: { exerciseId: string; lang: Lang; savedComicId?: string; structured: boolean }) {
  const t = STRINGS[lang]
  const helperName = useHelperName(lang)
  const [initial] = useState(() => savedComicId ? readHintCount(savedComicId, exerciseId) : 0)
  const { hints, revealed, loading, error, hasMore, requestNext } = useHints(exerciseId, lang, initial)
  const loadedCount = hints.length
  useEffect(() => {
    if (savedComicId && loadedCount) rememberHint(savedComicId, exerciseId, loadedCount)
  }, [savedComicId, exerciseId, loadedCount])

  const buttonLabel = error ? t.retry : revealed === 0 ? t.askHint : t.nextHint
  const canAsk = error || (hasMore && !loading)

  return (
    <div>
      <ul aria-live="polite" className="mb-3 space-y-3 empty:hidden">
        {hints.map((h) => (
          <li key={h.step} className="flex items-start gap-3">
            <PifikAvatar />
            <div className="relative rounded-2xl border-[3px] border-ink bg-white px-3 py-2 before:absolute before:top-4 before:-left-[10px] before:h-4 before:w-4 before:rotate-45 before:border-b-[3px] before:border-l-[3px] before:border-ink before:bg-white">
              <p className="text-xs font-black tracking-wide text-sky-700 uppercase">
                {helperName ?? t.pifikName} · {structured ? (h.step === 1 ? t.hintRule : t.hintSteps) : t.hintN(h.step)}
              </p>
              <p className="font-semibold text-ink">
                <RichText text={h.text} />
              </p>
            </div>
          </li>
        ))}
      </ul>

      {loading && <p className="mb-2 text-sm font-bold text-sky-700">{t.hintLoading}</p>}
      {error && <p className="mb-2 text-sm font-bold text-rose-700">{t.hintError}</p>}

      {canAsk ? (
        <button
          type="button"
          onClick={requestNext}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-ink bg-sky-300 py-1 pr-4 pl-1 font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          <HelperFace className="w-8"><PifikSprite className="w-8 rounded-full border-2 border-ink bg-white" /></HelperFace>
          {buttonLabel}
        </button>
      ) : (
        !loading && revealed > 0 && <p className="text-sm font-bold text-ink/70">{t.noMoreHints}</p>
      )}
    </div>
  )
}
