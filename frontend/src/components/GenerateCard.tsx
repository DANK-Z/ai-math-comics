import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ART_MODE, resumeComicJob, type JobProgress, DIFFICULTIES, GRADES, LANGS, TOPICS, type ComicJobRequest, type Difficulty, type Grade, type Lang, type Topic } from '../api'
import { STRINGS, type UiStrings } from '../i18n'
import { useComicJob, type JobFailure, type JobState } from '../jobs'
import { STORY_COPY, draftFrom, validateStory, type StoryDraft, type StoryErrors } from '../myStory'
import { GenerationProgress } from './GenerationProgress'
import { MyStoryFields } from './MyStoryFields'
import { PifikSprite } from './PifikSprite'

interface Option<T> {
  value: T
  label: string
  lang?: string
}

/** Radio group styled as chunky comic buttons. Native radios keep keyboard + screen reader behaviour. */
function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-black text-ink/80">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={String(o.value)}
            lang={o.lang}
            className="group flex min-h-11 flex-auto cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[3px] border-ink bg-white px-4 text-center leading-tight font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] transition select-none hover:bg-sky has-checked:translate-y-[2px] has-checked:bg-sun has-checked:shadow-[0_1px_0_var(--shadow-ink)] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span aria-hidden className="hidden group-has-checked:inline">✓</span>
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function failureMessage(t: UiStrings, f: JobFailure): string {
  switch (f.kind) {
    case 'job':
      if (f.code === 'image_generation_failed') return t.jobErrors.image_generation_failed
      if (f.code === 'student_text_rejected') return t.jobErrors.student_text_rejected
      return f.code === 'generation_failed' ? t.jobErrors.generation_failed : t.jobErrors.unknown
    case 'api':
      return t.jobErrors.api
    case 'limit':
      return t.jobErrors.limit
    case 'lost':
      return t.jobErrors.lost
  }
}

function failureDetail(f: JobFailure): string | null {
  if (f.kind === 'job') return f.code ? `errorCode: ${f.code}` : null
  if (f.kind === 'api') return f.detail
  return null
}

function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [since])
  return since === null ? 0 : Math.max(0, Math.round((now - since) / 1000))
}

function WaitingJob({ state, t, onStop }: {
  state: Extract<JobState, { phase: 'submitting' | 'waiting' }>
  t: UiStrings
  onStop: () => void
}) {
  const waiting = state.phase === 'waiting' ? state : null
  const elapsed = useElapsed(waiting ? waiting.startedAt : null)
  const stage = waiting ? (waiting.status === 'queued' ? 'queued' : 'storyboard') : 'submitting'

  return (
    <div className="rounded-2xl border-[3px] border-ink bg-sky p-4">
      <div className="flex items-center gap-3">
        <PifikSprite className="w-12 shrink-0 rounded-full border-[3px] border-ink bg-white" />
        <div className="min-w-0 flex-1">
          <GenerationProgress t={t} stage={stage} progress={waiting?.progress} />
          <p className="mt-2 text-sm font-semibold text-ink/70">
            {t.jobWaitNote}
            {waiting && <span className="ml-1 tabular-nums">· {t.jobElapsed(elapsed)}</span>}
          </p>
        </div>
      </div>
      {waiting && (
        <div className="mt-4 text-center">
          <button type="button" onClick={onStop} className="min-h-11 text-sm font-extrabold text-brand-dark underline underline-offset-4 hover:text-ink">
            {t.stopWaiting}
          </button>
        </div>
      )}
    </div>
  )
}

