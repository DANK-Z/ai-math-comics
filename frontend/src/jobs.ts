import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, describeError, isAbortError } from './api'
import type { ComicJob, ComicJobCreated, ComicJobRequest, JobProgress } from './api'
import { requestLang, saveMyComic, type MyComicKind } from './myComics'

const POLL_MS = 1500
const TIMEOUT_MS = 3 * 60_000
/** Consecutive poll errors tolerated before giving up (transient network blips). */
const MAX_POLL_ERRORS = 3
const STORAGE_KEY = 'amc.activeJob'
type PollPause = { kind: 'timeout' } | { kind: 'api'; detail: string } | { kind: 'manual' }
type PendingJob<Request> = { request: Request; jobId: string; status: 'queued' | 'running'; startedAt: number; progress?: JobProgress }
type ResumeTarget = { jobId: string; startedAt: number; resumeToken: string }

export type JobFailure =
  | { kind: 'job'; code: string | null } // server says status=failed
  | { kind: 'api'; detail: string } // request failed
  | { kind: 'lost' } // job id unknown to the server

export type JobState<Request = ComicJobRequest> =
  | { phase: 'idle' }
  | { phase: 'submitting'; request: Request }
  | (PendingJob<Request> & { phase: 'waiting'; pollStartedAt: number })
  | (PendingJob<Request> & { phase: 'paused'; reason: PollPause })
  | { phase: 'ready'; request: Request; jobId: string; comicId: string; progress?: JobProgress }
  | { phase: 'failed'; request: Request; failure: JobFailure; progress?: JobProgress; resumeTarget?: ResumeTarget }

interface Stored<Request> {
  jobId: string
  request: Request
  startedAt: number
  reason?: PollPause
  comicId?: string
  status?: PendingJob<Request>['status']
  progress?: JobProgress
  failure?: JobFailure
  resumeToken?: string
}

function loadStored<Request>(storageKey: string): JobState<Request> {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return { phase: 'idle' }
    const s = JSON.parse(raw) as Stored<Request>
    if (typeof s.jobId !== 'string' || !s.request) return { phase: 'idle' }
    if (typeof s.comicId === 'string') return { phase: 'ready', jobId: s.jobId, request: s.request, comicId: s.comicId, progress: s.progress }
    if (s.failure?.kind === 'job') return {
      phase: 'failed', request: s.request, failure: s.failure, progress: s.progress,
      resumeTarget: s.resumeToken ? { jobId: s.jobId, startedAt: s.startedAt, resumeToken: s.resumeToken } : undefined,
    }
    const job: PendingJob<Request> = {
      request: s.request, jobId: s.jobId, status: s.status === 'running' ? 'running' : 'queued',
      startedAt: s.startedAt, progress: s.progress,
    }
    return s.reason
      ? { ...job, phase: 'paused', reason: s.reason }
      : { ...job, phase: 'waiting', pollStartedAt: Date.now() }
  } catch {
    return { phase: 'idle' }
  }
}

function store<Request>(storageKey: string, s: Stored<Request> | null) {
  try {
    if (s) sessionStorage.setItem(storageKey, JSON.stringify(s))
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* storage unavailable: the job just won't resume after a reload */
  }
}

/**
 * Comic generation job: POST once, then poll until ready/failed.
 * - Only one job at a time; submit() is ignored while one is in flight.
 * - Polling stops when the owning component unmounts (leaving the screen),
 *   pauses while the tab is hidden, and resumes from sessionStorage on return.
 */
