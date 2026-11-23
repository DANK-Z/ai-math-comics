import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { API_MODE, type ComicJobRequest, type Lang } from './api'
import logoUrl from './assets/logo.webp'
import { AccountProvider, useAccount } from './account'
import { ACCOUNT_COPY } from './accountCopy'
import { AuthScreen } from './components/AuthScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { ClassDashboard, TeacherHome } from './components/TeacherScreen'
import { BackpackCollection } from './components/BackpackCollection'
import { GenerateCard } from './components/GenerateCard'
import { CatalogScreen, HomeScreen } from './components/HomeScreen'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ReaderScreen } from './components/ReaderScreen'
import { FinaleScreen } from './components/FinaleScreen'
import { OperationScreen, OperationsScreen } from './components/OperationsScreen'
import { FINALES, finaleWon } from './finales'
import { RoadGuardianScreen } from './components/RoadGuardianScreen'
import { DesktopNavigation, MobileNavigation } from './components/SectionNavigation'
import { useContinuationJob } from './continuation'
import { useGuardianChallenge } from './guardian'
import { guardianAssignmentHref, type GuardianAssignment } from './guardianAssignment'
import { useRoadGuardian } from './roadGuardian'
import { useLang } from './hooks'
import { useMyComics } from './myComics'
import { STRINGS } from './i18n'
import { useBonusStickers } from './bonusStickers'
import { comicHref, parseRoute, SCHOOL_MAP_COMIC_ID, SECTION_HREFS, useRoute, type Route } from './route'
import { chaptersLeft, findOperation, operationChapter, useOperationProgress } from './operations'
import { findForChapter, logFind, ROADS_FINALE_ID } from './rewards'
import { useSeasonProgress } from './seasonProgress'
import { SCHOOL_FAIR_CHAPTER_COUNT } from './schoolFair'

const MotionLeague = lazy(() => import('./components/MotionLeague'))
const GuardianScreen = lazy(() => import('./components/GuardianScreen'))
const MyComicsScreen = lazy(() => import('./components/MyComicsScreen'))

function AssignedGuardian({ assignment, remaining, lang }: { assignment: GuardianAssignment; remaining: number; lang: Lang }) {
  const challenge = useGuardianChallenge(assignment)
  return <GuardianScreen lang={lang} remaining={remaining} challenge={challenge} assigned />
}

function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <img src={logoUrl} alt="AI Math Comics" width={773} height={176} className="h-10 w-auto max-w-full min-[380px]:h-11 sm:h-16 lg:h-[4.5rem]" />
      <p className="hidden max-w-full rounded-full bg-sun px-3 py-0.5 text-xs leading-tight font-extrabold text-ink sm:block">{tagline}</p>
    </div>
  )
}

