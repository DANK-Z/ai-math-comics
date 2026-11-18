import { ApiError } from './errors'
import type { Api, CheckResponse, Comic, HintResponse } from './types'

export function createHttpApi(baseUrl: string): Api {
  const base = baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${base}${path}`, { ...init, headers })
    if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
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
  }
}
