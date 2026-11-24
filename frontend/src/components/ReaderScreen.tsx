import { useCallback, useEffect, useState } from 'react'
import type { Lang } from '../api'
import { SCHOOL_MAP } from '../api/fairChapters'
import type { BonusSticker } from '../bonusPuzzles'
import { CONTINUATION_COPY, type ContinuationJob } from '../continuation'
import { useComic } from '../hooks'
import { STRINGS } from '../i18n'
import { readReadingProgress, startReadingReplay, updateReadingProgress } from '../readingProgress'
import { operationChapter, operationHref } from '../operations'
import { comicHref, DEMO_COMIC_ID, SECTION_HREFS } from '../route'
import type { SchoolFairCollectible } from '../schoolFair'
import { ComicReader } from './ComicReader'

const BRANCH_LINK = 'inline-flex min-h-11 items-center rounded-2xl border-2 border-ink bg-white px-3 font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun'

/** One comic (demo or generated). Mounted per comicId, so reader state resets between comics. */
export function ReaderScreen({ comicId, lang, onChapterComplete, onEarnBonusSticker, continuationJob, chapterThreeSolved, openEnding, backTo = 'comics', replay, rememberReading, onOpen }: {
  comicId: string
  lang: Lang
  onChapterComplete: (comicId: string) => SchoolFairCollectible | null
  onEarnBonusSticker: (id: BonusSticker) => boolean
  continuationJob: ContinuationJob
  chapterThreeSolved: boolean
  openEnding: boolean
  /** Section the back link returns to: the catalog, or My Comics for saved generated comics. */
  backTo?: 'comics' | 'myComics'
  /** Opened with a Replay link. */
  replay: string | null
  rememberReading: boolean
  onOpen: (comicId: string) => void
}) {
  const t = STRINGS[lang]
  const [initial] = useState(() => {
    const saved = rememberReading ? readReadingProgress(comicId) : null
    const fresh = replay !== null && replay !== saved?.replay
    return { fresh, saved: fresh ? null : saved }
  })
  const [index, setIndex] = useState(() => openEnding && chapterThreeSolved ? SCHOOL_MAP.panels.length - 1 : initial.saved?.index ?? 0)
  const [savedSolved, setSavedSolved] = useState(initial.saved?.solved ?? false)
  const { data: comic, loading, error, errorDetail, retry } = useComic(comicId, lang)
  const operation = operationChapter(comicId)?.operation
  const loadedId = comic?.id
  useEffect(() => {
    if (loadedId === comicId) onOpen(comicId)
  }, [comicId, loadedId, onOpen])
  useEffect(() => {
    if (rememberReading && replay && initial.fresh) startReadingReplay(comicId, replay)
  }, [comicId, rememberReading, replay, initial.fresh])

  const finishChapter = useCallback((id: string) => {
    if (rememberReading) {
      setSavedSolved(true)
      updateReadingProgress(id, { solved: true })
    }
    return onChapterComplete(id)
  }, [onChapterComplete, rememberReading])
  const changePanel = useCallback((next: number) => {
    setIndex(next)
    if (rememberReading) updateReadingProgress(comicId, { index: next })
  }, [comicId, rememberReading])

  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={operation ? operationHref(operation.id) : backTo === 'myComics' ? SECTION_HREFS.myComics : SECTION_HREFS.map}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border-[3px] border-ink bg-white px-4 font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          <span aria-hidden>←</span> {operation ? operation.title[lang] : backTo === 'myComics' ? t.myComics.title : t.fairRoute.title}
        </a>
        {comic?.continuation && (
          <>
            <a href={comicHref(comic.continuation.sourceChapterId, true)} className={BRANCH_LINK}>
              {CONTINUATION_COPY[lang].source}
            </a>
            <a href={comicHref(comic.continuation.nextChapterId)} className={BRANCH_LINK}>
              {CONTINUATION_COPY[lang].canonical}
            </a>
          </>
        )}
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
          <ComicReader comic={comic} lang={lang} index={index} onIndexChange={changePanel}
            onChapterComplete={finishChapter} onEarnBonusSticker={onEarnBonusSticker}
            continuationJob={continuationJob} chapterThreeSolved={chapterThreeSolved}
            replay={initial.fresh} syncBossProgress={replay === null && !initial.saved?.replay}
            rememberReading={rememberReading} savedSolved={savedSolved} />
        </div>
      )}
    </div>
  )
}
