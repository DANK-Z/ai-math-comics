import { authToken } from './authToken'
import { ApiError } from './errors'
import type { BattleAnswerResult, BattleBoard, Leaderboard, PracticeReport, PracticeResult, PracticeTask, StudentBattle, StudentCredentials, WeakSpot } from './types'
import type { ItemLore, VoiceAnswerKind } from './types'
import type { HomeworkItem, LessonBoard, MyHomework, StudentLesson } from './types'
import type { Billing, ChildSummary, PraiseCard } from './types'
import type { AssignmentReport, ClassAssignment, ComicJobRequest, Lang, TeacherDraft, TeacherDraftJob, TeacherPublication, TeacherTask } from './types'
import type { AccountApi, Api, AuthResponse, BossState, CheckResponse, ClassInfo, Comic, ComicJob, ComicJobCreated, ContinuationJobRequest, Dashboard, HintResponse, Me, Shop } from './types'

/** Pulls `detail` / `message` / `errorCode` out of an error body (FastAPI uses `detail`). */
async function readError(res: Response): Promise<ApiError> {
  let detail: string | null = null
  let code: string | null = null
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      code = typeof b.errorCode === 'string' ? b.errorCode : typeof b.code === 'string' ? b.code : null
      if (typeof b.detail === 'string') detail = b.detail
      else if (Array.isArray(b.detail)) detail = b.detail.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d))).join('; ')
      else if (typeof b.message === 'string') detail = b.message
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, `${res.status} ${res.statusText}`.trim(), { code, detail })
}

