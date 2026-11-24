// Shapes from docs/api-contract.md. Keep in sync with the backend.
export type Lang = 'ru' | 'kk'
export const LANGS: readonly Lang[] = ['ru', 'kk']

export type Emotion = 'neutral' | 'happy' | 'confused' | 'scared' | 'surprised' | 'angry'
export type VoiceAnswerKind = 'equation' | 'fraction'
export interface ItemLore {
  story: string
  source: 'generated' | 'prepared'
  student: string
  owned: boolean
  acquiredAt: string | null
  victoryAt: string | null
  perfect: boolean
  combo: number
}
export type PanelLayers = { backgroundUrl: string; foregroundUrl: string }

export interface Panel {
  id: number
  speaker: string
  text: string
  emotion?: Emotion
  layers?: PanelLayers
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
  character?: { name: string; introduction: string; farewell: string }
}

export interface Comic {
  id: string
  lang: Lang
  title: string
  artwork?: 'prepared'
  continuation?: {
    sourceChapterId: 'school-quest-map'
    choiceId: ContinuationChoice
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

export type ContinuationChoice = 'library-cabinet-key' | 'new-route-note' | 'fair-attraction-ticket' | 'free-premise'

export type ContinuationJobRequest = { sourceChapterId: 'school-quest-map'; locale: Lang } & (
  | { choiceId: Exclude<ContinuationChoice, 'free-premise'> }
  | { choiceId: 'free-premise'; premise: string }
)

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

/** GET /api/me/leaderboard: this week's class table (stars, then coins earned). */
export interface LeaderRow {
  rank: number
  name: string
  stars: number
  coins: number
  cleanWins: number
  me: boolean
}

export interface Leaderboard {
  className: string
  weekStart: string
  rows: LeaderRow[]
  classSize: number
}

export type BattleTopic = 'fractions' | 'equations' | 'gcd' | 'decimals' | 'parts'
export type AnswerFormat = 'fraction' | 'decimal' | 'whole-number'
export type BattleDifficulty = 'basic' | 'intermediate' | 'advanced'
export type BattleStatus = 'active' | 'won' | 'stopped'

/** The class board of a class battle (teacher). */
export interface BattleBoard {
  id: string
  classId: number
  className: string
  classCode: string
  topic: BattleTopic
  difficulty: BattleDifficulty
  maxHp: number
  hp: number
  damagePerHit: number
  status: BattleStatus
  hits: number
  fighters: number
  top: { name: string; hits: number }[]
  recent: { name: string; at: string }[]
  startedAt: string
  finishedAt?: string | null
}

/** A student's view of the class battle, with their current problem. */
export interface StudentBattle {
  id: string
  topic: BattleTopic
  maxHp: number
  hp: number
  damagePerHit: number
  status: BattleStatus
  myHits: number
  classHits: number
  task?: { id: string; prompt: string; answerFormat: AnswerFormat } | null
}

export interface BattleAnswerResult {
  status: CheckStatus
  message: string
  damage: number
  battle: StudentBattle
}

/** A problem of the solo review drill (five in a row, checked on the server). */
export interface PracticeTask {
  id: string
  topic: BattleTopic
  prompt: string
  answerFormat: AnswerFormat
  number: number
  total: number
}

export interface PracticeResult {
  status: CheckStatus
  message: string
  solved: number
  total: number
  next?: PracticeTask | null
}

/** The skill a student missed most in recent boss fights. */
export interface WeakSpot {
  topic: BattleTopic
  skill: string
  mistakes: number
}

/** A student account the teacher made or reset: the password is shown once. */
export interface StudentCredentials {
  id: number
  displayName: string
  login: string
  password: string
}

export interface PracticeReport {
  days: number
  students: { id: number; displayName: string; drills: number; finished: number; solved: number; topics: Record<string, number>; lastAt?: string | null }[]
}

export type LessonPhase = 'reading' | 'answering' | 'reveal' | 'closed'

/** The board of a lesson: a bundled chapter shown on the projector, answers from phones. */
export interface LessonBoard {
  id: string
  classId: number
  className: string
  classCode: string
  comicId: string
  panel: number
  phase: LessonPhase
  students: number
  answered: number
  /** After the reveal. */
  correct?: number | null
  wrong: { text: string; count: number }[]
  answer: number
}

export interface StudentLesson {
  id: string
  comicId: string
  panel: number
  phase: LessonPhase
  myAnswer?: string | null
  /** After the reveal. */
  correct?: boolean | null
}

export type HomeworkKind = 'chapter' | 'practice'

export interface HomeworkItem {
  id: string
  kind: HomeworkKind
  target: string
  dueDate: string
  createdAt: string
  overdue: boolean
  done: number
  total: number
  students: { id: number; name: string; done: boolean }[]
}

export interface MyHomework {
  id: string
  kind: HomeworkKind
  target: string
  dueDate: string
  overdue: boolean
  done: boolean
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
  leaderboard(signal?: AbortSignal): Promise<Leaderboard>
  classLeaderboard(classId: number, signal?: AbortSignal): Promise<Leaderboard>
  startBattle(classId: number, body: { topic: BattleTopic; difficulty: BattleDifficulty; hp: number }): Promise<BattleBoard>
  currentClassBattle(classId: number, signal?: AbortSignal): Promise<BattleBoard | null>
  battleBoard(battleId: string, signal?: AbortSignal): Promise<BattleBoard>
  stopBattle(battleId: string): Promise<BattleBoard>
  myBattle(lang: Lang, signal?: AbortSignal): Promise<StudentBattle | null>
  answerBattle(battleId: string, body: { taskId: string; answer: string; lang: Lang }): Promise<BattleAnswerResult>
  startPractice(body: { topic: BattleTopic; skill?: string | null; lang: Lang }): Promise<PracticeTask>
  answerPractice(body: { taskId: string; answer: string; lang: Lang }): Promise<PracticeResult>
  weakSpot(signal?: AbortSignal): Promise<WeakSpot | null>
  createStudents(classId: number, names: string[]): Promise<StudentCredentials[]>
  resetStudentPassword(classId: number, studentId: number): Promise<StudentCredentials>
  practiceReport(classId: number, signal?: AbortSignal): Promise<PracticeReport>
  startLesson(classId: number, body: { comicId: string; answer: number }): Promise<LessonBoard>
  lessonBoard(lessonId: string, signal?: AbortSignal): Promise<LessonBoard>
  updateLesson(lessonId: string, body: { panel?: number; phase?: LessonPhase }): Promise<LessonBoard>
  myLesson(signal?: AbortSignal): Promise<StudentLesson | null>
  answerLesson(lessonId: string, answer: string): Promise<StudentLesson>
  setHomework(classId: number, body: { kind: HomeworkKind; target: string; dueDate: string }): Promise<HomeworkItem>
  classHomework(classId: number, signal?: AbortSignal): Promise<HomeworkItem[]>
  deleteHomework(homeworkId: string): Promise<void>
  myHomework(signal?: AbortSignal): Promise<MyHomework[]>
}
export interface TeacherTask {
  boss: BossKind
  answer: string
  ru: TeacherTaskText
  kk: TeacherTaskText
}

export interface TeacherTaskText {
  prompt: string
  hint1: string
  hint2: string
}

export interface TeacherDraft {
  ru: Comic
  kk: Comic
  task: TeacherTask
}

export interface TeacherDraftJob extends ComicJob {
  publicationStatus: 'draft' | 'published'
  title: string | null
}

export interface TeacherPublication {
  classId: number
  dueDate: string | null
  task: TeacherTask
  ru: { title: string; panels: string[] }
  kk: { title: string; panels: string[] }
}

export interface ClassAssignment {
  id: string
  title: string
  dueDate: string | null
  completed: boolean
}

export interface AssignmentReport extends ClassAssignment {
  students: { id: number; name: string; completed: boolean; hints: number[] }[]
}
