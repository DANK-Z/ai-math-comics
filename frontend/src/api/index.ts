import { createHttpApi } from './httpApi'
import { mockApi } from './mockApi'
import type { Api } from './types'

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export const api: Api = API_MODE === 'live' ? createHttpApi(BASE_URL) : mockApi

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