export function createHttpApi(baseUrl: string): Api & AccountApi & {
  createContinuationJob(body: ContinuationJobRequest): Promise<ComicJobCreated>
  resumeComicJob(jobId: string, resumeToken: string): Promise<ComicJob>
  draftJobs(lang: Lang, signal?: AbortSignal): Promise<TeacherDraftJob[]>
  createDraft(body: ComicJobRequest): Promise<ComicJobCreated>
  draft(comicId: string, signal?: AbortSignal): Promise<TeacherDraft>
  problemBank(signal?: AbortSignal): Promise<TeacherTask[]>
  generateTask(body: ComicJobRequest): Promise<TeacherTask>
  publishDraft(comicId: string, body: TeacherPublication): Promise<ClassAssignment>
  assignments(lang: Lang, signal?: AbortSignal): Promise<ClassAssignment[]>
  assignmentReports(classId: number, lang: Lang, signal?: AbortSignal): Promise<AssignmentReport[]>
  voiceStatus(signal?: AbortSignal): Promise<{ enabled: boolean }>
  recognizeVoice(lang: Lang, kind: VoiceAnswerKind, audio: Blob, signal?: AbortSignal): Promise<{ answer: string }>
  itemLore(key: string, lang: Lang, signal?: AbortSignal): Promise<ItemLore>
} {
  const base = baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body) headers['Content-Type'] = init.body instanceof Blob ? init.body.type : 'application/json'
    // Signed-in users send their JWT; the server treats a stale token on checks as a guest.
    const token = authToken.get()
    if (token) headers.Authorization = `Bearer ${token}`
    let res: Response
    try {
      res = await fetch(`${base}${path}`, { ...init, headers })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError(0, 'Network error', { detail: e instanceof Error ? e.message : null })
    }
    if (!res.ok) throw await readError(res)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  return {
    voiceStatus(signal) {
      return request('/api/voice', { signal })
    },
    recognizeVoice(lang, kind, audio, signal) {
      return request(`/api/voice/${lang}?kind=${kind}`, { method: 'POST', body: audio, signal })
    },
    itemLore(key, lang, signal) {
      return request(`/api/v1/items/${encodeURIComponent(key)}/lore?lang=${lang}`, {
        method: 'POST', signal,
      })
    },
    getComic(comicId, lang, signal) {
      return request<Comic>(`/api/comics/${encodeURIComponent(comicId)}?lang=${lang}`, { signal })
    },
    checkAnswer(exerciseId, body, signal) {
      return request<CheckResponse>(`/api/exercises/${encodeURIComponent(exerciseId)}/check`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      })
    },
    getHint(exerciseId, lang, step, signal) {
      return request<HintResponse>(
        `/api/exercises/${encodeURIComponent(exerciseId)}/hints?lang=${lang}&step=${step}`,
        { signal },
      )
    },
    createComicJob(req, signal) {
      // Contract: HTTP 202 Accepted. Any 2xx with a jobId is accepted.
      return request<ComicJobCreated>('/api/comic-jobs', { method: 'POST', body: JSON.stringify(req), signal })
    },
    createContinuationJob(body) {
      return request<ComicJobCreated>('/api/continuation-jobs', { method: 'POST', body: JSON.stringify(body) })
    },
    getComicJob(jobId, signal) {
      return request<ComicJob>(`/api/comic-jobs/${encodeURIComponent(jobId)}`, { signal })
    },
    resumeComicJob(jobId, resumeToken) {
      return request<ComicJob>(`/api/comic-jobs/${encodeURIComponent(jobId)}/resume`, {
        method: 'POST', body: JSON.stringify({ resumeToken }),
      })
    },
    signUpStudent(body) {
      return request<AuthResponse>('/api/auth/students', { method: 'POST', body: JSON.stringify(body) })
    },
    signUpTeacher(body) {
      return request<AuthResponse>('/api/auth/teachers', { method: 'POST', body: JSON.stringify(body) })
    },
    logIn(body) {
      return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
    },
    checkChapter(exerciseId, answer, signal) {
      return request(`/api/chapters/${encodeURIComponent(exerciseId)}/check`, { method: 'POST', body: JSON.stringify({ answer }), signal })
    },
    signUpParent(body) {
      return request<AuthResponse>('/api/auth/parents', { method: 'POST', body: JSON.stringify(body) })
    },
    familyCode(signal) {
      return request<{ code: string; parents: number }>('/api/me/family-code', { signal })
    },
    parentChildren(signal) {
      return request<ChildSummary[]>('/api/parent/children', { signal })
    },
    addChild(code) {
      return request<ChildSummary>('/api/parent/children', { method: 'POST', body: JSON.stringify({ code }) })
    },
    async removeChild(studentId) {
      await request<unknown>(`/api/parent/children/${studentId}`, { method: 'DELETE' })
    },
    sendPraise(studentId, kind) {
      return request<ChildSummary>(`/api/parent/children/${studentId}/praise`, { method: 'POST', body: JSON.stringify({ kind }) })
    },
    billing(signal) {
      return request<Billing>('/api/parent/billing', { signal })
    },
    buyPlan(plan) {
      return request<Billing>('/api/parent/billing/plan', { method: 'POST', body: JSON.stringify({ plan }) })
    },
    buyCoins(studentId, pack) {
      return request<ChildSummary>(`/api/parent/children/${studentId}/coins`, { method: 'POST', body: JSON.stringify({ pack }) })
    },
    myPraise(signal) {
      return request<PraiseCard[]>('/api/me/praise', { signal })
    },
    async praiseSeen() {
      await request<unknown>('/api/me/praise/seen', { method: 'POST' })
    },
    quickJoin(body) {
      return request<AuthResponse>('/api/auth/quick-join', { method: 'POST', body: JSON.stringify(body) })
    },
    me() {
      return request<Me>('/api/me')
    },
    joinClass(code) {
      return request<Me>('/api/me/class', { method: 'POST', body: JSON.stringify({ code }) })
    },
    saveProgress(body) {
      return request<Me>('/api/me/progress', { method: 'PUT', body: JSON.stringify(body) })
    },
    bossState(comicId, signal) {
      return request<BossState>(`/api/me/boss/${encodeURIComponent(comicId)}`, { signal })
    },
    createClass(body) {
      return request<ClassInfo>('/api/teacher/classes', { method: 'POST', body: JSON.stringify(body) })
    },
    listClasses() {
      return request<ClassInfo[]>('/api/teacher/classes')
    },
    dashboard(classId, signal) {
      return request<Dashboard>(`/api/teacher/classes/${classId}`, { signal })
    },
    draftJobs(lang, signal) {
      return request(`/api/teacher/comic-drafts?lang=${lang}`, { signal })
    },
    createDraft(body) {
      return request('/api/teacher/comic-drafts', { method: 'POST', body: JSON.stringify(body) })
    },
    draft(comicId, signal) {
      return request(`/api/teacher/comic-drafts/${encodeURIComponent(comicId)}`, { signal })
    },
    problemBank(signal) {
      return request('/api/teacher/problem-bank', { signal })
    },
    generateTask(body) {
      return request('/api/teacher/comic-task', { method: 'POST', body: JSON.stringify(body) })
    },
    publishDraft(comicId, body) {
      return request(`/api/teacher/comic-drafts/${encodeURIComponent(comicId)}/publish`, {
        method: 'POST', body: JSON.stringify(body),
      })
    },
    assignments(lang, signal) {
      return request(`/api/me/assigned-comics?lang=${lang}`, { signal })
    },
    assignmentReports(classId, lang, signal) {
      return request(`/api/teacher/classes/${classId}/assigned-comics?lang=${lang}`, { signal })
    },
    shop(signal) {
      return request<Shop>('/api/v1/shop', { signal })
    },
    buy(itemId) {
      return request<Shop>('/api/v1/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) })
    },
    equip(backpackItemId, slot = 'skin') {
      return request<Shop>('/api/v1/backpack/equip', { method: 'POST', body: JSON.stringify({ itemId: backpackItemId, slot }) })
    },
    leaderboard(signal) {
      return request<Leaderboard>('/api/me/leaderboard', { signal })
    },
    classLeaderboard(classId, signal) {
      return request<Leaderboard>(`/api/teacher/classes/${classId}/leaderboard`, { signal })
    },
    startBattle(classId, body) {
      return request<BattleBoard>(`/api/teacher/classes/${classId}/battles`, { method: 'POST', body: JSON.stringify(body) })
    },
    currentClassBattle(classId, signal) {
      return request<BattleBoard | null>(`/api/teacher/classes/${classId}/battles/current`, { signal })
    },
    battleBoard(battleId, signal) {
      return request<BattleBoard>(`/api/teacher/battles/${encodeURIComponent(battleId)}`, { signal })
    },
    stopBattle(battleId) {
      return request<BattleBoard>(`/api/teacher/battles/${encodeURIComponent(battleId)}/stop`, { method: 'POST' })
    },
    myBattle(lang, signal) {
      return request<StudentBattle | null>(`/api/me/battle?lang=${lang}`, { signal })
    },
    startPractice(body) {
      return request<PracticeTask>('/api/me/practice', { method: 'POST', body: JSON.stringify(body) })
    },
    answerPractice(body) {
      return request<PracticeResult>('/api/me/practice/answer', { method: 'POST', body: JSON.stringify(body) })
    },
    createStudents(classId, names) {
      return request<StudentCredentials[]>(`/api/teacher/classes/${classId}/students`, { method: 'POST', body: JSON.stringify({ names }) })
    },
    resetStudentPassword(classId, studentId) {
      return request<StudentCredentials>(`/api/teacher/classes/${classId}/students/${studentId}/password`, { method: 'POST' })
    },
    async removeStudent(classId, studentId) {
      await request<unknown>(`/api/teacher/classes/${classId}/students/${studentId}/remove`, { method: 'POST' })
    },
    practiceReport(classId, signal) {
      return request<PracticeReport>(`/api/teacher/classes/${classId}/practice`, { signal })
    },
    startLesson(classId, body) {
      return request<LessonBoard>(`/api/teacher/classes/${classId}/lessons`, { method: 'POST', body: JSON.stringify(body) })
    },
    lessonBoard(lessonId, signal) {
      return request<LessonBoard>(`/api/teacher/lessons/${encodeURIComponent(lessonId)}`, { signal })
    },
    updateLesson(lessonId, body) {
      return request<LessonBoard>(`/api/teacher/lessons/${encodeURIComponent(lessonId)}`, { method: 'POST', body: JSON.stringify(body) })
    },
    myLesson(signal) {
      return request<StudentLesson | null>('/api/me/lesson', { signal })
    },
    answerLesson(lessonId, answer) {
      return request<StudentLesson>(`/api/me/lesson/${encodeURIComponent(lessonId)}/answer`, { method: 'POST', body: JSON.stringify({ answer }) })
    },
    setHomework(classId, body) {
      return request<HomeworkItem>(`/api/teacher/classes/${classId}/homework`, { method: 'POST', body: JSON.stringify(body) })
    },
    classHomework(classId, signal) {
      return request<HomeworkItem[]>(`/api/teacher/classes/${classId}/homework`, { signal })
    },
    async deleteHomework(homeworkId) {
      await request<unknown>(`/api/teacher/homework/${encodeURIComponent(homeworkId)}`, { method: 'DELETE' })
    },
    myHomework(signal) {
      return request<MyHomework[]>('/api/me/homework', { signal })
    },
    weakSpot(signal) {
      return request<WeakSpot | null>('/api/me/practice/weak', { signal })
    },
    answerBattle(battleId, body) {
      return request<BattleAnswerResult>(`/api/me/battle/${encodeURIComponent(battleId)}/answer`, { method: 'POST', body: JSON.stringify(body) })
    },
  }
}
