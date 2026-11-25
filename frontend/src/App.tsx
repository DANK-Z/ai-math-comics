import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_MODE, type BattleTopic, type ComicJobRequest, type Lang, type Role } from './api'
import { PRACTICE_TOPICS, PracticeScreen } from './components/PracticeScreen'
import logoUrl from './assets/logo.webp'
import logoDarkUrl from './assets/logo-dark.webp'
import { AccountProvider, useAccount } from './account'
import { ACCOUNT_COPY } from './accountCopy'
import { AuthScreen } from './components/AuthScreen'
import { BackpackCollection } from './components/BackpackCollection'
import { CatalogScreen, HomeScreen } from './components/HomeScreen'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { FINALE_WON_EVENT, FINALES, finaleWon } from './finales'
import { DesktopNavigation, MobileNavigation } from './components/SectionNavigation'
import { useContinuationJob } from './continuation'
import { useGuardianChallenge } from './guardian'
import { guardianAssignmentHref, type GuardianAssignment } from './guardianAssignment'
import { useRoadGuardian } from './roadGuardian'
import { useLang } from './hooks'
import { setTheme, useDarkTheme } from './theme'
import { rememberAfterLogin, takeAfterLogin } from './afterLogin'
import { useMyComics } from './myComics'
import { STRINGS } from './i18n'
import { useBonusStickers } from './bonusStickers'
import { comicHref, parseRoute, SCHOOL_MAP_COMIC_ID, SECTION_HREFS, useRoute, type Route } from './route'
import { chaptersLeft, findOperation, operationChapter, useOperationProgress } from './operations'
import { mergeSecrets, useFoundSecrets } from './panelSecrets'
import { FAIR_FINALE_ID, finaleProgressId, findForChapter, logFind, ROADS_FINALE_ID } from './rewards'
import { useSeasonProgress } from './seasonProgress'
import { SCHOOL_FAIR_CHAPTER_COUNT, schoolFairChapter } from './schoolFair'

// Screens load on demand: the first page only needs the route map.
const ProfileScreen = lazy(() => import('./components/ProfileScreen').then((m) => ({ default: m.ProfileScreen })))
const ClassScreen = lazy(() => import('./components/ClassScreen').then((m) => ({ default: m.ClassScreen })))
const ClassDashboard = lazy(() => import('./components/TeacherScreen').then((m) => ({ default: m.ClassDashboard })))
const TeacherHome = lazy(() => import('./components/TeacherScreen').then((m) => ({ default: m.TeacherHome })))
const GenerateCard = lazy(() => import('./components/GenerateCard').then((m) => ({ default: m.GenerateCard })))
const ReaderScreen = lazy(() => import('./components/ReaderScreen').then((m) => ({ default: m.ReaderScreen })))
const FinaleScreen = lazy(() => import('./components/FinaleScreen').then((m) => ({ default: m.FinaleScreen })))
const OperationScreen = lazy(() => import('./components/OperationsScreen').then((m) => ({ default: m.OperationScreen })))
const OperationsScreen = lazy(() => import('./components/OperationsScreen').then((m) => ({ default: m.OperationsScreen })))
const RoadGuardianScreen = lazy(() => import('./components/RoadGuardianScreen').then((m) => ({ default: m.RoadGuardianScreen })))
const BattleBoardScreen = lazy(() => import('./components/ClassBattle').then((m) => ({ default: m.BattleBoardScreen })))
const BattleScreen = lazy(() => import('./components/ClassBattle').then((m) => ({ default: m.BattleScreen })))
const LessonBoardScreen = lazy(() => import('./components/LessonScreens').then((m) => ({ default: m.LessonBoardScreen })))
const StudentLessonScreen = lazy(() => import('./components/LessonScreens').then((m) => ({ default: m.StudentLessonScreen })))
const ParentScreen = lazy(() => import('./components/ParentScreen').then((m) => ({ default: m.ParentScreen })))
const JoinScreen = lazy(() => import('./components/JoinScreen').then((m) => ({ default: m.JoinScreen })))
const MotionLeague = lazy(() => import('./components/MotionLeague'))
const GuardianScreen = lazy(() => import('./components/GuardianScreen'))
const MyComicsScreen = lazy(() => import('./components/MyComicsScreen'))

function AssignedGuardian({ assignment, remaining, lang }: { assignment: GuardianAssignment; remaining: number; lang: Lang }) {
  const challenge = useGuardianChallenge(assignment)
  return <GuardianScreen lang={lang} remaining={remaining} challenge={challenge} assigned />
}

