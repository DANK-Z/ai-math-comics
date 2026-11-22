import { useEffect, useId, useRef, useState } from 'react'
import { API_MODE, type Lang } from '../api'
import { STRINGS } from '../i18n'
import {
  CONTINUATION_CHOICE_IDS,
  CONTINUATION_CHOICES,
  CONTINUATION_COPY,
  type ContinuationJob,
  type ContinuationChoiceId,
} from '../continuation'
import { comicHref, SCHOOL_MAP_COMIC_ID } from '../route'
import { GenerationProgress } from './GenerationProgress'

interface Props {
  sourceChapterId: typeof SCHOOL_MAP_COMIC_ID
  nextComicId: string
  lang: Lang
  buttonClass: string
  job: ContinuationJob
}

export function Continuation({ sourceChapterId, nextComicId, lang, buttonClass, job }: Props) {
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
            <p className="mt-1 font-semibold leading-relaxed text-ink">{CONTINUATION_CHOICES[choice].preview[lang]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView('choices')} className={`${buttonClass} bg-white`}>{t.chooseDifferent}</button>
              <button type="button" onClick={close} className={`${buttonClass} bg-white`}>{t.back}</button>
              <a href={comicHref(nextComicId)} className={`${buttonClass} bg-sun`}>{t.canonical}</a>
            </div>
            {choice === 'library-cabinet-key' && (
              <EpisodeAction lang={lang} sourceChapterId={sourceChapterId} buttonClass={buttonClass} job={job} />
            )}
          </>
        )}
      </section>
    </>
  )
}

function EpisodeAction({ lang, sourceChapterId, buttonClass, job }: Pick<Props, 'lang' | 'sourceChapterId' | 'buttonClass' | 'job'>) {
  const copy = CONTINUATION_COPY[lang]
  const t = STRINGS[lang]
  const { state, submit, resume, pauseWaiting } = job
  const wasPending = useRef(false)
  const readyComicId = state.phase === 'ready' ? state.comicId : null
  const pending = state.phase === 'submitting' || state.phase === 'waiting' || state.phase === 'paused'

  useEffect(() => {
    if (readyComicId && wasPending.current) {
      window.location.hash = comicHref(readyComicId)
    }
    wasPending.current = pending
  }, [pending, readyComicId])

  if (API_MODE !== 'live') {
    return <p className="mt-4 text-sm font-semibold">{copy.unavailable}</p>
  }

  const failure = state.phase === 'failed' ? state.failure : null
  let message = copy.generationNote
  if (state.phase === 'paused') message = t.pollPaused
  if (state.phase === 'ready') message = t.jobReady
  const stage = state.phase === 'submitting' ? 'submitting' :
    state.phase === 'waiting' ? (state.status === 'queued' ? 'queued' : 'storyboard') : undefined
  const progress = 'progress' in state ? state.progress : undefined

  return (
    <div className="mt-4 rounded-xl border-2 border-ink bg-sky p-3">
      {failure ? <p role="alert" className="font-semibold">{copy.failed}</p> :
        !stage && (state.phase !== 'ready' || !progress) && <p role="status" className="font-semibold">{message}</p>}
      {(stage || progress) && (
        <div className="mt-2"><GenerationProgress t={t} stage={stage} progress={progress} stopped={!stage} /></div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {(state.phase === 'idle' || failure) && (
          <button type="button" className={`${buttonClass} bg-white`} onClick={() => submit({
            sourceChapterId, choiceId: 'library-cabinet-key', locale: lang,
          })}>{failure ? t.tryAgain : copy.generate}</button>
        )}
        {state.phase === 'waiting' && (
          <button type="button" onClick={pauseWaiting} className={`${buttonClass} bg-white`}>{t.stopWaiting}</button>
        )}
        {state.phase === 'paused' && (
          <button type="button" onClick={resume} className={`${buttonClass} bg-white`}>{t.resumeChecking}</button>
        )}
        {state.phase === 'ready' && (
          <a href={comicHref(state.comicId)} className={`${buttonClass} bg-white`}>{copy.openEpisode}</a>
        )}
      </div>
    </div>
  )
}
