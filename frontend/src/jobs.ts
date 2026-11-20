import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, describeError, isAbortError } from './api'
import type { ComicJobCreated, ComicJobRequest } from './api'

const POLL_MS = 1500
const TIMEOUT_MS = 3 * 60_000
/** Consecutive poll errors tolerated before giving up (transient network blips). */
const MAX_POLL_ERRORS = 3
const STORAGE_KEY = 'amc.activeJob'
type PollPause = { kind: 'timeout' } | { kind: 'api'; detail: string } | { kind: 'manual' }
type PendingJob<Request> = { request: Request; jobId: string; status: 'queued' | 'running'; startedAt: number }

export type JobFailure =
  | { kind: 'job'; code: string | null } // server says status=failed
  | { kind: 'api'; detail: string } // request failed
  | { kind: 'lost' } // job id unknown to the server

export type JobState<Request = ComicJobRequest> =
  | { phase: 'idle' }
  | { phase: 'submitting'; request: Request }
  | (PendingJob<Request> & { phase: 'waiting'; pollStartedAt: number })
  | (PendingJob<Request> & { phase: 'paused'; reason: PollPause })
  | { phase: 'ready'; request: Request; jobId: string; comicId: string }
  | { phase: 'failed'; request: Request; failure: JobFailure }

interface Stored<Request> {
  jobId: string
  request: Request
  startedAt: number
  reason?: PollPause
  comicId?: string
}

function loadStored<Request>(storageKey: string): JobState<Request> {
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return { phase: 'idle' }
    const s = JSON.parse(raw) as Stored<Request>
    if (typeof s.jobId !== 'string' || !s.request) return { phase: 'idle' }
    if (typeof s.comicId === 'string') return { phase: 'ready', jobId: s.jobId, request: s.request, comicId: s.comicId }
    const job: PendingJob<Request> = { request: s.request, jobId: s.jobId, status: 'queued', startedAt: s.startedAt }
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
    storageKey = STORAGE_KEY,
    rememberReady = false,
  }: {
    createJob: (request: Request) => Promise<ComicJobCreated>
    storageKey?: string
    rememberReady?: boolean
  },
) {
  const [state, setState] = useState<JobState<Request>>(() => loadStored(storageKey))
  const busy = useRef(state.phase === 'waiting' || state.phase === 'paused')
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const submit = useCallback((request: Request) => {
    if (busy.current) return // synchronous guard against double clicks
    busy.current = true
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
    busy.current = false
    store(storageKey, null)
    setState({ phase: 'idle' })
  }, [storageKey])

  const pause = useCallback((job: PendingJob<Request>, reason: PollPause) => {
    const { jobId, request, startedAt } = job
    store(storageKey, { jobId, request, startedAt, reason })
    setState({ ...job, phase: 'paused', reason })
  }, [storageKey])

  const resume = useCallback(() => {
    if (state.phase !== 'paused') return
    const { jobId, request, startedAt, status } = state
    store(storageKey, { jobId, request, startedAt })
    setState({ phase: 'waiting', jobId, request, startedAt, status, pollStartedAt: Date.now() })
  }, [state, storageKey])

  const waitingJob = state.phase === 'waiting' ? state.jobId : null
  const pollStartedAt = state.phase === 'waiting' ? state.pollStartedAt : null

  useEffect(() => {
    if (state.phase !== 'waiting') return
    const waiting = state
    const { jobId, request } = waiting
    const ctrl = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let paused = false
    let errors = 0

    const finish = (next: JobState<Request>) => {
      if (ctrl.signal.aborted) return
      busy.current = false
      store(storageKey, rememberReady && next.phase === 'ready'
        ? { jobId, request, startedAt: waiting.startedAt, comicId: next.comicId }
        : null)
      setState(next)
      if (next.phase === 'ready') onReadyRef.current?.(next.comicId, next.request)
    }

    const schedule = () => {
      if (Date.now() - waiting.pollStartedAt >= TIMEOUT_MS) return pause(waiting, { kind: 'timeout' })
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
        errors = 0
        if (job.status === 'ready') {
          if (job.comicId) finish({ phase: 'ready', request, jobId, comicId: job.comicId })
          else pause(waiting, { kind: 'api', detail: 'ready without comicId' })
        } else if (job.status === 'failed') {
          finish({ phase: 'failed', request, failure: { kind: 'job', code: job.errorCode } })
        } else {
          if (ctrl.signal.aborted) return
          setState((s) => (s.phase === 'waiting' && s.status !== job.status ? { ...s, status: job.status as 'queued' | 'running' } : s))
          schedule()
        }
      } catch (e) {
        if (ctrl.signal.aborted || isAbortError(e)) return
        if (e instanceof ApiError && e.status === 404) return finish({ phase: 'failed', request, failure: { kind: 'lost' } })
        if (++errors >= MAX_POLL_ERRORS) return pause(waiting, { kind: 'api', detail: describeError(e) })
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
  return { state, active, submit, reset, resume, pauseWaiting }
}