function JobFailed({ failure, progress, t, onRetry, onEdit, onResume, resuming, resumeError }: {
  failure: JobFailure
  progress?: JobProgress
  t: UiStrings
  onRetry: () => void
  onEdit: () => void
  onResume?: () => void
  resuming: boolean
  resumeError: boolean
}) {
  const detail = failureDetail(failure)
  return (
    <div role="alert" className="rounded-2xl border-[3px] border-rose-700 bg-rose-50 p-4 text-rose-950">
      <p className="text-lg font-black">{t.jobFailedTitle}</p>
      <p className="mt-1 font-semibold">{failureMessage(t, failure)}</p>
      {progress && <div className="mt-2"><GenerationProgress t={t} progress={progress} stopped /></div>}
      {resumeError && <p className="mt-2 font-semibold">{t.resumeGenerationError}</p>}
      {detail && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-bold">{t.errorDetails}</summary>
          <code className="mt-1 block rounded-lg bg-white/70 px-2 py-1 break-words">{detail}</code>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResume ?? onRetry}
          disabled={resuming}
          className="min-h-11 rounded-2xl border-[3px] border-ink bg-sun px-4 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] active:translate-y-[2px] active:shadow-none"
        >
          <span aria-hidden="true">↻ </span>{onResume ? (resuming ? t.submitting : t.resumeGeneration) : t.tryAgain}
        </button>
        <button type="button" disabled={resuming} onClick={onEdit} className="min-h-11 rounded-2xl border-[3px] border-ink bg-white px-4 font-black text-ink">
          {t.changeParams}
        </button>
      </div>
    </div>
  )
}