function Logo({ tagline }: { tagline: string }) {
  const dark = useDarkTheme()
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <img src={dark ? logoDarkUrl : logoUrl} alt="AI Math Comics" width={773} height={176} className="site-logo h-10 w-auto max-w-full min-[380px]:h-11 sm:h-16 lg:h-[4.5rem]" />
      <p className="hidden max-w-full rounded-full bg-sun px-3 py-0.5 text-xs leading-tight font-extrabold text-ink sm:block">{tagline}</p>
    </div>
  )
}

/** Header account button: Sign in, or the student's name and coins, or the teacher's name. */
function AccountChip({ lang }: { lang: Lang }) {
  const { user, ready } = useAccount()
  const c = ACCOUNT_COPY[lang]
  const base =
    'inline-flex min-h-11 max-w-[11rem] items-center gap-1.5 rounded-xl border-[3px] border-ink px-3 text-sm font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun sm:max-w-[16rem] sm:text-base'
  if (!ready) return null
  if (!user) return <a href={SECTION_HREFS.login} className={`${base} bg-sun`}>{c.signIn}</a>
  if (user.role === 'parent') {
    return (
      <a href={SECTION_HREFS.parent} className={`${base} bg-white`}>
        <span aria-hidden>👨‍👩‍👧</span><span className="truncate max-[480px]:sr-only">{user.displayName}</span>
      </a>
    )
  }
  if (user.role === 'teacher') {
    return (
      <a href={SECTION_HREFS.teacher} className={`${base} bg-white`}>
        <span aria-hidden>🧑‍🏫</span><span className="truncate max-[480px]:sr-only">{user.displayName}</span>
      </a>
    )
  }
  return (
    <a href={SECTION_HREFS.profile} className={`${base} bg-white`} aria-label={`${user.displayName}, ${c.profile.coins}: ${user.profile?.coins ?? 0}`}>
      <span className="truncate max-[480px]:hidden">{user.displayName}</span>
      <span className="shrink-0 rounded-lg bg-sun px-1.5">🪙 {user.profile?.coins ?? 0}</span>
    </a>
  )
}

/** Teachers see only their dashboard; students and guests only the game. */
const CREATE_GATE = {
  ru: { title: 'Создать свой комикс', text: 'Чтобы Пифик нарисовал комикс по твоей задаче, войди или зарегистрируйся — это бесплатно. Готовые истории можно читать и без входа.', button: 'Войти и создать' },
  kk: { title: 'Өз комиксіңді жаса', text: 'Пифик сенің есебің бойынша комикс салуы үшін кір немесе тіркел — бұл тегін. Дайын оқиғаларды кірмей-ақ оқуға болады.', button: 'Кіріп, жасау' },
}

/** Guests read the stories, but making a comic (paid AI) needs an account. */
function SignInToCreate({ lang }: { lang: Lang }) {
  const c = CREATE_GATE[lang]
  return (
    <section aria-labelledby="create-gate-title" className="rounded-3xl border-[3px] border-ink bg-white p-5 shadow-[0_4px_0_var(--shadow-ink)] sm:p-7">
      <h1 id="create-gate-title" className="text-2xl font-black text-ink sm:text-3xl">✨ {c.title}</h1>
      <p className="mt-2 text-lg font-semibold text-ink/85">{c.text}</p>
      <a href={SECTION_HREFS.login} onClick={() => rememberAfterLogin('#/create')}
        className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl border-[3px] border-ink bg-sun px-6 text-xl font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand">
        {c.button} →
      </a>
    </section>
  )
}

function screenFor(route: Route, role: Role | null): Route | null {
  if (role === 'parent') return route.name === 'parent' ? null : { name: 'parent' }
  if (route.name === 'parent') return role ? { name: role === 'teacher' ? 'teacher' : 'map' } : { name: 'login' }
  const teacherRoute = route.name === 'teacher' || route.name === 'teacherClass' || route.name === 'teacherBattle' || route.name === 'teacherLesson'
  if (role === 'teacher') return teacherRoute ? null : { name: 'teacher' }
  if (role === 'student') return teacherRoute || route.name === 'login' ? { name: 'map' } : null
  return teacherRoute || route.name === 'profile' || route.name === 'battle' || route.name === 'lesson' ? { name: 'login' } : null
}

const THEME_LABEL = { ru: { dark: 'Включить светлую тему', light: 'Включить ночную тему' }, kk: { dark: 'Жарық тақырыпты қосу', light: 'Түнгі тақырыпты қосу' } }

