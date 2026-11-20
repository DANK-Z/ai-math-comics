import { ApiError } from './errors'
import type { Api, CheckResponse, Comic, ComicJob, ComicJobCreated, ContinuationJobRequest, HintResponse } from './types'

/** Pulls `detail` / `message` / `errorCode` out of an error body (FastAPI uses `detail`). */
async function readError(res: Response): Promise<ApiError> {
  let detail: string | null = null
  let code: string | null = null
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      code = typeof b.errorCode === 'string' ? b.errorCode : typeof b.code === 'string' ? b.code : null
      if (typeof b.detail === 'string') detail = b.detail
      else if (Array.isArray(b.detail)) detail = b.detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d))).join('; ')
      else if (typeof b.message === 'string') detail = b.message
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, `${res.status} ${res.statusText}`.trim(), { code, detail })
}

export function createHttpApi(baseUrl: string): Api & { createContinuationJob(body: ContinuationJobRequest): Promise<ComicJobCreated> } {
  const base = baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await fetch(`${base}${path}`, { ...init, headers })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError(0, 'Network error', { detail: e instanceof Error ? e.message : null })
    }
    if (!res.ok) throw await readError(res)
    return (await res.json()) as T
  }

  return {
    getComic(comicId, lang, signal) {
      return request<Comic>(`/api/comics/${encodeURIComponent(comicId)}?lang=${lang}`, { signal })
    },
    checkAnswer(exerciseId, body, signal) {
      return request<CheckResponse>(`/api/exercises/${encodeURIComponent(exerciseId)}/check`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      })
    },
    getHint(exerciseId, lang, step, signal) {
      return request<HintResponse>(
        `/api/exercises/${encodeURIComponent(exerciseId)}/hints?lang=${lang}&step=${step}`,
        { signal },
      )
    },
    createComicJob(req, signal) {
      // Contract: HTTP 202 Accepted. Any 2xx with a jobId is accepted.
      return request<ComicJobCreated>('/api/comic-jobs', { method: 'POST', body: JSON.stringify(req), signal })
    },
    createContinuationJob(body) {
      return request<ComicJobCreated>('/api/continuation-jobs', { method: 'POST', body: JSON.stringify(body) })
    },
    getComicJob(jobId, signal) {
      return request<ComicJob>(`/api/comic-jobs/${encodeURIComponent(jobId)}`, { signal })
    },
  }
}