function Field({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>
}

export function GenerateCard({ lang, onReady, autoOpen }: {
  lang: Lang
  onReady: (comicId: string, request: ComicJobRequest) => void
  autoOpen: boolean
}) {
  const t = STRINGS[lang]
  const { state, active, submit, reset, resume, pauseWaiting, resumeGeneration, resumingGeneration, resumeError } = useComicJob(autoOpen ? onReady : undefined, {
    createJob: api.createComicJob,
    resumeJob: resumeComicJob,
    rememberReady: true,
  })
  const resumed = state.phase === 'idle' ? null : state.request

  const [grade, setGrade] = useState<Grade>(resumed?.grade ?? 5)
  const [topic, setTopic] = useState<Topic>(resumed?.topic ?? 'fractions')
  const [difficulty, setDifficulty] = useState<Difficulty>(resumed?.difficulty ?? 'basic')
  const [comicLang, setComicLang] = useState<Lang>(resumed?.lang ?? lang)
  const [langTouched, setLangTouched] = useState(resumed !== null)
  // «Математический экспресс» (classic) or «Моя история» (student-designed story).
  const [mode, setMode] = useState<'express' | 'story'>(resumed?.story ? 'story' : 'express')
  const [story, setStory] = useState<StoryDraft>(() => draftFrom(resumed?.story))
  const [storyErrors, setStoryErrors] = useState<StoryErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const sc = STORY_COPY[lang]

  // The comic language follows the UI language until the user picks one.
  useEffect(() => {
    if (!langTouched) setComicLang(lang)
  }, [lang, langTouched])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (active) return
    const request: ComicJobRequest = { grade, topic, lang: comicLang, difficulty }
    if (mode === 'story') {
      const { errors, options } = validateStory(story)
      setStoryErrors(errors)
      if (!options) {
        // Move focus to the first field that needs attention.
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
        return
      }
      request.story = options
    }
    submit(request)
  }

  const locked = active || resumingGeneration || state.phase === 'ready' || state.phase === 'paused'

  return (
    <section
      aria-labelledby="generate-title"
      className="overflow-hidden rounded-2xl border-[4px] border-ink bg-cream shadow-[0_6px_0_var(--shadow-ink)]"
    >
      <div className="flex items-center gap-3 bg-brand px-4 py-3 text-white sm:px-5">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-sun text-lg">
          ✨
        </span>
        <div className="min-w-0">
          <h1 id="generate-title" className="text-xl leading-tight font-black sm:text-2xl">
            {t.createTitle}
          </h1>
          <p className="text-sm font-semibold text-white/90">{ART_MODE === 'prepared' ? t.prepared.createLead : t.createLead}</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:p-5" noValidate>
        <div role="group" aria-label={sc.modeLabel} className="grid grid-cols-2 gap-1.5 rounded-2xl border-[3px] border-ink bg-white p-1.5">
          {(['express', 'story'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              disabled={locked}
              onClick={() => setMode(m)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm leading-tight font-black text-ink transition sm:px-3 hover:bg-sky aria-pressed:bg-sun aria-pressed:shadow-[inset_0_0_0_2px_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 sm:text-base"
            >
              <span aria-hidden>{m === 'express' ? '⚡' : '✨'}</span><span>{sc.modes[m]}</span>
            </button>
          ))}
        </div>

        {mode === 'story' && (
          <fieldset disabled={locked} className="min-w-0">
            <MyStoryFields lang={lang} draft={story} onChange={setStory} errors={storyErrors} />
          </fieldset>
        )}

        {mode === 'story' && <h2 className="-mb-1 text-base font-black text-ink">{sc.mathTitle}</h2>}
        <fieldset disabled={locked} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field>
            <Segmented<Grade>
              legend={t.gradeLabel}
              options={GRADES.map((g) => ({ value: g, label: t.gradeOption(g) }))}
              value={grade}
              onChange={setGrade}
            />
          </Field>
          <Field>
            <Segmented<Topic> legend={t.topicLabel} options={TOPICS.map((v) => ({ value: v, label: t.topics[v] }))} value={topic} onChange={setTopic} />
          </Field>
          <Field>
            <Segmented<Lang>
              legend={t.comicLangLabel}
              options={LANGS.map((l) => ({ value: l, label: STRINGS[l].langName, lang: l }))}
              value={comicLang}
              onChange={(l) => {
                setLangTouched(true)
                setComicLang(l)
              }}
            />
          </Field>
          <div className="min-w-0 sm:col-span-2">
            <Segmented<Difficulty>
              legend={t.difficultyLabel}
              options={DIFFICULTIES.map((d) => ({ value: d, label: t.difficulties[d] }))}
              value={difficulty}
              onChange={setDifficulty}
            />
          </div>
        </fieldset>

        {mode === 'story' && Object.keys(storyErrors).length > 0 && state.phase === 'idle' && (
          <p role="alert" className="rounded-xl border-2 border-rose-600 bg-rose-50 px-3 py-2 font-bold text-rose-800">{sc.fixErrors}</p>
        )}
        {state.phase === 'failed' ? (
          <JobFailed
            failure={state.failure} progress={state.progress} t={t}
            onRetry={() => submit(state.request)} onEdit={reset}
            onResume={resumeComicJob && state.resumeTarget ? resumeGeneration : undefined}
            resuming={resumingGeneration} resumeError={resumeError}
          />
        ) : state.phase === 'paused' ? (
          <div className="rounded-2xl border-[3px] border-ink bg-sky p-4">
            <p role="status" className="mb-2 font-semibold">{t.pollPaused}</p>
            <GenerationProgress t={t} progress={state.progress} stopped />
            {state.reason.kind === 'api' && (
              <details className="mt-2 text-sm">
                <summary>{t.errorDetails}</summary>
                <code className="break-words">{state.reason.detail}</code>
              </details>
            )}
            <button type="button" onClick={resume} className="mt-3 min-h-11 rounded-2xl border-[3px] border-ink bg-sun px-4 font-black">
              {t.resumeChecking}
            </button>
          </div>
        ) : state.phase === 'ready' ? (
          <div className="rounded-2xl border-[3px] border-ink bg-sky p-4">
            {state.progress ? <GenerationProgress t={t} progress={state.progress} stopped /> : <p role="status" className="font-black">{t.jobReady}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onReady(state.comicId, state.request)} className="min-h-11 rounded-xl border-2 border-ink bg-sun px-3 font-black">
                {t.readComic}
              </button>
              <button type="button" onClick={reset} className="min-h-11 rounded-xl border-2 border-ink bg-white px-3 font-black">
                {t.navigation.createAnother}
              </button>
            </div>
          </div>
        ) : state.phase === 'idle' ? (
          <button
            type="submit"
            className="min-h-14 rounded-2xl border-[3px] border-ink bg-sun px-5 text-xl font-black text-ink shadow-[0_5px_0_var(--shadow-ink)] transition hover:brightness-105 active:translate-y-[4px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden="true">✨ </span>{t.generate}
          </button>
        ) : (
          <WaitingJob state={state} t={t} onStop={pauseWaiting} />
        )}
      </form>
    </section>
  )
}
