import { createHttpApi } from './httpApi'
import { mockApi } from './mockApi'
import type { Api } from './types'

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export const api: Api = API_MODE === 'live' ? createHttpApi(BASE_URL) : mockApi

export * from './types'
export { ApiError, isAbortError } from './errors'
