import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { API_MODE, ApiError, classroomApi, isAbortError, type ClassInfo, type ComicJobRequest, type Lang, type TeacherDraft, type TeacherDraftJob, type TeacherPublication, type TeacherTask, type TeacherTaskText } from '../api'
import { ASSIGNMENT_COPY, REVISED_TASK_DIALOGUE } from '../assignmentCopy'
import { BOSS_COPY } from '../boss'
import { STRINGS } from '../i18n'
import { useComicJob } from '../jobs'
import { draftFrom, STORY_COPY, validateStory, type StoryErrors } from '../myStory'
import { MyStoryFields } from './MyStoryFields'
import { PanelArt } from './PanelArt'
import { GenerationProgress } from './GenerationProgress'

const CARD = 'min-w-0 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--color-ink)] sm:p-4'
const CONTROL = 'w-full min-w-0 rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold focus-visible:outline-3 focus-visible:outline-brand aria-invalid:border-rose-700'
const BUTTON = 'inline-flex min-h-11 items-center rounded-xl border-[3px] border-ink bg-white px-3 py-2 text-start font-black focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-50'
const PRIMARY = BUTTON.replace('bg-white', 'bg-sun')
const DEFAULT_REQUEST = { grade: 5, topic: 'equations', difficulty: 'advanced', lang: 'ru' } satisfies ComicJobRequest
const api = classroomApi!

export function TeacherWorkshop({ lang, classes, teacherId }: {
  lang: Lang; classes: ClassInfo[]; teacherId: number
}) {
  const copy = ASSIGNMENT_COPY[lang]
  const [open, setOpen] = useState(false)
  const controls = useId()
  if (API_MODE !== 'live') return null
  return (
    <section className={CARD}>
      <button type="button" className={PRIMARY} aria-expanded={open} aria-controls={controls} onClick={() => setOpen(!open)}>{copy.create}</button>
      <div id={controls}>{open && <Workshop lang={lang} classes={classes} teacherId={teacherId} />}</div>
    </section>
  )
}

