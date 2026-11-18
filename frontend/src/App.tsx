import { useState } from 'react'
import { API_MODE } from './api'
import { ComicReader } from './components/ComicReader'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { useComic, useLang } from './hooks'
import { STRINGS } from './i18n'

const COMIC_ID = 'pizza-fractions'

function Logo({ tagline }: { tagline: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <p className="flex items-center gap-2" aria-label="AI Math Comics">
        <span
          aria-hidden
          className="grid h-9 place-items-center rounded-xl border-[3px] border-ink bg-white px-1.5 text-xl leading-none font-black text-brand-dark shadow-[0_3px_0_var(--color-ink)] sm:h-12 sm:text-3xl"
        >
          AI
        </span>
        <span aria-hidden className="comic-outline text-[22px] leading-none font-black tracking-tight whitespace-nowrap text-sun italic sm:text-4xl">
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
  const [index, setIndex] = useState(0)
  const { data: comic, loading, error, retry } = useComic(COMIC_ID, lang)
  const t = STRINGS[lang]

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#d9e8ff_0%,#eef4ff_45%,#f6f1e7_100%)] text-ink">
      <header className="border-b-4 border-ink bg-[linear-gradient(100deg,var(--color-brand-dark),var(--color-brand)_60%,#4f86f2)] shadow-[0_6px_0_rgb(29_39_102/0.15)]">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2 px-3 py-3 sm:items-center sm:px-4 sm:py-4">
          <Logo tagline={t.tagline} />
          <div className="flex items-center gap-2">
            {API_MODE === 'mock' && (
              <span className="hidden rounded-full bg-ink/40 px-2 py-0.5 text-[11px] font-bold text-white sm:inline">{t.mockBadge}</span>
            )}
            <LanguageSwitcher lang={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8" aria-busy={loading}>
        {error && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-[3px] border-rose-700 bg-rose-50 p-3 font-bold text-rose-900">
            {t.loadError}
            <button type="button" onClick={retry} className="rounded-xl border-2 border-rose-700 bg-white px-3 py-1">
              {t.retry}
            </button>
          </div>
        )}

        {!comic && loading && <p className="py-20 text-center text-lg font-bold">{t.loading}</p>}

        {comic && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <ComicReader comic={comic} lang={lang} index={index} onIndexChange={setIndex} />
          </div>
        )}
      </main>
    </div>
  )
}
