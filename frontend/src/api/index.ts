import { createHttpApi } from './httpApi'
import { mockApi } from './mockApi'
import { checkSchoolStoreAnswer, schoolStoreComic, schoolStoreHint, SCHOOL_STORE_EXERCISE_ID } from './schoolStore'
import type { Api } from './types'
import { withPizzaArtwork } from '../art/pizza'
import { DEMO_COMIC_ID, SCHOOL_STORE_COMIC_ID } from '../route'

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
/**
 * How generated comics get artwork. Must match the backend's COMIC_ART_MODE.
 * 'prepared' (default, also what the mocks do) reuses the bundled illustrations;
 * 'live' asks the image provider to draw new panels.
 */
export const ART_MODE: 'prepared' | 'live' = import.meta.env.VITE_COMIC_ART_MODE === 'live' ? 'live' : 'prepared'
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

const configuredApi = API_MODE === 'live' ? createHttpApi(BASE_URL) : mockApi

export const api: Api = {
  ...configuredApi,
  async getComic(id, lang, signal) {
    if (id === SCHOOL_STORE_COMIC_ID) {
      signal?.throwIfAborted()
      return schoolStoreComic(lang)
    }
    const comic = await configuredApi.getComic(id, lang, signal)
    return id === DEMO_COMIC_ID ? withPizzaArtwork(comic) : comic
  },
  async checkAnswer(id, request, signal) {
    if (id !== SCHOOL_STORE_EXERCISE_ID) return configuredApi.checkAnswer(id, request, signal)
    signal?.throwIfAborted()
    return checkSchoolStoreAnswer(request.answer, request.lang)
  },
  async getHint(id, lang, step, signal) {
    if (id !== SCHOOL_STORE_EXERCISE_ID) return configuredApi.getHint(id, lang, step, signal)
    signal?.throwIfAborted()
    return schoolStoreHint(lang, step)
  },
}

/**
 * Panel `imageUrl` from the server may be absolute or relative to the API origin
 * (e.g. "/media/abc.png"). Mock URLs are served by the frontend itself.
 */
export function resolveImageUrl(url: string): string {
  if (/^(https?:|data:|blob:)/i.test(url) || url.startsWith('//')) return url
  if (API_MODE === 'mock') return url
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export * from './types'
export { ApiError, describeError, isAbortError } from './errors'