/** 🌙 / ☀️ in the header: switches the whole site between light and night themes. */
function ThemeToggle({ lang }: { lang: Lang }) {
  const dark = useDarkTheme()
  const label = THEME_LABEL[lang][dark ? 'dark' : 'light']
  return (
    <button type="button" onClick={() => setTheme(dark ? 'light' : 'dark')} title={label} aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full border-[3px] border-ink bg-white text-lg shadow-[0_3px_0_var(--shadow-ink)] hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <span aria-hidden>{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}

/** Shown for a moment while a screen's code loads. */
function ScreenLoading() {
  return <p aria-busy="true" className="py-10 text-center font-bold text-ink/60 motion-safe:animate-pulse">…</p>
}

export default function App() {
  return (
    <AccountProvider>
      <AppShell />
    </AccountProvider>
  )
}

function AppShell() {
  const [lang, setLang] = useLang()
  const [route, navigate] = useRoute()
  const [lastComicId, setLastComicId] = useState(() => {
    try { return localStorage.getItem('amc.lastOpenedComic') } catch { return null }
  })
  const rememberComic = useCallback((id: string) => {
    setLastComicId(id)
    try { localStorage.setItem('amc.lastOpenedComic', id) } catch { /* keep it for this visit */ }
  }, [])
  const account = useAccount()
  const role = account.user?.role ?? null
  const { completedChapters, completeChapter, mergeChapters } = useSeasonProgress()
  const operations = useOperationProgress()
  const roadGuardian = useRoadGuardian()
  const { complete: completeOperation, merge: mergeOperations } = operations
  // One completion callback for the reader: School Fair chapters give a collectible, operation chapters don't.
  const finishChapter = useCallback((comicId: string) => {
    if (operationChapter(comicId) && !schoolFairChapter(comicId)) {
      // A first completion unlocks the chapter's find (the coins are paid by the server).
      const find = findForChapter(comicId)
      if (completeOperation(comicId) && find) logFind(find.id)
      return null
    }
    const collectible = completeChapter(comicId)
    if (collectible) logFind(collectible)
    return collectible
  }, [completeChapter, completeOperation])
  const { earned: bonusStickers, award: awardBonusSticker, restore: restoreBonusStickers } = useBonusStickers()
  const ready = account.ready
  useEffect(() => {
    if (!ready) return
    // Read the live address: right after sign-out the route state can lag one render behind.
    const current = parseRoute(window.location.hash)
    const target = screenFor(current, role)
    // A guest who scanned the battle QR (or opened a drill) comes back there after signing in.
    if (target?.name === 'login' && (current.name === 'battle' || current.name === 'lesson' || current.name === 'practiceTopic' || current.name === 'practice')) {
      rememberAfterLogin(window.location.hash)
    }
    // A student who just signed in goes back where they were heading (the battle QR, a drill).
    const back = role === 'student' && current.name === 'login' ? takeAfterLogin() : null
    if (back) navigate(back)
    else if (target) navigate(SECTION_HREFS[target.name as keyof typeof SECTION_HREFS])
    else if (role === 'student') takeAfterLogin()
  }, [route, role, ready, navigate])

  // A signed-in student's season progress lives on the server too: pull it in once per
  // sign-in, then push every new chapter or sticker (the server only ever adds).
  const student = account.user?.role === 'student' ? account.user : null
  const serverChapters = student?.profile?.completedChapters
  const serverStickers = student?.profile?.stickers
  const synced = useRef<number | null>(null)
  useEffect(() => {
    if (!student) {
      synced.current = null
      return
    }
    if (synced.current !== student.id) {
      synced.current = student.id
      mergeChapters(serverChapters ?? [])
      mergeOperations(serverChapters ?? [])
      mergeSecrets(serverChapters ?? [])
      restoreBonusStickers(serverStickers ?? [])
    }
  }, [student, serverChapters, serverStickers, mergeChapters, mergeOperations, restoreBonusStickers])
  const { saveProgress } = account
  const guardian = useGuardianChallenge()
  // Won finales, as progress ids: each pays coins once and unlocks its trophy.
  const [finaleTick, setFinaleTick] = useState(0)
  useEffect(() => {
    const onWin = () => setFinaleTick((n) => n + 1)
    window.addEventListener(FINALE_WON_EVENT, onWin)
    return () => window.removeEventListener(FINALE_WON_EVENT, onWin)
  }, [])
  // Every story's chapters in one set: the School Fair keeps its own progress (collectibles).
  const storyProgress = useMemo(() => new Set([...operations.completed, ...completedChapters]), [operations.completed, completedChapters])
  const wonFinales = useMemo(
    () => [
      ...(guardian.run.won ? [FAIR_FINALE_ID] : []),
      ...(roadGuardian.run.won ? [ROADS_FINALE_ID] : []),
      ...Object.keys(FINALES).filter((id) => finaleWon(id)).map(finaleProgressId),
    ],
    // finaleTick: a finale screen saved a win in storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guardian.run.won, roadGuardian.run.won, finaleTick],
  )
  const secrets = useFoundSecrets()
  useEffect(() => {
    if (!student || synced.current !== student.id) return
    // A won «Дороги ярмарки» finale is reported as its own progress id, so its reward is paid once.
    const chapters = [...completedChapters, ...operations.completed, ...wonFinales, ...secrets].sort()
    const stickers = [...bonusStickers].sort()
    const known = new Set(serverChapters ?? [])
    const missing = chapters.some((id) => !known.has(id)) || stickers.some((id) => !serverStickers?.includes(id))
    if (missing) saveProgress(chapters, stickers).catch(() => {})
  }, [student, completedChapters, operations.completed, wonFinales, secrets, bonusStickers, serverChapters, serverStickers, saveProgress])
  const continuationJob = useContinuationJob()
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  const t = STRINGS[lang]
  const myComics = useMyComics()
  // A saved generated comic belongs to My Comics; everything else to the catalog.
  const readerSection = route.name === 'comic' && myComics.some((c) => c.comicId === route.comicId) ? 'myComics' as const : 'comics' as const
  const readerNav = route.name === 'comic' && operationChapter(route.comicId) ? 'operations' as const : readerSection === 'comics' ? 'map' as const : readerSection
  const activeSection = route.name === 'comic' ? readerNav : route.name === 'operation' || route.name === 'operationFinale' ? 'operations' : route.name === 'teacherClass' || route.name === 'teacherBattle' || route.name === 'teacherLesson' ? 'teacher' : route.name === 'join' || route.name === 'lesson' || route.name === 'battle' ? 'myClass' : route.name === 'practice' || route.name === 'practiceTopic' ? 'map' : route.name === 'motionLeague' || route.name === 'roadGuardian' ? 'operations' : route.name === 'guardianAssignment' || route.name === 'guardian' || route.name === 'comics' ? 'map' : route.name
  const navigation = { t, active: activeSection, completed: completedChapters.size, remaining, myComics: myComics.length, guardianWon: guardian.run.won, operationsDone: storyProgress.size, className: student?.schoolClass?.name ?? null, lang }

  const openGenerated = useCallback(
    (comicId: string, request: ComicJobRequest) => {
      setLang(request.lang)
      navigate(comicHref(comicId))
    },
    [setLang, navigate],
  )

  return (
    <div className="site-bg min-h-dvh bg-[linear-gradient(180deg,#d9e8ff_0%,#eef4ff_45%,#f6f1e7_100%)] text-ink">
      <header className="border-b-4 border-ink bg-white shadow-[0_6px_0_rgb(29_39_102/0.12)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <a href={SECTION_HREFS.map} className="min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <Logo tagline={t.tagline} />
          </a>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {API_MODE === 'mock' && (
              <span className="hidden rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink/70 sm:inline">{t.mockBadge}</span>
            )}
            <ThemeToggle lang={lang} />
            <LanguageSwitcher lang={lang} onChange={setLang} />
            <AccountChip lang={lang} />
          </div>
        </div>
      </header>

      {role === 'parent' ? (
        <main className="mx-auto max-w-[90rem] min-w-0 px-3 py-4 sm:px-6 sm:py-6">
          <Suspense fallback={<ScreenLoading />}>
            {route.name === 'parent' && <ParentScreen lang={lang} />}
          </Suspense>
        </main>
      ) : role === 'teacher' ? (
        <main className="mx-auto max-w-[90rem] min-w-0 px-3 py-4 sm:px-6 sm:py-6">
          <Suspense fallback={<ScreenLoading />}>
          {route.name === 'teacher' && <TeacherHome lang={lang} />}
          {route.name === 'teacherClass' && <ClassDashboard key={route.classId} lang={lang} classId={route.classId} />}
          {route.name === 'teacherBattle' && <BattleBoardScreen key={route.battleId} lang={lang} battleId={route.battleId} />}
          {route.name === 'teacherLesson' && <LessonBoardScreen key={route.lessonId} lang={lang} lessonId={route.lessonId} />}
        </Suspense>
        </main>
      ) : (
      <>
      <div className="mx-auto max-w-[90rem] px-3 pt-3 sm:px-6 lg:hidden">
        <MobileNavigation {...navigation} />
      </div>
      <div className="mx-auto grid max-w-[90rem] gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <DesktopNavigation {...navigation} />
        <main className="min-w-0">
          <Suspense fallback={<ScreenLoading />}>
          {route.name === 'login' && <AuthScreen lang={lang} />}
          {route.name === 'profile' && role === 'student' && <ProfileScreen lang={lang} />}
          {route.name === 'battle' && role === 'student' && <BattleScreen lang={lang} />}
          {route.name === 'lesson' && role === 'student' && <StudentLessonScreen lang={lang} />}
          {route.name === 'join' && <JoinScreen key={route.code} lang={lang} code={route.code} to={route.to} />}
          {route.name === 'myClass' && <ClassScreen lang={lang} />}
          {route.name === 'practice' && <PracticeScreen lang={lang} topic={null} skill={null} />}
          {route.name === 'practiceTopic' && (
            <PracticeScreen lang={lang} topic={PRACTICE_TOPICS.includes(route.topic as BattleTopic) ? route.topic as BattleTopic : null} skill={route.skill} />
          )}
          {route.name === 'map' && (
            <HomeScreen lang={lang} progress={storyProgress} finalesWon={new Set(wonFinales)} />
          )}
          {route.name === 'comics' && <CatalogScreen lang={lang} completedChapters={completedChapters} />}
          {route.name === 'myComics' && <Suspense><MyComicsScreen lang={lang} comics={myComics} lastComicId={lastComicId} /></Suspense>}
          {route.name === 'backpack' && (
            <BackpackCollection t={t} lang={lang} completedChapters={completedChapters} bonusStickers={bonusStickers}
              operationChapters={operations.completed}
              finalesWon={new Set([...wonFinales, ...(serverChapters ?? []).filter((id) => id.endsWith('-finale'))])} />
          )}
          {route.name === 'guardian' && <Suspense><GuardianScreen lang={lang} remaining={remaining} challenge={guardian} /></Suspense>}
          {route.name === 'guardianAssignment' && <Suspense><AssignedGuardian key={guardianAssignmentHref(route.assignment)} assignment={route.assignment} remaining={remaining} lang={lang} /></Suspense>}
          {route.name === 'roadGuardian' && <RoadGuardianScreen lang={lang} challenge={roadGuardian} remaining={chaptersLeft('roads', operations.completed)} />}
          {route.name === 'operations' && <OperationsScreen lang={lang} completed={storyProgress} />}
          {route.name === 'operation' && (() => {
            const operation = findOperation(route.id)
            return operation
              ? <OperationScreen lang={lang} operation={operation} completed={storyProgress} finaleWon={operation.id === 'fair' ? guardian.run.won : operation.id === 'roads' ? roadGuardian.run.won : finaleWon(operation.id)} />
              : <OperationsScreen lang={lang} completed={storyProgress} />
          })()}
          {route.name === 'operationFinale' && (FINALES[route.id]
            ? <FinaleScreen key={route.id} lang={lang} def={FINALES[route.id]} remaining={chaptersLeft(route.id, operations.completed)} />
            : <OperationsScreen lang={lang} completed={operations.completed} />)}
          {route.name === 'motionLeague' && <Suspense><MotionLeague lang={lang} /></Suspense>}
          {route.name === 'comic' && (
            <ReaderScreen
              key={`${comicHref(route.comicId, route.ending)}|${route.replay ?? ''}`}
              comicId={route.comicId}
              lang={lang}
              onChapterComplete={finishChapter}
              onEarnBonusSticker={awardBonusSticker}
              continuationJob={continuationJob}
              chapterThreeSolved={route.comicId === SCHOOL_MAP_COMIC_ID && completedChapters.has(route.comicId)}
              openEnding={route.ending && !route.replay}
              backTo={readerSection}
              rememberReading={readerSection === 'myComics'}
              replay={route.replay}
              onOpen={rememberComic}
            />
          )}
          <div hidden={route.name !== 'create'} className="max-w-2xl">
            {account.user ? (
              <GenerateCard lang={lang} onReady={openGenerated} autoOpen={route.name === 'create'} />
            ) : ready && <SignInToCreate lang={lang} />}
          </div>
        </Suspense>
        </main>
      </div>
      </>
      )}
    </div>
  )
}
