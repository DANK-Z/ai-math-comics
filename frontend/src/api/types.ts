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

export type CastHeroId = 'aldiyar' | 'aruna' | 'pifik' | 'timur' | 'dana'
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
export type Role = 'student' | 'teacher' | 'parent'

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

export type SkinKey = 'smart-glasses' | 'yellow-backpack' | 'racer-helmet' | 'chef-hat' | 'space-helmet' | 'kalpak'

/** GET /api/v1/shop: the fair shop for a signed-in student. */
export interface Shop {
  coins: number
  equippedSkin: SkinKey | null
  items: { id: SkinKey; type: 'skin'; price: number; owned: boolean; equipped: boolean; backpackItemId: number | null }[]
  /** Frames and titles (worn next to the skin, one of each). */
  cosmetics: { id: string; type: 'frame' | 'title' | 'helper'; price: number; owned: boolean; equipped: boolean; backpackItemId: number | null }[]
}

export type WearSlot = 'skin' | 'frame' | 'title' | 'helper'

/** GET /api/me/leaderboard: this week's class table (stars, then coins earned). */
export interface LeaderRow {
  rank: number
  name: string
  stars: number
  coins: number
  cleanWins: number
  me: boolean
  /** What the student wears from the fair shop (shown next to the name). */
  skin?: SkinKey | null
  frame?: string | null
  title?: string | null
}

export interface Leaderboard {
  className: string
  weekStart: string
  rows: LeaderRow[]
  classSize: number
}

/** A student in a board's lobby (negative ids are demo classmates). */
export interface LobbyStudent {
  id: number
  name: string
}

export type BattleTopic = 'fractions' | 'equations' | 'gcd' | 'decimals' | 'parts' | 'addfractions' | 'negatives' | 'linear' | 'decimalops'
export type AnswerFormat = 'fraction' | 'decimal' | 'whole-number' | 'signed'
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
  /** The lobby: students on the board right now. */
  present: LobbyStudent[]
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
/** The daily task: one short problem a day, a streak, bonuses for 3, 7 and 14 days. */
export interface DailyTask {
  day: string
  taskId: string
  topic: BattleTopic
  prompt: string
  answerFormat: AnswerFormat
  solved: boolean
  streak: number
  nextBonus?: { days: number; coins: number } | null
  coins: number
}

export interface DailyResult {
  status: 'correct' | 'incorrect' | 'invalid'
  message: string
  coins: number
  bonus?: { days: number; coins: number } | null
  daily: DailyTask
}

/** A past mistake that came back: a chapter to solve again or a boss skill to drill. */
export interface ReviewItem {
  kind: 'chapter' | 'drill'
  comicId?: string | null
  topic?: BattleTopic | null
  skill?: string | null
  mistakes: number
  since: string
}

/** The class over a week, a month or a quarter (teacher; printable). */
export interface ClassSummary {
  days: number
  since: string
  students: number
  topics: { topic: string; answers: number; correct: number }[]
  lessons: { comicId: string; answered: number; correct: number }[]
  pupils: PupilStat[]
}

export interface PupilStat {
  id: number
  name: string
  answers: number
  correct: number
  solved: number
  chapters: number
  activeDays: number
  lastActive?: string | null
  lagging: boolean
  /** Boss answers by topic and first-try lesson answers by chapter. */
  topics?: { topic: string; answers: number; correct: number }[]
  lessons?: { comicId: string; answered: number; correct: number }[]
}

/** One student for the teacher: topics, typical slips, homework and activity by day. */
export interface StudentCard {
  id: number
  name: string
  fullName: string
  login?: string | null
  days: number
  pupil: PupilStat
  mistakes: { source: 'boss' | 'lesson'; topic?: string | null; skill?: string | null; comicId?: string | null; answer: string; count: number; last: string }[]
  homework: { id: string; kind: HomeworkKind; target: string; dueDate: string; done: boolean; overdue: boolean }[]
  activity: { day: string; count: number }[]
}

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

export type LessonPhase = 'reading' | 'answering' | 'reveal' | 'podium' | 'closed'

/** One bar of the answers chart: a value, how many gave it, whether it is the right one. */
export interface ChartBar {
  text: string
  count: number
  correct: boolean
}

/** A quiz question: a chapter's exercise, or the teacher's own problem. */
export type QuizTask = { comicId: string; answer: number } | { text: string; answer: number }

