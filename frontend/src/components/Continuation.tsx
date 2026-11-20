import { useEffect, useId, useRef, useState } from 'react'
import type { Lang } from '../api/types'
import {
  CONTINUATION_CHOICE_IDS,
  CONTINUATION_CHOICES,
  CONTINUATION_COPY,
  continuationInput,
  preparedPreview,
  type ContinuationChoiceId,
} from '../continuation'
import { comicHref } from '../route'

interface Props {
  sourceChapterId: string
  nextComicId: string
  lang: Lang
  buttonClass: string
}

export function Continuation({ sourceChapterId, nextComicId, lang, buttonClass }: Props) {
  const t = CONTINUATION_COPY[lang]
  const [view, setView] = useState<'closed' | 'choices' | 'preview'>('closed')
  const [choice, setChoice] = useState<ContinuationChoiceId | null>(null)
  const panelId = useId()
  const headingId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (view !== 'closed') heading.current?.focus()
  }, [view])

  function close() {
    setView('closed')
    trigger.current?.focus()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={view !== 'closed'}
        aria-controls={panelId}
        onClick={() => view === 'closed' ? setView('choices') : close()}
        className={`${buttonClass} w-full bg-white sm:w-auto`}
      >
        {t.create}
      </button>
      <section
        id={panelId}
        hidden={view === 'closed'}
        aria-labelledby={view === 'closed' ? undefined : headingId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation()
        }}
        className="mt-4 basis-full rounded-2xl border-2 border-ink bg-white p-3 sm:p-4"
      >
        {view === 'choices' && (
          <>
            <h3 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-black text-ink">{t.question}</h3>
            <p className="mt-1 text-sm font-semibold text-ink/80">{t.premise}</p>
            <form onSubmit={(event) => {
              event.preventDefault()
              if (choice) setView('preview')
            }}>
              <fieldset aria-labelledby={headingId} className="mt-3 grid gap-2">
                {CONTINUATION_CHOICE_IDS.map((id) => (
                  <label key={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 font-bold has-checked:bg-sky">
                    <input
                      type="radio"
                      name={panelId}
                      value={id}
                      checked={choice === id}
                      onChange={() => setChoice(id)}
                      className="h-4 w-4 shrink-0 accent-brand-dark"
                    />
                    <span>{CONTINUATION_CHOICES[id].label[lang]}</span>
                  </label>
                ))}
              </fieldset>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={!choice} className={`${buttonClass} bg-sun`}>{t.openPreview}</button>
                <button type="button" onClick={close} className={`${buttonClass} bg-white`}>{t.back}</button>
              </div>
            </form>
          </>
        )}
        {view === 'preview' && choice && (
          <>
            <h3 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-black text-ink">{t.preview}</h3>
            <p className="mt-2 font-extrabold text-brand-dark">{CONTINUATION_CHOICES[choice].label[lang]}</p>
            <p className="mt-1 font-semibold leading-relaxed text-ink">{preparedPreview(continuationInput(sourceChapterId, choice, lang))}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView('choices')} className={`${buttonClass} bg-white`}>{t.chooseDifferent}</button>
              <button type="button" onClick={close} className={`${buttonClass} bg-white`}>{t.back}</button>
              <a href={comicHref(nextComicId)} className={`${buttonClass} bg-sun`}>{t.canonical}</a>
            </div>
          </>
        )}
      </section>
    </>
  )
}
