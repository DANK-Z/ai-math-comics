// Shapes from docs/api-contract.md. Keep in sync with the backend.
export type Lang = 'ru' | 'kk'
export const LANGS: readonly Lang[] = ['ru', 'kk']

export interface Panel {
  id: number
  speaker: string
  text: string
  imageKey: string
  /** Generated comics: server-rendered artwork. May be relative to the API origin. */
  imageUrl?: string | null
}

export interface Exercise {
  id: string
  panelId: number
  prompt: string
}

export interface Comic {
  id: string
  lang: Lang
  title: string
  artwork?: 'prepared'
  panels: Panel[]
  exercise: Exercise
}

export type CheckStatus = 'correct' | 'incorrect' | 'invalid'

export interface CheckRequest {
  answer: string
  lang: Lang
}

export interface CheckResponse {
  status: CheckStatus
  message: string
}

export type HintStep = 1 | 2

export interface HintResponse {
  step: number
  text: string
  hasMore: boolean
}

export type Grade = 5 | 6
export const GRADES: readonly Grade[] = [5, 6]
export type Topic = 'fractions'
export const TOPICS: readonly Topic[] = ['fractions']
export type Difficulty = 'basic' | 'intermediate' | 'advanced'
export const DIFFICULTIES: readonly Difficulty[] = ['basic', 'intermediate', 'advanced']

export interface ComicJobRequest {
  grade: Grade
  topic: Topic
  lang: Lang
  difficulty: Difficulty
}

export type JobStatus = 'queued' | 'running' | 'ready' | 'failed'

/** POST /api/comic-jobs → 202 */
export interface ComicJobCreated {
  jobId: string
  status: JobStatus
}

/** GET /api/comic-jobs/{jobId} */
export interface ComicJob {
  jobId: string
  status: JobStatus
  comicId: string | null
  errorCode: string | null
}

export interface Api {
  createComicJob(req: ComicJobRequest, signal?: AbortSignal): Promise<ComicJobCreated>
  getComicJob(jobId: string, signal?: AbortSignal): Promise<ComicJob>
  getComic(comicId: string, lang: Lang, signal?: AbortSignal): Promise<Comic>
  checkAnswer(exerciseId: string, req: CheckRequest, signal?: AbortSignal): Promise<CheckResponse>
  getHint(exerciseId: string, lang: Lang, step: HintStep, signal?: AbortSignal): Promise<HintResponse>
}
