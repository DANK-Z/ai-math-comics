import { createHttpApi } from './httpApi'
import { mockAccounts } from './mockAccounts'
import { isAbortError } from './errors'
import { mockApi } from './mockApi'
import { FAIR_CHAPTERS, LIBRARY_BOXES, SCHOOL_MAP } from './fairChapters'
import { buildLocalComic, checkLocalAnswer, localHint, type LocalComicDef } from './localComics'
import { LIGHTS_CHAPTERS } from './lightsChapters'
import { MARS_CHAPTERS } from './marsChapters'
import { BURABAY_CHAPTERS } from './burabayChapters'
import { MUSEUM_CHAPTERS } from './museumChapters'
import { ROADS_CHAPTERS } from './roadsChapters'
import { SCHOOL_STORE } from './schoolStore'
import { WEATHER_CHAPTERS } from './weatherChapters'
import type { AccountApi, Api } from './types'
import { withPizzaArtwork } from '../art/pizza'
import { DEMO_COMIC_ID } from '../route'

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
/**
 * How generated comics get artwork. Must match the backend's COMIC_ART_MODE.
 * 'prepared' (default, also what the mocks do) reuses the bundled illustrations;
 * 'live' asks the image provider to draw new panels.
 */
export const ART_MODE: 'prepared' | 'live' = import.meta.env.VITE_COMIC_ART_MODE === 'live' ? 'live' : 'prepared'
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

const httpApi = createHttpApi(BASE_URL)
export const classroomApi = API_MODE === 'live' ? httpApi : undefined
const configuredApi = API_MODE === 'live' ? httpApi : mockApi
/** Sign-up/sign-in, class codes, saved progress and the teacher dashboard. */
export const accounts: AccountApi = API_MODE === 'live' ? httpApi : mockAccounts
export const createContinuationJob = httpApi.createContinuationJob
export const resumeComicJob = API_MODE === 'live' ? httpApi.resumeComicJob : undefined

/** Bundled chapters 2–6 of “Operation: School Fair”: served locally in both API modes, no generator needed. */
export const LOCAL_COMICS: readonly LocalComicDef[] = [SCHOOL_STORE, ...FAIR_CHAPTERS, ...ROADS_CHAPTERS, ...LIGHTS_CHAPTERS, ...MUSEUM_CHAPTERS, ...WEATHER_CHAPTERS, ...MARS_CHAPTERS, ...BURABAY_CHAPTERS]
const byComicId = new Map(LOCAL_COMICS.map((d) => [d.id, d]))
const byExerciseId = new Map(LOCAL_COMICS.map((d) => [d.exerciseId, d]))

export const api: Api = {
  ...configuredApi,
  async getComic(id, lang, signal) {
    const local = byComicId.get(id)
    if (local) {
      signal?.throwIfAborted()
      return buildLocalComic(local, lang)
    }
    const comic = await configuredApi.getComic(id, lang, signal)
    const choice = comic.continuation?.choiceId
    const artSource = choice === 'library-cabinet-key' ? LIBRARY_BOXES : choice === 'new-route-note' ? SCHOOL_MAP : null
    if (artSource) {
      return {
        ...comic,
        panels: comic.panels.map((panel) => {
          const art = artSource.panels[panel.id - 1]
          return art?.image ? {
            ...panel,
            imageUrl: new URL(art.image, window.location.href).href,
            imageAspect: artSource.imageAspect,
          } : panel
        }),
      }
    }
    return id === DEMO_COMIC_ID ? withPizzaArtwork(comic) : comic
  },
  async checkAnswer(id, request, signal) {
    const local = byExerciseId.get(id)
    if (!local) return configuredApi.checkAnswer(id, request, signal)
    signal?.throwIfAborted()
    // The browser gives the chapter's targeted feedback at once; in live mode the server checks
    // too, and its verdict counts (it pays a signed-in student's coins and marks homework).
    const result = checkLocalAnswer(local, request.answer, request.lang)
    if (API_MODE === 'live' && result.status !== 'invalid') {
      try {
        const server = await accounts.checkChapter(id, request.answer, signal)
        if (server.status !== result.status) return { ...result, status: server.status }
      } catch (e) {
        if (isAbortError(e)) throw e
        // Offline or an old server: keep the browser's answer.
      }
    }
    return result
  },
  async getHint(id, lang, step, signal) {
    const local = byExerciseId.get(id)
    if (!local) return configuredApi.getHint(id, lang, step, signal)
    signal?.throwIfAborted()
    return localHint(local, lang, step)
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
