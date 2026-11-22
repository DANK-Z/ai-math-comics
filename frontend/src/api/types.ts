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
  /** Signed-in students: coins and stars when this answer finished the boss. */
  reward?: Reward
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

// ---- Accounts (docs/api-contract.md, "Accounts") ----
export type Role = 'student' | 'teacher'

/** Coins and stars a signed-in student earns once per beaten boss (from POST …/check). */
export interface Reward {
  coins: number
  stars: number
  misses: number
  totalCoins: number
}

export interface ClassInfo {
  id: number
  name: string
  grade: number
  code: string
  teacherName?: string | null
  students?: number | null
}

export interface BackpackItem {
  id: number
  type: string
  key: string
  equipped: boolean
}

export interface StudentProfile {
  coins: number
  stars: number
  completedChapters: string[]
  stickers: string[]
  items: BackpackItem[]
}

export interface Me {
  id: number
  role: Role
  displayName: string
  login?: string
  email?: string
  schoolClass?: ClassInfo
  profile?: StudentProfile
}

export interface AuthResponse {
  token: string
  user: Me
}

export interface BossState {
  comicId: string
  cleared: number
  misses: number
  result?: { stars: number; misses: number; coins: number }
}

export interface StudentRow {
  id: number
  displayName: string
  login: string
  stars: number
  coins: number
  bossesBeaten: number
  misses: number
  bestCombo: number
  topics: Record<string, { beaten: number; bestStars: number; stars: number }>
}

export interface HeatCell {
  topic: Topic
  round: number
  skill: string | null
  students: number
  studentsWithMistakes: number
  mistakeRate: number
  invalidAnswers: number
  commonWrong: string[]
}

export interface Dashboard {
  schoolClass: ClassInfo
  students: StudentRow[]
  heatmap: HeatCell[]
  recommendation: { topic: Topic; round: number; skill: string | null; mistakeRate: number } | null
}

export type SkinKey = 'smart-glasses' | 'yellow-backpack' | 'racer-helmet'

/** GET /api/v1/shop: the fair shop for a signed-in student. */
export interface Shop {
  coins: number
  equippedSkin: SkinKey | null
  items: { id: SkinKey; type: 'skin'; price: number; owned: boolean; equipped: boolean; backpackItemId: number | null }[]
}

export interface AccountApi {
  signUpStudent(body: { login: string; password: string; displayName: string; classCode?: string }): Promise<AuthResponse>
  signUpTeacher(body: { email: string; password: string; displayName: string }): Promise<AuthResponse>
  logIn(body: { login: string; password: string }): Promise<AuthResponse>
  me(): Promise<Me>
  joinClass(code: string): Promise<Me>
  saveProgress(body: { completedChapters: string[]; stickers: string[] }): Promise<Me>
  bossState(comicId: string, signal?: AbortSignal): Promise<BossState | null>
  createClass(body: { grade: Grade; letter: string; school: string }): Promise<ClassInfo>
  listClasses(): Promise<ClassInfo[]>
  dashboard(classId: number, signal?: AbortSignal): Promise<Dashboard>
  shop(signal?: AbortSignal): Promise<Shop>
  buy(itemId: SkinKey): Promise<Shop>
  /** A backpack item id, or null to take the skin off. */
  equip(backpackItemId: number | null): Promise<Shop>
}