export function useComicJob<Request = ComicJobRequest>(
  onReady: ((comicId: string, request: Request) => void) | undefined,
  {
    createJob,
    resumeJob,
    storageKey = STORAGE_KEY,
    rememberReady = false,
    saveToHistory = true,
    historyKind = 'generated',
  }: {
    createJob: (request: Request) => Promise<ComicJobCreated>
    resumeJob?: (jobId: string, resumeToken: string) => Promise<ComicJob>
    storageKey?: string
    rememberReady?: boolean
    saveToHistory?: boolean
    /** How a successful job is listed in My Comics. */
    historyKind?: MyComicKind
  },
) {
  const [state, setState] = useState<JobState<Request>>(() => loadStored(storageKey))
  const [resumingGeneration, setResumingGeneration] = useState(false)
  const [resumeError, setResumeError] = useState(false)
  const readyComicId = state.phase === 'ready' ? state.comicId : null
  const readyLang = state.phase === 'ready' ? requestLang(state.request) : null
  // A Create Comic request with `story` is a «Моя история» comic.
  const readyKind: MyComicKind =
    historyKind === 'generated' && state.phase === 'ready' && (state.request as { story?: unknown }).story ? 'story' : historyKind

  // Every successful job ends in 'ready' (freshly polled or restored from this tab's
  // storage); record it once in My Comics. Saving is idempotent per comic ID.
  useEffect(() => {
    if (saveToHistory && readyComicId && readyLang) saveMyComic({ comicId: readyComicId, kind: readyKind, lang: readyLang })
  }, [saveToHistory, readyComicId, readyLang, readyKind])
  const busy = useRef(state.phase === 'waiting' || state.phase === 'paused')
  const pollController = useRef<AbortController | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const submit = useCallback((request: Request) => {
    if (busy.current) return // synchronous guard against double clicks
    busy.current = true
    setResumeError(false)
    setState({ phase: 'submitting', request })
    createJob(request)
      .then((created) => {
        const startedAt = Date.now()
        store(storageKey, { jobId: created.jobId, request, startedAt })
        setState({ phase: 'waiting', request, jobId: created.jobId, status: created.status === 'running' ? 'running' : 'queued', startedAt, pollStartedAt: startedAt })
      })
      .catch((e) => {
        busy.current = false
        setState({ phase: 'failed', request, failure: { kind: 'api', detail: describeError(e) } })
      })
  }, [createJob, storageKey])

  const reset = useCallback(() => {
    pollController.current?.abort()
    busy.current = false
    setResumeError(false)
    store(storageKey, null)
    setState({ phase: 'idle' })
  }, [storageKey])

  const pause = useCallback((job: PendingJob<Request>, reason: PollPause) => {
    pollController.current?.abort()
    const { jobId, request, startedAt, status, progress } = job
    store(storageKey, { jobId, request, startedAt, status, progress, reason })
    setState({ ...job, phase: 'paused', reason })
  }, [storageKey])

  const resume = useCallback(() => {
    if (state.phase !== 'paused') return
    const { jobId, request, startedAt, status, progress } = state
    store(storageKey, { jobId, request, startedAt, status, progress })
    setState({ phase: 'waiting', jobId, request, startedAt, status, progress, pollStartedAt: Date.now() })
  }, [state, storageKey])

  async function resumeGeneration() {
    if (!resumeJob || busy.current || state.phase !== 'failed' || !state.resumeTarget) return
    const { jobId, startedAt, resumeToken } = state.resumeTarget
    const { request, progress, failure } = state
    const snapshot = { jobId, startedAt, request, progress }
    busy.current = true
    setResumingGeneration(true)
    setResumeError(false)
    // Reload during the POST can check the existing job without repeating the POST.
    store(storageKey, snapshot)
    const startPolling = (pending: PendingJob<Request>) => {
      store(storageKey, pending)
      setState({ ...pending, phase: 'waiting', pollStartedAt: Date.now() })
    }
    try {
      const job = await resumeJob(jobId, resumeToken)
      startPolling({
        ...snapshot,
        status: job.status === 'queued' ? 'queued' : 'running',
        progress: job.progress ?? progress,
      })
    } catch (error) {
      setResumeError(true)
      if (error instanceof ApiError && error.status === 409) {
        // Another attempt may have changed the failed state. Read its current status.
        startPolling({ ...snapshot, status: 'running' })
      } else {
        busy.current = false
        store(storageKey, { ...snapshot, failure, resumeToken })
      }
    } finally {
      setResumingGeneration(false)
    }
  }

  const waitingJob = state.phase === 'waiting' ? state.jobId : null
  const pollStartedAt = state.phase === 'waiting' ? state.pollStartedAt : null

  useEffect(() => {
    if (state.phase !== 'waiting') return
    const waiting = state
    const { jobId, request } = waiting
    const ctrl = new AbortController()
    pollController.current = ctrl
    let latest: PendingJob<Request> = waiting
    let timer: ReturnType<typeof setTimeout> | undefined
    let paused = false
    let errors = 0

    const finish = (next: JobState<Request>) => {
      if (ctrl.signal.aborted) return
      busy.current = false
      const snapshot = { jobId, request, startedAt: waiting.startedAt, progress: latest.progress }
      if (rememberReady && next.phase === 'ready') {
        store(storageKey, { ...snapshot, comicId: next.comicId })
      } else if (next.phase === 'failed' && next.failure.kind === 'job') {
        store(storageKey, { ...snapshot, failure: next.failure, resumeToken: next.resumeTarget?.resumeToken })
      } else {
        store(storageKey, null)
      }
      setState(next)
      if (next.phase === 'ready') onReadyRef.current?.(next.comicId, next.request)
    }

    const schedule = () => {
      if (Date.now() - waiting.pollStartedAt >= TIMEOUT_MS) return pause(latest, { kind: 'timeout' })
      timer = setTimeout(tick, POLL_MS)
    }

    async function tick() {
      timer = undefined
      if (document.hidden) {
        paused = true
        return
      }
      try {
        const job = await api.getComicJob(jobId, ctrl.signal)
        if (ctrl.signal.aborted) return
        errors = 0
        const progress = job.progress ?? latest.progress
        if (job.status === 'ready') {
          latest = { ...latest, progress }
          if (job.comicId) finish({ phase: 'ready', request, jobId, comicId: job.comicId, progress })
          else pause(latest, { kind: 'api', detail: 'ready without comicId' })
        } else if (job.status === 'failed') {
          latest = { ...latest, progress }
          finish({
            phase: 'failed', request, failure: { kind: 'job', code: job.errorCode }, progress,
            resumeTarget: job.resumeToken ? { jobId, startedAt: waiting.startedAt, resumeToken: job.resumeToken } : undefined,
          })
        } else {
          if (job.status !== latest.status || progress?.stage !== latest.progress?.stage ||
              progress?.completedPanels !== latest.progress?.completedPanels ||
              progress?.totalPanels !== latest.progress?.totalPanels) {
            latest = { jobId, request, startedAt: waiting.startedAt, status: job.status, progress }
            store(storageKey, latest)
            setState({ ...latest, phase: 'waiting', pollStartedAt: waiting.pollStartedAt })
          }
          schedule()
        }
      } catch (e) {
        if (ctrl.signal.aborted || isAbortError(e)) return
        if (e instanceof ApiError && e.status === 404) return finish({ phase: 'failed', request, failure: { kind: 'lost' } })
        if (++errors >= MAX_POLL_ERRORS) return pause(latest, { kind: 'api', detail: describeError(e) })
        schedule()
      }
    }

    const onVisibility = () => {
      if (!document.hidden && paused) {
        paused = false
        tick()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    tick()
    return () => {
      ctrl.abort()
      if (pollController.current === ctrl) pollController.current = null
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // Re-run only when a different job starts; status updates don't restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingJob, pollStartedAt, pause, rememberReady, storageKey])

  const active = state.phase === 'submitting' || state.phase === 'waiting'
  const pauseWaiting = () => {
    if (state.phase === 'waiting') pause(state, { kind: 'manual' })
  }
  return { state, active, submit, reset, resume, pauseWaiting, resumeGeneration, resumingGeneration, resumeError }
}
