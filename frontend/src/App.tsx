import { useCallback, useEffect, useRef } from 'react'
import { API_MODE, type ComicJobRequest, type Lang } from './api'
import { AccountProvider, useAccount } from './account'
import { ACCOUNT_COPY } from './accountCopy'
import { AuthScreen } from './components/AuthScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { ClassDashboard, TeacherHome } from './components/TeacherScreen'
import { BackpackCollection } from './components/BackpackCollection'
import { GenerateCard } from './components/GenerateCard'
import { CatalogScreen, HomeScreen } from './components/HomeScreen'
import { GuardianScreen } from './components/GuardianScreen'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { MyComicsScreen } from './components/MyComicsScreen'
import { ReaderScreen } from './components/ReaderScreen'
import { RoadGuardianScreen } from './components/RoadGuardianScreen'
import { DesktopNavigation, MobileNavigation } from './components/SectionNavigation'
import { useContinuationJob } from './continuation'
import { useGuardianChallenge } from './guardian'
import { ROAD_DAMAGE, ROAD_MAX_HP, useRoadGuardian } from './roadGuardian'
import { useLang } from './hooks'
import { useMyComics } from './myComics'
import { STRINGS } from './i18n'
import { usePriceTagSticker } from './priceTagSticker'
import { comicHref, parseRoute, SCHOOL_MAP_COMIC_ID, SECTION_HREFS, useRoute, type Route } from './route'
import { useSeasonProgress } from './seasonProgress'
import { SCHOOL_FAIR_CHAPTER_COUNT } from './schoolFair'

function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <p className="flex items-center gap-2" aria-label="AI Math Comics">
        <span
          aria-hidden
          className="grid h-9 place-items-center rounded-xl border-[3px] border-ink bg-white px-1.5 text-xl leading-none font-black text-brand-dark shadow-[0_3px_0_var(--color-ink)] max-[350px]:h-8 max-[350px]:text-lg sm:h-12 sm:text-3xl"
        >
          AI
        </span>
        <span aria-hidden className="comic-outline text-[22px] leading-none font-black tracking-tight whitespace-nowrap text-sun italic max-[350px]:text-base sm:text-4xl">
          MATH COMICS
        </span>
        <span aria-hidden className="hidden text-2xl sm:inline">
          ✏️
        </span>
      </p>
      <p className="max-w-full rounded-full border-2 border-ink bg-sun px-3 py-0.5 text-xs leading-tight text-balance font-extrabold text-ink sm:text-sm">{tagline}</p>
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
  const account = useAccount()
  const role = account.user?.role ?? null
  const { completedChapters, completeChapter, mergeChapters } = useSeasonProgress()
  const priceTagSticker = usePriceTagSticker()
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
      if (serverStickers?.includes('price-tag')) priceTagSticker.restore()
    }
  }, [student, serverChapters, serverStickers, mergeChapters, priceTagSticker])
  const { saveProgress } = account
  useEffect(() => {
    if (!student || synced.current !== student.id) return
    const chapters = [...completedChapters].sort()
    const stickers = priceTagSticker.earned ? ['price-tag'] : []
    const known = new Set(serverChapters ?? [])
    const missing = chapters.some((id) => !known.has(id)) || (stickers.length > 0 && !serverStickers?.includes('price-tag'))
    if (missing) saveProgress(chapters, stickers).catch(() => {})
  }, [student, completedChapters, priceTagSticker.earned, serverChapters, serverStickers, saveProgress])
  const guardian = useGuardianChallenge()
  const roadGuardian = useRoadGuardian()
  const continuationJob = useContinuationJob()
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  const t = STRINGS[lang]
  const myComics = useMyComics()
  // A saved generated comic belongs to My Comics; everything else to the catalog.
  const readerSection = route.name === 'comic' && myComics.some((c) => c.comicId === route.comicId) ? 'myComics' as const : 'comics' as const
  const navigation = { t, active: route.name === 'comic' ? readerSection : route.name === 'teacherClass' ? 'teacher' as const : route.name, completed: completedChapters.size, remaining, myComics: myComics.length, roadHp: ROAD_MAX_HP - roadGuardian.run.cleared * ROAD_DAMAGE, roadWon: roadGuardian.run.won, lang }

  const openGenerated = useCallback(
    (comicId: string, request: ComicJobRequest) => {
      setLang(request.lang)
      navigate(comicHref(comicId))
    },
    [setLang, navigate],
  )

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#d9e8ff_0%,#eef4ff_45%,#f6f1e7_100%)] text-ink">
      <header className="border-b-4 border-ink bg-[linear-gradient(100deg,var(--color-brand-dark),var(--color-brand)_60%,#4f86f2)] shadow-[0_6px_0_rgb(29_39_102/0.15)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-start justify-between gap-2 px-3 py-3 sm:items-center sm:px-6 sm:py-4">
          <a href={SECTION_HREFS.map} className="min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun">
            <Logo tagline={t.tagline} />
          </a>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {API_MODE === 'mock' && (
              <span className="hidden rounded-full bg-ink/40 px-2 py-0.5 text-[11px] font-bold text-white sm:inline">{t.mockBadge}</span>
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
            <HomeScreen lang={lang} completedChapters={completedChapters} remaining={remaining} guardianWon={guardian.run.won} />
          )}
          {route.name === 'comics' && <CatalogScreen lang={lang} completedChapters={completedChapters} />}
          {route.name === 'myComics' && <MyComicsScreen lang={lang} comics={myComics} />}
          {route.name === 'backpack' && (
            <BackpackCollection t={t} completedChapters={completedChapters} hasPriceTagSticker={priceTagSticker.earned} />
          )}
          {route.name === 'guardian' && <GuardianScreen lang={lang} remaining={remaining} challenge={guardian} />}
          {route.name === 'roadGuardian' && <RoadGuardianScreen lang={lang} challenge={roadGuardian} />}
          {route.name === 'comic' && (
            <ReaderScreen
              key={`${comicHref(route.comicId, route.ending)}|${route.replay ?? ''}`}
              comicId={route.comicId}
              lang={lang}
              onChapterComplete={completeChapter}
              onEarnPriceTagSticker={priceTagSticker.award}
              continuationJob={continuationJob}
              chapterThreeSolved={route.comicId === SCHOOL_MAP_COMIC_ID && completedChapters.has(route.comicId)}
              openEnding={route.ending && !route.replay}
              backTo={readerSection}
              replay={!!route.replay}
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
