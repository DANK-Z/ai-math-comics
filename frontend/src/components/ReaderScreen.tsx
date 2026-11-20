import { useState } from 'react'
import type { Lang } from '../api'
import { useComic } from '../hooks'
import { STRINGS } from '../i18n'
import { DEMO_COMIC_ID } from '../route'
import { ComicReader } from './ComicReader'

/** One comic (demo or generated). Mounted per comicId, so reader state resets between comics. */
export function ReaderScreen({ comicId, lang, onChapterComplete }: {
  comicId: string
  lang: Lang
  onChapterComplete: (comicId: string) => void
}) {
  const t = STRINGS[lang]
  const [index, setIndex] = useState(0)
  const { data: comic, loading, error, errorDetail, retry } = useComic(comicId, lang)

  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      <div className="flex items-center gap-3">
        <a
          href="#/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-[3px] border-ink bg-white px-4 font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          <span aria-hidden>←</span> {t.backHome}
        </a>
        {comicId === DEMO_COMIC_ID && (
          <span className="rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink uppercase">{t.demoBadge}</span>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[3px] border-rose-700 bg-rose-50 p-3 font-bold text-rose-900">
          <div>
            {t.loadError}
            {errorDetail && <code className="mt-0.5 block text-sm font-semibold break-words">{errorDetail}</code>}
          </div>
          <button type="button" onClick={retry} className="min-h-11 rounded-xl border-2 border-rose-700 bg-white px-3">
            {t.retry}
          </button>
        </div>
      )}

      {!comic && loading && <p className="py-20 text-center text-lg font-bold">{t.loading}</p>}

      {comic && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ComicReader comic={comic} lang={lang} index={index} onIndexChange={setIndex} onChapterComplete={onChapterComplete} />
        </div>
      )}
    </div>
  )
}
