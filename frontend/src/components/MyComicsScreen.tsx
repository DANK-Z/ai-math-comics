import { useRef, useState } from 'react'
import { resolveImageUrl, type Lang } from '../api'
import { useComic } from '../hooks'
import { STRINGS, type UiStrings } from '../i18n'
import { MY_COMIC_TITLE_LIMIT, removeMyComic, renameMyComic, restoreMyComic, type MyComic, type MyComicKind } from '../myComics'
import { comicHref, replayHref, SECTION_HREFS } from '../route'
import { PanelArt } from './PanelArt'

const ACTION =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[3px] border-ink px-4 text-center font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun'
const FIELD = 'min-h-11 w-full rounded-xl border-[3px] border-ink bg-white px-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun'

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
function MyComicCard({ entry, lang, t, search, onRemove }: {
  entry: MyComic; lang: Lang; t: UiStrings; search: string; onRemove: (entry: MyComic) => void
}) {
  const copy = t.myComics
  const { data: comic, loading, error } = useComic(entry.comicId, lang)
  const [editing, setEditing] = useState(false)
  const changeTitle = useRef<HTMLButtonElement>(null)
  const title = entry.customTitle || comic?.title || ''
  const titleId = `my-comic-${entry.comicId}`
  const matches = !search || loading || [title, comic?.title].some((text) => text?.toLowerCase().includes(search))
  const closeEditor = () => { setEditing(false); changeTitle.current?.focus() }

  return (
    <li hidden={!matches} className={`${matches ? 'flex' : 'hidden'} min-w-0 flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]`}>
      <div className="relative border-b-[3px] border-ink bg-sky-100">
        <Thumbnail comic={comic} loading={loading} lang={lang} />
        <span className="absolute top-2 left-2 rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink">
          {copy.kind[entry.kind]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          {(title || !error) && (
            <h3 id={titleId} className="text-lg leading-tight font-black break-words text-ink" aria-busy={loading}>
              {title || <span className="inline-block h-5 w-40 animate-pulse rounded bg-sky-100 align-middle" />}
            </h3>
          )}
          {error && !comic && (
            <p role="alert" className="font-bold text-rose-800">{copy.unavailable}</p>
          )}
          <p className="mt-1 text-sm font-bold text-ink/70">{copy.savedOn(formatDate(entry.savedAt, lang))}</p>
        </div>

        {comic && (
          <div className="flex flex-wrap gap-2">
            <a href={comicHref(entry.comicId)} aria-label={title ? copy.openLabel(title) : undefined} className={`${ACTION} bg-sun`}>
              <span aria-hidden>📖</span> {copy.open}
            </a>
            <a href={replayHref(entry.comicId)} aria-label={title ? copy.replayLabel(title) : undefined} className={`${ACTION} bg-white`}>
              <span aria-hidden>↺</span> {copy.replay}
            </a>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button ref={changeTitle} type="button" aria-expanded={editing} onClick={() => setEditing((open) => !open)} className="min-h-11 text-sm font-bold underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
            {copy.rename}
          </button>
          <button type="button" onClick={() => onRemove(entry)} className="min-h-11 text-sm font-bold underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
            {copy.remove}
          </button>
        </div>
        {editing && (
          <form className="grid gap-2" onSubmit={(event) => {
            event.preventDefault()
            const value = new FormData(event.currentTarget).get('title')
            if (typeof value === 'string') renameMyComic(entry.comicId, value)
            closeEditor()
          }} onKeyDown={(event) => { if (event.key === 'Escape') closeEditor() }}>
            <label className="grid gap-1 text-sm font-bold">
              {copy.customTitle}
              <input autoFocus name="title" defaultValue={entry.customTitle || comic?.title} maxLength={MY_COMIC_TITLE_LIMIT} className={FIELD} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={`${ACTION} bg-sun`}>{copy.saveTitle}</button>
              <button type="button" onClick={closeEditor} className={`${ACTION} bg-white`}>{copy.cancel}</button>
            </div>
          </form>
        )}
      </div>
    </li>
  )
}

export default function MyComicsScreen({ lang, comics }: { lang: Lang; comics: MyComic[] }) {
  const t = STRINGS[lang]
  const copy = t.myComics
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<MyComicKind | ''>('')
  const [removed, setRemoved] = useState<MyComic | null>(null)
  const filtered = kind ? comics.filter((entry) => entry.kind === kind) : comics
  const remove = (entry: MyComic) => {
    removeMyComic(entry.comicId)
    setRemoved(entry)
  }

  return (
    <section aria-labelledby="my-comics-title" className="flex flex-col gap-4">
      <div>
        <h1 id="my-comics-title" className="text-2xl font-black text-ink sm:text-3xl">{copy.title}</h1>
        <p className="mt-1 font-bold text-brand-dark">{copy.lead}</p>
      </div>
      {removed && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-white p-3">
          <p role="status" className="font-bold">{copy.removed}</p>
          <button autoFocus type="button" className={`${ACTION} flex-none bg-sun`} onClick={() => {
            restoreMyComic(removed)
            setRemoved(null)
          }}>{copy.undo}</button>
        </div>
      )}

      {comics.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border-[3px] border-dashed border-ink/40 bg-white/70 p-5">
          <p className="font-bold text-ink/80">{copy.empty}</p>
          <a href={SECTION_HREFS.create} className={`${ACTION} flex-none bg-sun px-4`}>
            <span aria-hidden>✨</span> {copy.emptyCta}
          </a>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              {copy.search}
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={FIELD} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-bold">
              {copy.filter}
              <select value={kind} onChange={(event) => setKind(event.target.value as MyComicKind | '')} className={FIELD}>
                <option value="">{copy.all}</option>
                {Object.entries(copy.kind).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="group">
            <ol role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => (
                <MyComicCard key={entry.comicId} entry={entry} lang={lang} t={t} search={search.trim().toLowerCase()} onRemove={remove} />
              ))}
            </ol>
            <p role="status" className="hidden font-bold group-not-has-[li:not([hidden])]:block">{copy.noMatches}</p>
          </div>
        </>
      )}
    </section>
  )
}