function Workshop({ lang, classes, teacherId }: { lang: Lang; classes: ClassInfo[]; teacherId: number }) {
  const copy = ASSIGNMENT_COPY[lang]
  const t = STRINGS[lang]
  const [comicId, setComicId] = useState<string | null>(null)
  const onReady = useCallback((id: string) => setComicId(id), [])
  const { state, active, submit, reset, resume, resumeGeneration, resumingGeneration, resumeError } = useComicJob(onReady, {
    createJob: api.createDraft, resumeJob: api.resumeComicJob, storageKey: `amc.teacher.draftJob.${teacherId}`,
    saveToHistory: false,
  })
  const [story, setStory] = useState(() => draftFrom(state.phase === 'idle' ? undefined : state.request.story))
  const [request, setRequest] = useState<ComicJobRequest>(() => state.phase === 'idle' ? DEFAULT_REQUEST : state.request)
  const [errors, setErrors] = useState<StoryErrors>({})
  const [drafts, setDrafts] = useState<TeacherDraftJob[]>([])
  const [loadError, setLoadError] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const storyHeading = useId()
  const phase = state.phase
  const locked = active || resumingGeneration || phase === 'paused'

  useEffect(() => {
    const ctrl = new AbortController()
    function refresh() {
      api.draftJobs(lang, ctrl.signal).then((jobs) => { setDrafts(jobs); setLoadError(false) }).catch((err) => {
        if (!isAbortError(err)) setLoadError(true)
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => { ctrl.abort(); window.clearInterval(interval) }
  }, [lang, phase])

  function generate(event: FormEvent) {
    event.preventDefault()
    const result = validateStory(story)
    setErrors(result.errors)
    if (result.options) {
      setComicId(null)
      submit({ ...request, lang, story: result.options })
    } else {
      window.requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    }
  }

  return (
    <div className="mt-4 grid gap-5">
      <form ref={form} onSubmit={generate} noValidate className="grid gap-4" aria-labelledby={storyHeading}>
        <h2 id={storyHeading} className="text-xl font-black">{STORY_COPY[lang].modes.story}</h2>
        <fieldset disabled={locked} className="min-w-0 space-y-4">
          <MyStoryFields lang={lang} draft={story} onChange={setStory} errors={errors} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">{t.gradeLabel}
              <select className={CONTROL} value={request.grade} onChange={(e) => setRequest({ ...request, grade: e.target.value === '6' ? 6 : 5 })}>
                <option value={5}>{t.gradeOption(5)}</option><option value={6}>{t.gradeOption(6)}</option>
              </select>
            </label>
            <label className="grid gap-1 font-bold">{t.topicLabel}
              <select className={CONTROL} value={request.topic} onChange={(e) => setRequest({ ...request, topic: e.target.value === 'fractions' ? 'fractions' : 'equations' })}>
                <option value="equations">{t.topics.equations}</option><option value="fractions">{t.topics.fractions}</option>
              </select>
            </label>
          </div>
        </fieldset>
        {!locked && (phase === 'idle' || phase === 'failed' || phase === 'ready') && <button className={PRIMARY + ' w-fit'}>{copy.generate}</button>}
        {phase === 'waiting' && <GenerationProgress t={t} stage={state.status === 'queued' ? 'queued' : 'storyboard'} progress={state.progress} />}
        {phase === 'submitting' && <p role="status">{copy.working}</p>}
        {phase === 'paused' && <button className={BUTTON + ' w-fit'} type="button" onClick={resume}>{t.resumeChecking}</button>}
        {phase === 'failed' && (
          <div className="grid gap-2">
            <p role="alert">{copy.failedDraft}{state.failure.kind === 'job' && ' · ' + state.failure.code}</p>
            {state.resumeTarget && <button className={PRIMARY + ' w-fit'} type="button" disabled={resumingGeneration} onClick={resumeGeneration}>{t.resumeGeneration}</button>}
            {resumeError && <p role="alert">{copy.error}</p>}
            <button className={BUTTON + ' w-fit'} type="button" onClick={reset}>{t.retry}</button>
          </div>
        )}
      </form>
      {loadError && <p role="alert">{copy.error}</p>}
      {!!drafts.length && (
        <div>
          <h2 className="font-black">{copy.drafts}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {drafts.map((draft) => (
              <li key={draft.jobId}>
                {draft.publicationStatus === 'published'
                  ? <span className="text-sm font-bold">{copy.sent} · {draft.title}</span>
                  : draft.comicId
                    ? <button type="button" className={BUTTON} onClick={() => setComicId(draft.comicId)}>{copy.edit} · {draft.title}</button>
                    : <span className="text-sm font-semibold">{draft.status === 'failed' ? copy.failedDraft : copy.pendingDraft}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {comicId && <DraftLoader key={comicId} lang={lang} comicId={comicId} classes={classes} request={request} />}
    </div>
  )
}

function DraftLoader({ comicId, lang, classes, request }: {
  comicId: string; lang: Lang; classes: ClassInfo[]; request: ComicJobRequest
}) {
  const copy = ASSIGNMENT_COPY[lang]
  const [draft, setDraft] = useState<TeacherDraft | null>(null)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const ctrl = new AbortController()
    api.draft(comicId, ctrl.signal).then(setDraft).catch((err) => {
      if (!isAbortError(err)) setError(true)
    })
    return () => ctrl.abort()
  }, [comicId, nonce])
  if (error) return <div role="alert">{copy.error} <button type="button" className={BUTTON} onClick={() => { setError(false); setNonce((n) => n + 1) }}>{STRINGS[lang].retry}</button></div>
  if (!draft) return <p role="status">{copy.loading}</p>
  return <DraftEditor draft={draft} classes={classes} lang={lang} request={request} />
}

function DraftEditor({ draft, lang, classes, request }: {
  draft: TeacherDraft; lang: Lang; classes: ClassInfo[]; request: ComicJobRequest
}) {
  const copy = ASSIGNMENT_COPY[lang]
  const prefix = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [editing, setEditing] = useState(lang)
  const [bank, setBank] = useState<TeacherTask[] | null>(null)
  const [busy, setBusy] = useState<'task' | 'publish' | 'bank' | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<'general' | 'answer' | 'fields' | null>(null)
  const [value, setValue] = useState<TeacherPublication>(() => ({
    classId: classes[0]?.id ?? 0,
    dueDate: null,
    task: draft.task,
    ru: { title: draft.ru.title, panels: draft.ru.panels.map((p) => p.text) },
    kk: { title: draft.kk.title, panels: draft.kk.panels.map((p) => p.text) },
  }))
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    if (!busy && error === 'answer') document.getElementById(prefix + '-answer')?.focus()
  }, [busy, error, prefix])

  function withNewTask(current: TeacherPublication, task: TeacherTask): TeacherPublication {
    const original = draft.task
    const replacesOriginal = current.task.answer === original.answer &&
      current.task.ru.prompt === original.ru.prompt && current.task.kk.prompt === original.kk.prompt &&
      (task.answer !== original.answer || task.ru.prompt !== original.ru.prompt || task.kk.prompt !== original.kk.prompt)
    if (!replacesOriginal) return { ...current, task }
    // Replace only the generated lines tied to the old solution. Keep teacher edits.
    const update = (l: Lang) => ({
      ...current[l],
      panels: current[l].panels.map((line, i) => i >= 3 && line === draft[l].panels[i].text ? REVISED_TASK_DIALOGUE[l][i - 3] : line),
    })
    return { ...current, task, ru: update('ru'), kk: update('kk') }
  }

  function updateTask(key: keyof TeacherTaskText, text: string) {
    setValue((v) => withNewTask(v, { ...v.task, [editing]: { ...v.task[editing], [key]: text } }))
  }
  function replaceTask(task: TeacherTask) {
    setValue((v) => withNewTask(v, task))
    setError(null)
    setStatus('')
  }
  function manual() {
    const empty = { prompt: '', hint1: '', hint2: '' }
    replaceTask({ ...value.task, answer: '', ru: empty, kk: empty })
    document.getElementById(prefix + '-prompt')?.focus()
  }
  async function generateTask() {
    setBusy('task')
    setError(null)
    try {
      replaceTask(await api.generateTask({ grade: request.grade, difficulty: request.difficulty, lang: editing, topic: value.task.boss === 'x-master' ? 'equations' : 'fractions' }))
    } catch { setError('general') }
    finally { setBusy(null) }
  }
  async function toggleBank() {
    if (bank) { setBank(null); return }
    setBusy('bank')
    setError(null)
    try { setBank(await api.problemBank()) }
    catch { setError('general') }
    finally { setBusy(null) }
  }
  async function publish(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const missing = (['ru', 'kk'] as const).find((l) =>
      [value[l].title, ...value[l].panels, ...Object.values(value.task[l])].some((text) => !text.trim()),
    )
    if (missing) {
      setEditing(missing)
      setError('fields')
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setBusy('publish')
    try {
      const assignment = await api.publishDraft(draft.ru.id, value)
      setStatus(assignment.id)
    } catch (err) {
      if (err instanceof ApiError && err.detail === 'invalid_teacher_answer') {
        setError('answer')
      } else setError('general')
    } finally { setBusy(null) }
  }

  const local = value[editing]
  const task = value.task[editing]
  const missing = (text: string) => error === 'fields' && !text.trim()
  const issue = prefix + '-error'

  return (
    <form ref={formRef} className="grid gap-4 border-t-[3px] border-ink pt-4" onSubmit={publish}>
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-black">{copy.editor}</h2>
      <div className="flex gap-2" aria-label={STRINGS[lang].comicLangLabel} role="group">
        {(['ru', 'kk'] as const).map((l) => <button type="button" key={l} lang={l} className={editing === l ? PRIMARY : BUTTON} aria-pressed={editing === l} onClick={() => setEditing(l)}>{editing === l && '✓ '}{STRINGS[l].langName}</button>)}
      </div>
      <label className="grid gap-1 font-black">{copy.title}
        <input className={CONTROL} maxLength={100} lang={editing} aria-invalid={missing(local.title)} aria-describedby={missing(local.title) ? issue : undefined} value={local.title} onChange={(e) => setValue({ ...value, [editing]: { ...local, title: e.target.value } })} />
      </label>
      {draft[editing].panels.map((panel, index) => (
        <section key={panel.id} className={CARD} aria-labelledby={prefix + '-panel-' + panel.id}>
          <h3 id={prefix + '-panel-' + panel.id} className="mb-2 text-lg font-black">{copy.panel(panel.id)}{panel.id === 4 && ' · ' + copy.battle}</h3>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border-2 border-ink"><PanelArt {...panel} lang={editing} thumb /></div>
            <label className="grid content-start gap-1 font-black">{panel.speaker}
              <textarea className={CONTROL} rows={3} maxLength={400} lang={editing} aria-invalid={missing(local.panels[index])} aria-describedby={missing(local.panels[index]) ? issue : undefined} value={local.panels[index]} onChange={(e) => {
                const panels = local.panels.slice()
                panels[index] = e.target.value
                setValue({ ...value, [editing]: { ...local, panels } })
              }} />
            </label>
          </div>
          {panel.id === 4 && (
            <fieldset disabled={!!busy} className="mt-4 grid min-w-0 gap-3">
              <legend className="font-black">{copy.battle}</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={BUTTON} onClick={generateTask}>{copy.ai}</button>
                <button type="button" className={BUTTON} aria-expanded={!!bank} onClick={toggleBank}>{copy.bank}</button>
                <button type="button" className={BUTTON} onClick={manual}>{copy.manual}</button>
              </div>
              {bank && <ul className="grid gap-2">
                {bank.map((entry, i) => <li key={i}><button lang={editing} type="button" className={BUTTON} onClick={() => replaceTask(entry)}>{entry[editing].prompt}</button></li>)}
              </ul>}
              <p className="text-sm font-semibold">{copy.rescript}</p>
              <label className="grid gap-1 font-black">{copy.boss}
                <select className={CONTROL} value={value.task.boss} onChange={(e) => setValue({ ...value, task: { ...value.task, boss: e.target.value === 'x-master' ? 'x-master' : 'fraction-slime' } })}>
                  <option value="fraction-slime">{BOSS_COPY[lang].names['fraction-slime']}</option>
                  <option value="x-master">{BOSS_COPY[lang].names['x-master']}</option>
                </select>
              </label>
              {(['prompt', 'hint1', 'hint2'] as const).map((key, i) => (
                <label key={key} className="grid gap-1 font-black">{i === 0 ? copy.prompt : copy.hints[i - 1]}
                  <textarea id={prefix + '-' + key} className={CONTROL} rows={2} maxLength={400} lang={editing} aria-invalid={missing(task[key])} aria-describedby={missing(task[key]) ? issue : undefined} value={task[key]} onChange={(e) => updateTask(key, e.target.value)} />
                </label>
              ))}
              <label className="grid gap-1 font-black">{copy.answer}
                <input id={prefix + '-answer'} className={CONTROL} maxLength={40} aria-invalid={error === 'answer'} aria-describedby={error === 'answer' ? issue : undefined} value={value.task.answer} onChange={(e) => setValue(withNewTask(value, { ...value.task, answer: e.target.value }))} />
              </label>
            </fieldset>
          )}
        </section>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 font-black">{copy.selectClass}
          <select className={CONTROL} disabled={!!status} value={value.classId} onChange={(e) => setValue({ ...value, classId: Number(e.target.value) })}>
            <option value={0} disabled>{copy.selectClass}</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 font-black">{copy.due}
          <input className={CONTROL} type="date" value={value.dueDate ?? ''} onChange={(e) => setValue({ ...value, dueDate: e.target.value || null })} />
        </label>
      </div>
      {!classes.length && <p>{copy.needClass}</p>}
      {error && <p id={issue} role="alert" className="font-bold text-rose-800">{error === 'answer' ? copy.invalidAnswer : error === 'fields' ? copy.allLanguages : copy.error}</p>}
      {busy && <p role="status">{copy.working}</p>}
      {status && <p role="status" className="break-words font-bold">{copy.sent} · {status}</p>}
      <button className={PRIMARY + ' w-fit'} disabled={!!busy || !value.classId || !!status}>{copy.send}</button>
    </form>
  )
}
