import { useCallback } from 'react'
import { API_MODE, type ComicJobRequest } from './api'
import { HomeScreen } from './components/HomeScreen'
import { GuardianScreen } from './components/GuardianScreen'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ReaderScreen } from './components/ReaderScreen'
import { useContinuationJob } from './continuation'
import { useGuardianChallenge } from './guardian'
import { useLang } from './hooks'
import { STRINGS } from './i18n'
import { comicHref, SCHOOL_MAP_COMIC_ID, useRoute } from './route'
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
  const guardian = useGuardianChallenge()
  const continuationJob = useContinuationJob()
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  const t = STRINGS[lang]

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
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2 px-3 py-3 sm:items-center sm:px-4 sm:py-4">
          <a href="#/" className="min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun">
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

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        {route.name === 'comic' ? (
          <ReaderScreen
            key={comicHref(route.comicId, route.ending)}
            comicId={route.comicId}
            lang={lang}
            onChapterComplete={completeChapter}
            continuationJob={continuationJob}
            chapterThreeSolved={route.comicId === SCHOOL_MAP_COMIC_ID && completedChapters.has(route.comicId)}
            openEnding={route.ending}
          />
        ) : route.name === 'guardian' ? (
          <GuardianScreen lang={lang} remaining={remaining} challenge={guardian} />
        ) : (
          <HomeScreen lang={lang} onReady={openGenerated} completedChapters={completedChapters} guardianWon={guardian.run.won} />
        )}
      </main>
    </div>
  )
}
