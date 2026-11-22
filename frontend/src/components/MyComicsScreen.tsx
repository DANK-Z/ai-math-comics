import { useState } from 'react'
import { resolveImageUrl, type Lang } from '../api'
import { useComic } from '../hooks'
import { STRINGS, type UiStrings } from '../i18n'
import { removeMyComic, type MyComic } from '../myComics'
import { comicHref, replayHref, SECTION_HREFS } from '../route'
import { PanelArt } from './PanelArt'

const ACTION =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border-[3px] border-ink px-3 font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun'

function formatDate(savedAt: number, lang: Lang) {
  const d = new Date(savedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  // Browsers often lack Kazakh month names (kk-KZ renders "M11"), so Kazakh uses a numeric date.
  if (lang === 'kk') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${time}`
  try {
    return `${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d)}, ${time}`
  } catch {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${time}`
  }
}

/** First-panel cover in a fixed 16:10 frame so every card lines up, whatever the art's ratio. */
function Thumbnail({ comic, loading, lang }: { comic: ReturnType<typeof useComic>['data']; loading: boolean; lang: Lang }) {
  const [failed, setFailed] = useState(false)
  const first = comic?.panels[0]
  return (
    <div aria-hidden className="relative aspect-[16/10] overflow-hidden bg-sky-100">
      {first?.imageUrl && !failed ? (
        <img src={resolveImageUrl(first.imageUrl)} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : first ? (
        <div className="flex h-full items-center">
          <div className="w-full">
            <PanelArt imageKey={first.imageKey} imageAspect={first.imageAspect} lang={lang} speaker={first.speaker} text="" thumb />
          </div>
        </div>
      ) : (
        <div className={`h-full ${loading ? 'animate-pulse bg-[linear-gradient(110deg,#dbe8ff_30%,#eef4ff_50%,#dbe8ff_70%)]' : 'grid place-items-center text-3xl'}`}>
          {!loading && '🖼️'}
        </div>
      )}
    </div>
  )
}

/** One saved comic: title and first-panel thumbnail come from the existing comic endpoint. */
function MyComicCard({ entry, lang, t }: { entry: MyComic; lang: Lang; t: UiStrings }) {
  const copy = t.myComics
  const { data: comic, loading, error } = useComic(entry.comicId, lang)
  const title = comic?.title ?? ''
  const titleId = `my-comic-${entry.comicId}`

  return (
    <li className="flex flex-col overflow-hidden rounded-[24px] border-[3px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]">
      <div className="relative border-b-[3px] border-ink bg-sky-100">
        <Thumbnail comic={comic} loading={loading} lang={lang} />
        <span className="absolute top-2 left-2 rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink">
          {copy.kind[entry.kind]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          {error && !comic ? (
            <p role="alert" className="font-bold text-rose-800">{copy.unavailable}</p>
          ) : (
            <h3 id={titleId} className="text-lg leading-tight font-black text-ink" aria-busy={loading}>
              {title || <span className="inline-block h-5 w-40 animate-pulse rounded bg-sky-100 align-middle" />}
            </h3>
          )}
          <p className="mt-1 text-sm font-bold text-ink/70">{copy.savedOn(formatDate(entry.savedAt, lang))}</p>
        </div>

        {error && !comic ? (
          <button type="button" onClick={() => removeMyComic(entry.comicId)} className={`${ACTION} bg-white`}>
            {copy.remove}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <a href={comicHref(entry.comicId)} aria-label={title ? copy.openLabel(title) : undefined} className={`${ACTION} bg-sun`}>
              <span aria-hidden>📖</span> {copy.open}
            </a>
            <a href={replayHref(entry.comicId)} aria-label={title ? copy.replayLabel(title) : undefined} className={`${ACTION} bg-white`}>
              <span aria-hidden>↺</span> {copy.replay}
            </a>
          </div>
        )}
      </div>
    </li>
  )
}

export function MyComicsScreen({ lang, comics }: { lang: Lang; comics: MyComic[] }) {
  const t = STRINGS[lang]
  const copy = t.myComics

  return (
    <section aria-labelledby="my-comics-title" className="flex flex-col gap-4">
      <div>
        <h1 id="my-comics-title" className="text-2xl font-black text-ink sm:text-3xl">{copy.title}</h1>
        <p className="mt-1 font-bold text-brand-dark">{copy.lead}</p>
      </div>

      {comics.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[24px] border-[3px] border-dashed border-ink/40 bg-white/70 p-5">
          <p className="font-bold text-ink/80">{copy.empty}</p>
          <a href={SECTION_HREFS.create} className={`${ACTION} flex-none bg-sun px-4`}>
            <span aria-hidden>✨</span> {copy.emptyCta}
          </a>
        </div>
      ) : (
        <ol role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comics.map((entry) => (
            <MyComicCard key={entry.comicId} entry={entry} lang={lang} t={t} />
          ))}
        </ol>
      )}
    </section>
  )
}