/** A podium place of the mini-quiz (its stars count in the class league). */
export interface PodiumRow {
  id: number
  name: string
  points: number
  place: number
  stars: number
}

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
  /** The lobby: students on the board right now. */
  present: LobbyStudent[]
  /** After the reveal: answers by value. */
  chart?: ChartBar[]
  /** Who answered the open question (never their answers) and who is still thinking. */
  answeredIds?: number[]
  waiting?: string[]
  /** 2: the class tries again after the walkthrough; the first try is kept for comparison. */
  attempt?: number
  firstAnswered?: number | null
  firstCorrect?: number | null
  /** 0: the chapter's exercise; k: question k of the mini-quiz (quiz[k - 1]). */
  step?: number
  quiz?: string[]
  /** The teacher's own quiz problem (its chapter id in quiz is empty). */
  stepText?: string | null
  timer?: number
  secondsLeft?: number | null
  podium?: PodiumRow[]
}

export interface LessonReport {
  id: string
  comicId: string
  createdAt: string
  first: { answered: number; correct: number }
  second?: { answered: number; correct: number } | null
  /** first / second: right, wrong, or null (no answer). */
  students: { id: number; name: string; first?: boolean | null; second?: boolean | null }[]
  quiz: string[]
  podium: PodiumRow[]
}

export interface StudentLesson {
  id: string
  comicId: string
  panel: number
  phase: LessonPhase
  myAnswer?: string | null
  /** After the reveal. */
  correct?: boolean | null
  attempt?: number
  step?: number
  /** The chapter whose exercise is asked now (a quiz question). */
  stepComicId?: string | null
  quizSize?: number
  stepText?: string | null
  secondsLeft?: number | null
  points?: number
  place?: number | null
  stars?: number
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
  /** Set for some students only (a drill for those who slipped in a lesson). */
  targeted?: boolean
}

export interface MyHomework {
  id: string
  kind: HomeworkKind
  target: string
  dueDate: string
  overdue: boolean
  done: boolean
}

export type PraiseKind = 'proud' | 'keep-going' | 'star' | 'gift'
/** Cards a child can get: praise plus coins bought by a parent. */
export type CardKind = PraiseKind | 'coins' | 'streak'

export type ChallengeKind = 'boss_clean' | 'chapters' | 'drills' | 'streak'

/** The teacher's own problem shown to the class as a comic panel. */
export interface TeacherTaskItem {
  id: string
  hero: CastHeroId
  scene: string
  textRu: string
  textKk: string
  hintRu?: string | null
  hintKk?: string | null
  answer?: string | null
  createdAt: string
  solved: number
  total: number
  students: { id: number; name: string; solved: boolean; tries: number }[]
  mySolved?: boolean | null
  myTries?: number | null
}

export interface MessageThread {
  teacherId: number
  teacherName: string
  parentId: number
  parentName: string
  studentId: number
  studentName: string
  unread: number
  messages: { id: number; sender: 'teacher' | 'parent'; text: string; link?: string | null; at: string; read: boolean }[]
}

export interface DuelState {
  id: string
  code: string
  topic: BattleTopic
  status: 'waiting' | 'active' | 'done'
  total: number
  me: number
  opponent: number
  opponentName?: string | null
  secondsLeft?: number | null
  prompt?: string | null
  answerFormat: AnswerFormat
  result?: 'won' | 'lost' | 'tie' | null
  coins: number
}

export interface PrepTest {
  id: string
  problems: { id: string; topic: string; prompt: string }[]
  secondsLeft: number
  minutes: number
}

export interface PrepResult {
  id: string
  score: number
  total: number
  minutesUsed: number
  problems: { id: string; prompt: string; yourAnswer?: string | null; correct: boolean; answer: number; solution: string }[]
}

export interface SeasonEvent {
  id: 'knowledge' | 'winter' | 'nauryz'
  start: string
  end: string
  target: number
  progress: number
  frame: string
  claimed: boolean
}

/** A parent's rule with a real reward, with the child's progress since it was set. */
export interface Challenge {
  id: string
  kind: ChallengeKind
  topic?: 'equations' | 'fractions' | null
  target: number
  reward: string
  progress: number
  done: boolean
  createdAt: string
  completedAt?: string | null
  rewardedAt?: string | null
  childName?: string | null
  fromName?: string | null
}

/** Days of a month with practice; a five-day streak lets the parent send a rare frame. */
export interface PracticeCalendar {
  month: string
  days: { day: string; count: number; chapters: number; bosses: number }[]
  streak: number
  giftReady: boolean
  giftSent: boolean
}

