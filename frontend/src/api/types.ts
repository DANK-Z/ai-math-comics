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
  imageAspect?: number
  /** My Story, prepared art: a student hero's panel has no picture, only its setting. */
  placeholder?: { setting: StorySetting } | null
}

export interface Exercise {
  id: string
  panelId: number
  prompt: string
  answerFormat?: 'whole-number'
}

export type BossKind = 'fraction-slime' | 'x-master'

/** One boss round: an exercise checked and hinted through the usual endpoints. */
export interface BossRound {
  exerciseId: string
  prompt: string
  answerFormat?: 'whole-number'
}

/** Panel-four boss fight of a generated comic. rounds[0] is the comic's own exercise. */
export interface Boss {
  kind: BossKind
  maxHp: number
  rounds: BossRound[]
}

export interface Comic {
  id: string
  lang: Lang
  title: string
  artwork?: 'prepared'
  continuation?: {
    sourceChapterId: 'school-quest-map'
    choiceId: 'library-cabinet-key'
    nextChapterId: 'library-boxes'
  }
  panels: Panel[]
  exercise: Exercise
  boss?: Boss
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
export type Topic = 'fractions' | 'equations'
export const TOPICS: readonly Topic[] = ['fractions', 'equations']
export type Difficulty = 'basic' | 'intermediate' | 'advanced'
export const DIFFICULTIES: readonly Difficulty[] = ['basic', 'intermediate', 'advanced']

export type CastHeroId = 'aldiyar' | 'aruna' | 'pifik'
export type StoryStyle = 'comic' | 'cartoon' | 'pixel'
export type StorySetting = 'school' | 'space' | 'forest' | 'custom'

/** «Моя история» options for POST /api/comic-jobs (see docs/api-contract.md). */
export interface StoryOptions {
  heroes: CastHeroId[]
  customHeroes: { name: string; description: string }[]
  style: StoryStyle
  setting: StorySetting
  customSetting: string | null
  premise: string | null
}

export interface ComicJobRequest {
  grade: Grade
  topic: Topic
  lang: Lang
  difficulty: Difficulty
  story?: StoryOptions
}

export interface ContinuationJobRequest {
  sourceChapterId: 'school-quest-map'
  choiceId: 'library-cabinet-key'
  locale: Lang
}

export type JobStatus = 'queued' | 'running' | 'ready' | 'failed'

export interface JobProgress {
  stage: 'queued' | 'storyboard' | 'drawing' | 'preparing' | 'ready'
  completedPanels?: number
  totalPanels?: number
}

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
  progress?: JobProgress
  resumeToken?: string
}

export interface Api {
  createComicJob(req: ComicJobRequest, signal?: AbortSignal): Promise<ComicJobCreated>
  getComicJob(jobId: string, signal?: AbortSignal): Promise<ComicJob>
  getComic(comicId: string, lang: Lang, signal?: AbortSignal): Promise<Comic>
  checkAnswer(exerciseId: string, req: CheckRequest, signal?: AbortSignal): Promise<CheckResponse>
  getHint(exerciseId: string, lang: Lang, step: HintStep, signal?: AbortSignal): Promise<HintResponse>
}
