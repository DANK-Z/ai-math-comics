import { ApiError } from './errors'
import { fractionsEqual, parseFraction, type Fraction } from './fraction'
import { MOCK_COMICS, MOCK_FEEDBACK, MOCK_HINTS } from './mockData'
import { buildGeneratedComic, generatedComicId, generatedExercise } from './mockGenerated'
import {
  DIFFICULTIES,
  GRADES,
  LANGS,
  TOPICS,
  type Api,
  type CheckResponse,
  type CheckStatus,
  type Difficulty,
  type Comic,
  type ComicJob,
  type ComicJobCreated,
  type HintResponse,
  type JobStatus,
} from './types'

const PIZZA_ANSWER = { num: 3n, den: 4n }
const LATENCY_MS = 300
/** Simulated generation timeline. */
const QUEUED_MS = 1200
const READY_MS = 4500

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

export function checkMock(answer: string, expected: Fraction = PIZZA_ANSWER): CheckStatus {
  const parsed = parseFraction(answer)
  if (!parsed) return 'invalid'
  return fractionsEqual(parsed, expected) ? 'correct' : 'incorrect'
}

/**
 * Dev knob for exercising failure paths without a backend: add `?mockJob=fail`
 * (job ends `failed`) or `?mockJob=reject` (POST answers HTTP 503) to the URL.
 */
function mockJobMode(): 'ok' | 'fail' | 'reject' {
  const v = new URLSearchParams(window.location.search).get('mockJob')
  return v === 'fail' || v === 'reject' ? v : 'ok'
}

// Job IDs encode request + start time so polling survives a page reload.
const JOB_RE = /^job_(5|6)_(basic|intermediate|advanced)_(ok|fail)_([a-z0-9]+)$/

export const mockApi: Api = {
  getComic(comicId, lang, signal) {
    return respond<Comic>(() => {
      if (comicId === 'pizza-fractions') return structuredClone(MOCK_COMICS[lang])
      const generated = buildGeneratedComic(comicId, lang)
      if (generated) return generated
      throw new ApiError(404, 'Not Found', { detail: 'Comic not found' })
    }, signal)
  },
  checkAnswer(exerciseId, { answer, lang }, signal) {
    return respond<CheckResponse>(() => {
      if (exerciseId === 'pizza-share') {
        const status = checkMock(answer)
        return { status, message: MOCK_FEEDBACK[lang][status] }
      }
      const ex = generatedExercise(exerciseId)
      if (!ex) throw new ApiError(404, 'Not Found', { detail: 'Exercise not found' })
      const status = checkMock(answer, ex.answer)
      return { status, message: ex.feedback(lang, status) }
    }, signal)
  },
  getHint(exerciseId, lang, step, signal) {
    return respond<HintResponse>(() => {
      const texts = exerciseId === 'pizza-share' ? MOCK_HINTS[lang] : generatedExercise(exerciseId)?.hints(lang)
      if (!texts) throw new ApiError(404, 'Not Found', { detail: 'Exercise not found' })
      return { step, text: texts[step - 1], hasMore: step < 2 }
    }, signal)
  },
  createComicJob(req, signal) {
    return respond<ComicJobCreated>(() => {
      const mode = mockJobMode()
      if (mode === 'reject') throw new ApiError(503, 'Service Unavailable', { detail: 'Generator is busy, try again later' })
      if (!GRADES.includes(req.grade)) throw new ApiError(422, 'Unprocessable Entity', { detail: 'grade must be 5 or 6' })
      if (!TOPICS.includes(req.topic)) throw new ApiError(422, 'Unprocessable Entity', { detail: 'unsupported topic' })
      if (!LANGS.includes(req.lang)) throw new ApiError(422, 'Unprocessable Entity', { detail: 'unsupported lang' })
      if (!DIFFICULTIES.includes(req.difficulty)) throw new ApiError(422, 'Unprocessable Entity', { detail: 'unsupported difficulty' })
      const jobId = `job_${req.grade}_${req.difficulty}_${mode}_${Date.now().toString(36)}`
      return { jobId, status: 'queued' }
    }, signal)
  },
  getComicJob(jobId, signal) {
    return respond<ComicJob>(() => {
      const m = JOB_RE.exec(jobId)
      if (!m) throw new ApiError(404, 'Not Found', { detail: 'Job not found' })
      const [, grade, difficulty, mode, started] = m
      const elapsed = Date.now() - parseInt(started, 36)
      let status: JobStatus = elapsed < QUEUED_MS ? 'queued' : elapsed < READY_MS ? 'running' : 'ready'
      if (status === 'ready' && mode === 'fail') status = 'failed'
      return {
        jobId,
        status,
        comicId: status === 'ready' ? generatedComicId(Number(grade) as 5 | 6, difficulty as Difficulty, started) : null,
        errorCode: status === 'failed' ? 'generation_failed' : null,
      }
    }, signal)
  },
}