/** The child next to anonymous peers of the same grade (shown only with enough peers). */
export interface Benchmark {
  grade?: number | null
  peers: number
  days: number
  topics: { topic: string; answers: number; accuracy?: number | null; peerAverage?: number | null; percentile?: number | null }[]
  activeDays: number
  activePercentile?: number | null
  peerActiveDays?: number | null
}
export type CoinPack = 'coins-100' | 'coins-300' | 'coins-700'

/** GET /api/parent/billing (test mode: purchases take effect without money). */
export interface Billing {
  mode: 'test' | 'off'
  plan: 'family' | null
  paidUntil: string | null
  plans: { id: 'family'; price: number }[]
  packs: { id: CoinPack; price: number; coins: number }[]
  history: { id: number; product: string; amount: number; coins: number; childId: number | null; status: string; at: string }[]
}

/** What a parent sees about one child (built from the child's real data). */
export interface ChildSummary {
  id: number
  name: string
  className?: string | null
  skin?: SkinKey | null
  coins: number
  stars: number
  chaptersMonth: number
  chaptersTotal: number
  bossWins: number
  cleanWins: number
  strengths: string[]
  weakSkill?: string | null
  weakMistakes: number
  drillsWeek: number
  chaptersWeek?: number
  bossWinsWeek?: number
  homeworkOpen: number
  homeworkOverdue: number
  lastActive?: string | null
  recent: { kind: 'boss' | 'finale'; key: string; stars: number; at: string }[]
  /** When the next gift with coins can be sent (null: now). */
  giftReadyAt?: string | null
  /** Coins in the weekly gift (50 with the family plan). */
  giftCoins?: number
}

/** A card from a parent, shown on the child's home page. */
export interface PraiseCard {
  id: number
  kind: CardKind
  coins: number
  fromName: string
  at: string
}