/** Header account button: Sign in, or the student's name and coins, or the teacher's name. */
function AccountChip({ lang }: { lang: Lang }) {
  const { user, ready } = useAccount()
  const c = ACCOUNT_COPY[lang]
  const base =
    'inline-flex min-h-11 max-w-[11rem] items-center gap-1.5 rounded-xl border-[3px] border-ink px-3 text-sm font-black text-ink shadow-[0_3px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun sm:max-w-[16rem] sm:text-base'
  if (!ready) return null
  if (!user) return <a href={SECTION_HREFS.login} className={`${base} bg-sun`}>{c.signIn}</a>
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
function screenFor(route: Route, role: 'student' | 'teacher' | null): Route | null {
  const teacherRoute = route.name === 'teacher' || route.name === 'teacherClass'
  if (role === 'teacher') return teacherRoute ? null : { name: 'teacher' }
  if (role === 'student') return teacherRoute || route.name === 'login' ? { name: 'map' } : null
  return teacherRoute || route.name === 'profile' ? { name: 'login' } : null
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
    if (operationChapter(comicId)) {
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
    const target = screenFor(parseRoute(window.location.hash), role)
    if (target) navigate(SECTION_HREFS[target.name as keyof typeof SECTION_HREFS])
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
      restoreBonusStickers(serverStickers ?? [])
    }
  }, [student, serverChapters, serverStickers, mergeChapters, mergeOperations, restoreBonusStickers])
  const { saveProgress } = account
  useEffect(() => {
    if (!student || synced.current !== student.id) return
    // A won «Дороги ярмарки» finale is reported as its own progress id, so its reward is paid once.
    const chapters = [...completedChapters, ...operations.completed, ...(roadGuardian.run.won ? [ROADS_FINALE_ID] : [])].sort()
    const stickers = [...bonusStickers].sort()
    const known = new Set(serverChapters ?? [])
    const missing = chapters.some((id) => !known.has(id)) || stickers.some((id) => !serverStickers?.includes(id))
    if (missing) saveProgress(chapters, stickers).catch(() => {})
  }, [student, completedChapters, operations.completed, roadGuardian.run.won, bonusStickers, serverChapters, serverStickers, saveProgress])
  const guardian = useGuardianChallenge()
  const continuationJob = useContinuationJob()
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  const t = STRINGS[lang]
  const myComics = useMyComics()
  // A saved generated comic belongs to My Comics; everything else to the catalog.
  const readerSection = route.name === 'comic' && myComics.some((c) => c.comicId === route.comicId) ? 'myComics' as const : 'comics' as const
  const readerNav = route.name === 'comic' && operationChapter(route.comicId) ? 'operations' as const : readerSection === 'comics' ? 'map' as const : readerSection
  const activeSection = route.name === 'comic' ? readerNav : route.name === 'operation' || route.name === 'operationFinale' ? 'operations' : route.name === 'teacherClass' ? 'teacher' : route.name === 'motionLeague' || route.name === 'roadGuardian' ? 'operations' : route.name === 'guardianAssignment' || route.name === 'guardian' || route.name === 'comics' ? 'map' : route.name
  const navigation = { t, active: activeSection, completed: completedChapters.size, remaining, myComics: myComics.length, guardianWon: guardian.run.won, operationsDone: operations.completed.size, lang }

  const openGenerated = useCallback(
    (comicId: string, request: ComicJobRequest) => {
      setLang(request.lang)
      navigate(comicHref(comicId))
    },
    [setLang, navigate],
  )

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#d9e8ff_0%,#eef4ff_45%,#f6f1e7_100%)] text-ink">
      <header className="border-b-4 border-ink bg-white shadow-[0_6px_0_rgb(29_39_102/0.12)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <a href={SECTION_HREFS.map} className="min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <Logo tagline={t.tagline} />
          </a>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {API_MODE === 'mock' && (
              <span className="hidden rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink/70 sm:inline">{t.mockBadge}</span>
            )}
            <LanguageSwitcher lang={lang} onChange={setLang} />
            <AccountChip lang={lang} />
          </div>
        </div>
      </header>

      {role === 'teacher' ? (
        <main className="mx-auto max-w-[90rem] min-w-0 px-3 py-4 sm:px-6 sm:py-6">
          {route.name === 'teacher' && <TeacherHome lang={lang} />}
          {route.name === 'teacherClass' && <ClassDashboard key={route.classId} lang={lang} classId={route.classId} />}
        </main>
      ) : (
      <>
      <div className="mx-auto max-w-[90rem] px-3 pt-3 sm:px-6 lg:hidden">
        <MobileNavigation {...navigation} />
      </div>
      <div className="mx-auto grid max-w-[90rem] gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <DesktopNavigation {...navigation} />
        <main className="min-w-0">
          {route.name === 'login' && <AuthScreen lang={lang} />}
          {route.name === 'profile' && role === 'student' && <ProfileScreen lang={lang} />}
          {route.name === 'map' && (
            <HomeScreen lang={lang} completedChapters={completedChapters} remaining={remaining} guardianWon={guardian.run.won}
              lastComicId={lastComicId} />
          )}
          {route.name === 'comics' && <CatalogScreen lang={lang} completedChapters={completedChapters} />}
          {route.name === 'myComics' && <Suspense><MyComicsScreen lang={lang} comics={myComics} lastComicId={lastComicId} /></Suspense>}
          {route.name === 'backpack' && (
            <BackpackCollection t={t} lang={lang} completedChapters={completedChapters} bonusStickers={bonusStickers}
              operationChapters={operations.completed}
              finalesWon={new Set(roadGuardian.run.won || serverChapters?.includes(ROADS_FINALE_ID) ? [ROADS_FINALE_ID] : [])} />
          )}
          {route.name === 'guardian' && <Suspense><GuardianScreen lang={lang} remaining={remaining} challenge={guardian} /></Suspense>}
          {route.name === 'guardianAssignment' && <Suspense><AssignedGuardian key={guardianAssignmentHref(route.assignment)} assignment={route.assignment} remaining={remaining} lang={lang} /></Suspense>}
          {route.name === 'roadGuardian' && <RoadGuardianScreen lang={lang} challenge={roadGuardian} remaining={chaptersLeft('roads', operations.completed)} />}
          {route.name === 'operations' && <OperationsScreen lang={lang} completed={operations.completed} />}
          {route.name === 'operation' && (() => {
            const operation = findOperation(route.id)
            return operation
              ? <OperationScreen lang={lang} operation={operation} completed={operations.completed} finaleWon={operation.id === 'roads' ? roadGuardian.run.won : finaleWon(operation.id)} />
              : <OperationsScreen lang={lang} completed={operations.completed} />
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
            <GenerateCard lang={lang} onReady={openGenerated} autoOpen={route.name === 'create'} />
          </div>
        </main>
      </div>
      </>
      )}
    </div>
  )
}
