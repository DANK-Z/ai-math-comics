import { authToken } from './authToken'
import { ApiError } from './errors'
import type { AccountApi, Api, AuthResponse, BossState, CheckResponse, ClassInfo, Comic, ComicJob, ComicJobCreated, ContinuationJobRequest, Dashboard, HintResponse, Me, Shop } from './types'

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

export function createHttpApi(baseUrl: string): Api & AccountApi & {
  createContinuationJob(body: ContinuationJobRequest): Promise<ComicJobCreated>
  resumeComicJob(jobId: string, resumeToken: string): Promise<ComicJob>
} {
  const base = baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body) headers['Content-Type'] = 'application/json'
    // Signed-in users send their JWT; the server treats a stale token on checks as a guest.
    const token = authToken.get()
    if (token) headers.Authorization = `Bearer ${token}`
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
    resumeComicJob(jobId, resumeToken) {
      return request<ComicJob>(`/api/comic-jobs/${encodeURIComponent(jobId)}/resume`, {
        method: 'POST', body: JSON.stringify({ resumeToken }),
      })
    },
    signUpStudent(body) {
      return request<AuthResponse>('/api/auth/students', { method: 'POST', body: JSON.stringify(body) })
    },
    signUpTeacher(body) {
      return request<AuthResponse>('/api/auth/teachers', { method: 'POST', body: JSON.stringify(body) })
    },
    logIn(body) {
      return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
    },
    me() {
      return request<Me>('/api/me')
    },
    joinClass(code) {
      return request<Me>('/api/me/class', { method: 'POST', body: JSON.stringify({ code }) })
    },
    saveProgress(body) {
      return request<Me>('/api/me/progress', { method: 'PUT', body: JSON.stringify(body) })
    },
    bossState(comicId, signal) {
      return request<BossState>(`/api/me/boss/${encodeURIComponent(comicId)}`, { signal })
    },
    createClass(body) {
      return request<ClassInfo>('/api/teacher/classes', { method: 'POST', body: JSON.stringify(body) })
    },
    listClasses() {
      return request<ClassInfo[]>('/api/teacher/classes')
    },
    dashboard(classId, signal) {
      return request<Dashboard>(`/api/teacher/classes/${classId}`, { signal })
    },
    shop(signal) {
      return request<Shop>('/api/v1/shop', { signal })
    },
    buy(itemId) {
      return request<Shop>('/api/v1/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) })
    },
    equip(backpackItemId) {
      return request<Shop>('/api/v1/backpack/equip', { method: 'POST', body: JSON.stringify({ itemId: backpackItemId }) })
    },
  }
}
