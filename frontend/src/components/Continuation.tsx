import { useEffect, useId, useRef, useState } from 'react'
import { API_MODE, type Lang } from '../api'
import { STRINGS } from '../i18n'
import { cleanText, STORY_COPY, STORY_LIMITS, textError, type StoryError } from '../myStory'
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
  const [choice, setChoice] = useState<ContinuationChoiceId | null>(() => 'request' in job.state ? job.state.request.choiceId : null)
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
                  <label key={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 font-bold has-checked:bg-sun">
                    <input
                      type="radio"
                      name={panelId}
                      value={id}
                      checked={choice === id}
                      onChange={() => setChoice(id)}
                      className="h-4 w-4 shrink-0 accent-brand-dark"
                    />
                    <span>{CONTINUATION_CHOICES[id].label[lang]}</span>
                    {choice === id && <span aria-hidden="true">✓</span>}
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
            <h3 id={headingId} ref={heading} tabIndex={-1} className="text-lg font-black text-ink">{choice === 'free-premise' ? t.freeTitle : t.preview}</h3>
            <p className="mt-2 font-extrabold text-brand-dark">{CONTINUATION_CHOICES[choice].label[lang]}</p>
            <p className="mt-1 font-semibold leading-relaxed text-ink">{CONTINUATION_CHOICES[choice].preview[lang]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView('choices')} className={`${buttonClass} bg-white`}>{t.chooseDifferent}</button>
              <button type="button" onClick={close} className={`${buttonClass} bg-white`}>{t.back}</button>
              <a href={comicHref(nextComicId)} className={`${buttonClass} bg-sun`}>{t.canonical}</a>
            </div>
            <EpisodeAction key={choice} choice={choice} lang={lang} sourceChapterId={sourceChapterId} buttonClass={buttonClass} job={job} />
          </>
        )}
      </section>
    </>
  )
}

function EpisodeAction({ lang, sourceChapterId, buttonClass, job, choice }: Pick<Props, 'lang' | 'sourceChapterId' | 'buttonClass' | 'job'> & { choice: ContinuationChoiceId }) {
  const copy = CONTINUATION_COPY[lang]
  const t = STRINGS[lang]
  const { state, submit, resume, pauseWaiting } = job
  const wasPending = useRef(false)
  const own = 'request' in state && state.request.choiceId === choice
  const pending = state.phase === 'submitting' || state.phase === 'waiting' || state.phase === 'paused'
  const readyComicId = own && state.phase === 'ready' ? state.comicId : null
  const [premise, setPremise] = useState(() => 'request' in state && state.request.choiceId === 'free-premise' ? state.request.premise : '')
  const [invalid, setInvalid] = useState<StoryError | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  const rejected = own && state.phase === 'failed' && state.failure.kind === 'job' && state.failure.code === 'student_text_rejected'

  useEffect(() => {
    if (readyComicId && wasPending.current) {
      window.location.hash = comicHref(readyComicId)
    }
    wasPending.current = pending && own
  }, [pending, own, readyComicId])
  useEffect(() => {
    if (rejected && choice === 'free-premise') input.current?.focus()
  }, [choice, rejected])

  if (API_MODE !== 'live') {
    return <p className="mt-4 text-sm font-semibold">{copy.unavailable}</p>
  }
  if (!own && pending) return <p role="status" className="mt-4 text-sm font-bold">{copy.activeElsewhere}</p>

  const failure = own && state.phase === 'failed' ? state.failure : null
  const blocked = rejected && state.request.choiceId === 'free-premise' && cleanText(premise) === state.request.premise
  const canSubmit = !own || !!failure
  let message = copy.generationNote
  if (state.phase === 'paused') message = t.pollPaused
  if (readyComicId) message = t.jobReady
  const stage = state.phase === 'submitting' ? 'submitting' :
    state.phase === 'waiting' ? (state.status === 'queued' ? 'queued' : 'storyboard') : undefined
  const progress = own && 'progress' in state ? state.progress : undefined

  function createEpisode() {
    if (choice !== 'free-premise') {
      submit({ sourceChapterId, choiceId: choice, locale: lang })
      return
    }
    const value = cleanText(premise)
    const error = textError(value) ?? (!/\p{L}/u.test(value) ? 'required' : null)
    if (error) {
      setInvalid(error)
      input.current?.focus()
      return
    }
    setInvalid(null)
    submit({ sourceChapterId, choiceId: choice, locale: lang, premise: value })
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-ink bg-sky p-3">
      {choice === 'free-premise' && canSubmit && (
        <div className="mb-3 grid gap-1">
          <label htmlFor={inputId} className="font-black">{copy.freePrompt}</label>
          <textarea id={inputId} ref={input} value={premise} maxLength={STORY_LIMITS.premise} rows={3}
            placeholder={copy.freePlaceholder} aria-invalid={!!invalid || blocked || undefined}
            aria-describedby={`${inputId}-note${invalid || blocked ? ` ${inputId}-error` : ''}`}
            className="w-full resize-y rounded-xl border-[3px] border-ink bg-white p-2 aria-invalid:border-rose-700"
            onChange={(event) => { setPremise(event.target.value); setInvalid(null) }} />
          <p id={`${inputId}-note`} className="text-sm">{copy.moderationNote}</p>
        </div>
      )}
      {(failure || invalid) ? <p id={`${inputId}-error`} role="alert" className="font-semibold">{invalid ? STORY_COPY[lang].errors[invalid] : rejected ? copy.rejected : copy.failed}</p> :
        !stage && (!readyComicId || !progress) && <p role="status" className="font-semibold">{message}</p>}
      {(stage || progress) && (
        <div className="mt-2"><GenerationProgress t={t} stage={stage} progress={progress} stopped={!stage} /></div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {canSubmit && (
          <button type="button" className={`${buttonClass} bg-white`} onClick={createEpisode}>{failure ? t.tryAgain : copy.generate}</button>
        )}
        {state.phase === 'waiting' && (
          <button type="button" onClick={pauseWaiting} className={`${buttonClass} bg-white`}>{t.stopWaiting}</button>
        )}
        {state.phase === 'paused' && (
          <button type="button" onClick={resume} className={`${buttonClass} bg-white`}>{t.resumeChecking}</button>
        )}
        {readyComicId && (
          <a href={comicHref(readyComicId)} className={`${buttonClass} bg-white`}>{copy.openEpisode}</a>
        )}
      </div>
    </div>
  )
}
