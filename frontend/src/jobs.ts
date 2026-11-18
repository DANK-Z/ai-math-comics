import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, describeError, isAbortError } from './api'
import type { ComicJobRequest } from './api'

const POLL_MS = 1500
const TIMEOUT_MS = 3 * 60_000
/** Consecutive poll errors tolerated before giving up (transient network blips). */
const MAX_POLL_ERRORS = 3
const STORAGE_KEY = 'amc.activeJob'

export type JobFailure =
  | { kind: 'job'; code: string | null } // server says status=failed
  | { kind: 'api'; detail: string } // request failed
  | { kind: 'lost' } // job id unknown to the server
  | { kind: 'timeout' }

export type JobState =
  | { phase: 'idle' }
  | { phase: 'submitting'; request: ComicJobRequest }
  | { phase: 'waiting'; request: ComicJobRequest; jobId: string; status: 'queued' | 'running'; startedAt: number }
  | { phase: 'ready'; request: ComicJobRequest; jobId: string; comicId: string }
  | { phase: 'failed'; request: ComicJobRequest; failure: JobFailure }

interface Stored {
  jobId: string
  request: ComicJobRequest
  startedAt: number
}

function loadStored(): JobState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { phase: 'idle' }
    const s = JSON.parse(raw) as Stored
    if (typeof s.jobId !== 'string' || !s.request) return { phase: 'idle' }
    return { phase: 'waiting', request: s.request, jobId: s.jobId, status: 'queued', startedAt: s.startedAt }
  } catch {
    return { phase: 'idle' }
  }
}

function store(s: Stored | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(STORAGE_KEY)
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
export function useComicJob(onReady: (comicId: string, request: ComicJobRequest) => void) {
  const [state, setState] = useState<JobState>(loadStored)
  const busy = useRef(state.phase === 'waiting')
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const submit = useCallback((request: ComicJobRequest) => {
    if (busy.current) return // synchronous guard against double clicks
    busy.current = true
    setState({ phase: 'submitting', request })
    api
      .createComicJob(request)
      .then((created) => {
        const startedAt = Date.now()
        store({ jobId: created.jobId, request, startedAt })
        setState({ phase: 'waiting', request, jobId: created.jobId, status: created.status === 'running' ? 'running' : 'queued', startedAt })
      })
      .catch((e) => {
        busy.current = false
        setState({ phase: 'failed', request, failure: { kind: 'api', detail: describeError(e) } })
      })
  }, [])

  const reset = useCallback(() => {
    busy.current = false
    store(null)
    setState({ phase: 'idle' })
  }, [])

  const waitingJob = state.phase === 'waiting' ? state.jobId : null

  useEffect(() => {
    if (state.phase !== 'waiting') return
    const { jobId, request, startedAt } = state
    const ctrl = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let paused = false
    let errors = 0

    const finish = (next: JobState) => {
      if (ctrl.signal.aborted) return
      busy.current = false
      store(null)
      setState(next)
      if (next.phase === 'ready') onReadyRef.current(next.comicId, next.request)
    }

    const schedule = () => {
      if (Date.now() - startedAt > TIMEOUT_MS) return finish({ phase: 'failed', request, failure: { kind: 'timeout' } })
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
          else finish({ phase: 'failed', request, failure: { kind: 'api', detail: 'ready without comicId' } })
        } else if (job.status === 'failed') {
          finish({ phase: 'failed', request, failure: { kind: 'job', code: job.errorCode } })
        } else {
          if (ctrl.signal.aborted) return
          setState((s) => (s.phase === 'waiting' && s.status !== job.status ? { ...s, status: job.status as 'queued' | 'running' } : s))
          schedule()
        }
      } catch (e) {
        if (isAbortError(e)) return
        if (e instanceof ApiError && e.status === 404) return finish({ phase: 'failed', request, failure: { kind: 'lost' } })
        if (++errors >= MAX_POLL_ERRORS) return finish({ phase: 'failed', request, failure: { kind: 'api', detail: describeError(e) } })
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
  }, [waitingJob])

  const active = state.phase === 'submitting' || state.phase === 'waiting'
  return { state, active, submit, reset }
}
