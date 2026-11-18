import { useState } from 'react'
import { API_MODE } from './api'
import { ComicReader } from './components/ComicReader'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { useComic, useLang } from './hooks'
import { STRINGS } from './i18n'

const COMIC_ID = 'pizza-fractions'

export default function App() {
  const [lang, setLang] = useLang()
  const [index, setIndex] = useState(0)
  const { data: comic, loading, error, retry } = useComic(COMIC_ID, lang)
  const t = STRINGS[lang]

  return (
    <div className="min-h-dvh bg-amber-50 bg-[radial-gradient(#fde68a_1px,transparent_1px)] [background-size:16px_16px] text-stone-900">
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-widest text-amber-700 uppercase">
              AI Math Comics
              {API_MODE === 'mock' && (
                <span className="ml-2 rounded bg-stone-900 px-1.5 py-0.5 text-[10px] text-amber-50">{t.mockBadge}</span>
              )}
            </p>
            <h1 className="text-2xl font-black sm:text-3xl" aria-busy={loading}>
              {comic?.title ?? ' '}
            </h1>
          </div>
          <LanguageSwitcher lang={lang} onChange={setLang} />
        </header>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border-2 border-rose-700 bg-rose-50 p-3 font-semibold text-rose-900">
            {t.loadError}
            <button type="button" onClick={retry} className="rounded-lg border-2 border-rose-700 bg-white px-3 py-1">
              {t.retry}
            </button>
          </div>
        )}

        {!comic && loading && <p className="py-20 text-center text-lg font-semibold">{t.loading}</p>}

        {comic && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <ComicReader comic={comic} lang={lang} index={index} onIndexChange={setIndex} />
          </div>
        )}
      </main>
    </div>
  )
}
