import { ApiError } from './errors'
import { fractionsEqual, parseFraction } from './fraction'
import { MOCK_COMICS, MOCK_FEEDBACK, MOCK_HINTS } from './mockData'
import type { Api, CheckStatus, Comic, CheckResponse, HintResponse } from './types'

const EXPECTED = { num: 3n, den: 4n }
const LATENCY_MS = 300

/** Resolve `value()` after a short simulated network delay; honours AbortSignal. */
function respond<T>(value: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      try {
        resolve(value())
      } catch (e) {
        reject(e)
      }
    }, LATENCY_MS)
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function checkMock(answer: string): CheckStatus {
  const parsed = parseFraction(answer)
  if (!parsed) return 'invalid'
  return fractionsEqual(parsed, EXPECTED) ? 'correct' : 'incorrect'
}

export const mockApi: Api = {
  getComic(comicId, lang, signal) {
    return respond<Comic>(() => {
      if (comicId !== 'pizza-fractions') throw new ApiError(404, 'Comic not found')
      return structuredClone(MOCK_COMICS[lang])
    }, signal)
  },
  checkAnswer(exerciseId, { answer, lang }, signal) {
    return respond<CheckResponse>(() => {
      if (exerciseId !== 'pizza-share') throw new ApiError(404, 'Exercise not found')
      const status = checkMock(answer)
      return { status, message: MOCK_FEEDBACK[lang][status] }
    }, signal)
  },
  getHint(exerciseId, lang, step, signal) {
    return respond<HintResponse>(() => {
      if (exerciseId !== 'pizza-share') throw new ApiError(404, 'Exercise not found')
      return { step, text: MOCK_HINTS[lang][step - 1], hasMore: step < 2 }
    }, signal)
  },
}
