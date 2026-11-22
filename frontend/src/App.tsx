import { useCallback } from 'react'
import { API_MODE, type ComicJobRequest } from './api'
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
import { comicHref, SCHOOL_MAP_COMIC_ID, SECTION_HREFS, useRoute } from './route'
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

export default function App() {
  const [lang, setLang] = useLang()
  const [route, navigate] = useRoute()
  const { completedChapters, completeChapter } = useSeasonProgress()
  const priceTagSticker = usePriceTagSticker()
  const guardian = useGuardianChallenge()
  const roadGuardian = useRoadGuardian()
  const continuationJob = useContinuationJob()
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  const t = STRINGS[lang]
  const myComics = useMyComics()
  // A saved generated comic belongs to My Comics; everything else to the catalog.
  const readerSection = route.name === 'comic' && myComics.some((c) => c.comicId === route.comicId) ? 'myComics' as const : 'comics' as const
  const navigation = { t, active: route.name === 'comic' ? readerSection : route.name, completed: completedChapters.size, remaining, myComics: myComics.length, roadHp: ROAD_MAX_HP - roadGuardian.run.cleared * ROAD_DAMAGE, roadWon: roadGuardian.run.won, lang }

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
        <div className="mx-auto flex max-w-[90rem] items-start justify-between gap-2 px-3 py-3 sm:items-center sm:px-6 sm:py-4">
          <a href={SECTION_HREFS.map} className="min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun">
            <Logo tagline={t.tagline} />
          </a>
          <div className="flex items-center gap-2">
            {API_MODE === 'mock' && (
              <span className="hidden rounded-full bg-ink/40 px-2 py-0.5 text-[11px] font-bold text-white sm:inline">{t.mockBadge}</span>
            )}
            <LanguageSwitcher lang={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-3 pt-3 sm:px-6 lg:hidden">
        <MobileNavigation {...navigation} />
      </div>
      <div className="mx-auto grid max-w-[90rem] gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <DesktopNavigation {...navigation} />
        <main className="min-w-0">
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
            />
          )}
          <div hidden={route.name !== 'create'} className="max-w-2xl">
            <GenerateCard lang={lang} onReady={openGenerated} autoOpen={route.name === 'create'} />
          </div>
        </main>
      </div>
    </div>
  )
}