export interface AccountApi {
  signUpStudent(body: { login: string; password: string; displayName: string; classCode?: string }): Promise<AuthResponse>
  signUpTeacher(body: { email: string; password: string; displayName: string }): Promise<AuthResponse>
  signUpParent(body: { email: string; password: string; displayName: string }): Promise<AuthResponse>
  familyCode(signal?: AbortSignal): Promise<{ code: string; parents: number }>
  parentChildren(signal?: AbortSignal): Promise<ChildSummary[]>
  addChild(code: string): Promise<ChildSummary>
  removeChild(studentId: number): Promise<void>
  sendPraise(studentId: number, kind: PraiseKind): Promise<ChildSummary>
  billing(signal?: AbortSignal): Promise<Billing>
  buyPlan(plan: 'family'): Promise<Billing>
  buyCoins(studentId: number, pack: CoinPack): Promise<ChildSummary>
  myPraise(signal?: AbortSignal): Promise<PraiseCard[]>
  praiseSeen(): Promise<void>
  logIn(body: { login: string; password: string }): Promise<AuthResponse>
  /** Joins a class from the board's QR code: a name and the phone's own key. */
  quickJoin(body: { classCode: string; displayName: string; deviceKey: string }): Promise<AuthResponse>
  /** Live mode: the server checks a bundled chapter (and pays its coins to a signed-in student). */
  checkChapter(exerciseId: string, answer: string, signal?: AbortSignal): Promise<{ status: CheckStatus; verified: boolean }>
  me(): Promise<Me>
  joinClass(code: string): Promise<Me>
  saveProgress(body: { completedChapters: string[]; stickers: string[] }): Promise<Me>
  bossState(comicId: string, signal?: AbortSignal): Promise<BossState | null>
  createClass(body: { grade: Grade; letter: string; school: string }): Promise<ClassInfo>
  listClasses(): Promise<ClassInfo[]>
  dashboard(classId: number, signal?: AbortSignal): Promise<Dashboard>
  shop(signal?: AbortSignal): Promise<Shop>
  buy(itemId: string): Promise<Shop>
  /** A backpack item id, or null to take off what is worn in `slot` (the skin by default). */
  equip(backpackItemId: number | null, slot?: WearSlot): Promise<Shop>
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
  challenges(childId: number, signal?: AbortSignal): Promise<Challenge[]>
  setChallenge(childId: number, body: { kind: ChallengeKind; topic?: 'equations' | 'fractions' | null; target: number; reward: string }): Promise<Challenge>
  challengeRewarded(challengeId: string): Promise<Challenge>
  deleteChallenge(challengeId: string): Promise<void>
  myChallenges(signal?: AbortSignal): Promise<Challenge[]>
  practiceCalendar(childId: number, month?: string, signal?: AbortSignal): Promise<PracticeCalendar>
  streakGift(childId: number): Promise<PracticeCalendar>
  benchmark(childId: number, signal?: AbortSignal): Promise<Benchmark>
  objectiveCodes(signal?: AbortSignal): Promise<Record<string, string>>
  setObjectiveCodes(comicId: string, codes: string): Promise<Record<string, string>>
  printDrill(topic: BattleTopic, count: number, grade: number, lang: Lang): Promise<{ prompt: string; answer: string }[]>
  teacherTasks(classId: number, signal?: AbortSignal): Promise<TeacherTaskItem[]>
  createTeacherTask(classId: number, body: { hero: CastHeroId; scene: string; textRu: string; textKk: string; answer: string; hintRu?: string; hintKk?: string }): Promise<TeacherTaskItem>
  deleteTeacherTask(taskId: string): Promise<void>
  myTasks(signal?: AbortSignal): Promise<TeacherTaskItem[]>
  answerTask(taskId: string, answer: string): Promise<{ status: 'correct' | 'incorrect' | 'invalid'; tries: number }>
  writeToParents(studentId: number, text: string, link?: string): Promise<MessageThread[]>
  studentParents(studentId: number): Promise<number>
  teacherThreads(signal?: AbortSignal): Promise<MessageThread[]>
  parentThreads(signal?: AbortSignal): Promise<MessageThread[]>
  parentReply(teacherId: number, studentId: number, text: string): Promise<MessageThread[]>
  readThread(as: 'teacher' | 'parent', otherId: number, studentId: number): Promise<void>
  openDuel(topic: BattleTopic, mode: 'code' | 'class', lang: Lang): Promise<DuelState>
  joinDuel(code: string, lang: Lang): Promise<DuelState>
  duel(duelId: string, lang: Lang, signal?: AbortSignal): Promise<DuelState>
  answerDuel(duelId: string, answer: string, lang: Lang): Promise<{ status: 'correct' | 'incorrect' | 'invalid'; duel: DuelState }>
  startPrep(lang: Lang): Promise<PrepTest>
  submitPrep(testId: string, answers: Record<string, string>, lang: Lang): Promise<PrepResult>
  prepHistory(signal?: AbortSignal): Promise<{ id: string; score: number; total: number; at: string }[]>
  myEvent(signal?: AbortSignal): Promise<SeasonEvent | null>
  claimEvent(): Promise<SeasonEvent>
  daily(lang: Lang, signal?: AbortSignal): Promise<DailyTask>
  answerDaily(body: { taskId: string; answer: string; lang: Lang }): Promise<DailyResult>
  review(signal?: AbortSignal): Promise<ReviewItem[]>
  classSummary(classId: number, days: 7 | 30 | 90, signal?: AbortSignal): Promise<ClassSummary>
  studentCard(classId: number, studentId: number, days: 7 | 30 | 90, signal?: AbortSignal): Promise<StudentCard>
  createStudents(classId: number, names: string[]): Promise<StudentCredentials[]>
  resetStudentPassword(classId: number, studentId: number): Promise<StudentCredentials>
  /** Takes a student out of the class (the lobby's «убрать»). */
  removeStudent(classId: number, studentId: number): Promise<void>
  practiceReport(classId: number, signal?: AbortSignal): Promise<PracticeReport>
  startLesson(classId: number, body: { comicId: string; answer: number }): Promise<LessonBoard>
  lessonBoard(lessonId: string, signal?: AbortSignal): Promise<LessonBoard>
  updateLesson(lessonId: string, body: { panel?: number; phase?: Exclude<LessonPhase, 'podium'>; timer?: number; retry?: boolean }): Promise<LessonBoard>
  startQuiz(lessonId: string, tasks: QuizTask[]): Promise<LessonBoard>
  nextQuestion(lessonId: string): Promise<LessonBoard>
  lessonReports(classId: number, signal?: AbortSignal): Promise<LessonReport[]>
  myLesson(signal?: AbortSignal): Promise<StudentLesson | null>
  answerLesson(lessonId: string, answer: string): Promise<StudentLesson>
  setHomework(classId: number, body: { kind: HomeworkKind; target: string; dueDate: string; studentIds?: number[] }): Promise<HomeworkItem>
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
