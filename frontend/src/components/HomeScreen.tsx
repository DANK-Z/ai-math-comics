import { useId, useState, type CSSProperties } from 'react'
import type { ComicJobRequest, Lang } from '../api'
import { GARLAND, LEMONADE, LIBRARY_BOXES, SCHOOL_MAP } from '../api/fairChapters'
import type { LocalComicDef } from '../api/localComics'
import { SCHOOL_STORE } from '../api/schoolStore'
import garlandCover from '../assets/garland/cover.webp'
import lemonadeCover from '../assets/lemonade/cover.webp'
import libraryCover from '../assets/library-boxes/cover.webp'
import mapCover from '../assets/school-map/cover.webp'
import pizzaCover from '../assets/pizza/cover.png'
import storeCover from '../assets/school-store/cover.png'
import { STRINGS, type UiStrings } from '../i18n'
import { comicHref, DEMO_COMIC_ID, GUARDIAN_HREF } from '../route'
import { SCHOOL_FAIR_CHAPTER_COUNT, schoolFairChapter } from '../schoolFair'
import { GenerateCard } from './GenerateCard'

/** How a cover is cropped in its card: box aspect ratio + CSS object-position focal point. */
interface Framing {
  aspect: string
  focus: string
}

interface CatalogEntry {
  id: string
  cover: string
  /** Phones (single column) and wider screens get separate crops. */
  framing: { phone: Framing; wide: Framing }
  title: (lang: Lang, t: UiStrings) => string
  hook: (lang: Lang, t: UiStrings) => string
  topic: keyof UiStrings['catalogTopics']
  /** Only set when the comic's own metadata confirms it; never guessed. */
  grade?: number
}

// Each cover is cropped on its own. Both current artworks are 2:1 with the cast on the
// right and empty wall/window on the left, so the crops trim the left side and keep
// faces plus the story object (pizzas / backpack). When adding comics, vary the
// composition (cast left, centre, close-up…) instead of repeating one layout, and
// give each entry framing that suits its own art.
const CATALOG: CatalogEntry[] = [
  {
    id: DEMO_COMIC_ID,
    cover: pizzaCover,
    // Cast spans ~20–100% horizontally, pizzas along the bottom edge.
    framing: { phone: { aspect: '8 / 5', focus: '100% 55%' }, wide: { aspect: '8 / 5', focus: '100% 55%' } },
    title: (_lang, t) => t.demoTitle,
    hook: (_lang, t) => t.pizzaHook,
    topic: 'fractions',
  },
  // Aldiyar at ~28%, Aruna ~55%, the backpack ~70–88%, Pifik top right.
  local(SCHOOL_STORE, storeCover, 'percentages', { phone: { aspect: '4 / 3', focus: '82% 45%' }, wide: { aspect: '8 / 5', focus: '92% 45%' } }),
  // Cast around the map from ~6% to ~65%, backpack at ~80–88%: keep both ends.
  local(SCHOOL_MAP, mapCover, 'scale', { phone: { aspect: '4 / 3', focus: '45% 50%' }, wide: { aspect: '8 / 5', focus: '60% 50%' } }),
  // Kids and boxes on the left two thirds, shelves on the right.
  local(LIBRARY_BOXES, libraryCover, 'equations', { phone: { aspect: '4 / 3', focus: '30% 55%' }, wide: { aspect: '8 / 5', focus: '20% 55%' } }),
  // Symmetric: Aldiyar left, the jug centred, Aruna right.
  local(LEMONADE, lemonadeCover, 'proportions', { phone: { aspect: '3 / 2', focus: '50% 50%' }, wide: { aspect: '8 / 5', focus: '50% 50%' } }),
  // Wide group shot around the board: keep a wider crop so both kids stay in.
  local(GARLAND, garlandCover, 'perimeter', { phone: { aspect: '3 / 2', focus: '45% 55%' }, wide: { aspect: '16 / 9', focus: '50% 55%' } }),
]

function local(def: LocalComicDef, cover: string, topic: CatalogEntry['topic'], framing: CatalogEntry['framing']): CatalogEntry {
  return { id: def.id, cover, framing, topic, title: (lang) => def.text[lang].title, hook: (lang) => def.text[lang].hook }
}

function CatalogCard({ entry, lang, t, completed }: {
  entry: CatalogEntry
  lang: Lang
  t: UiStrings
  completed: boolean
}) {
  const titleId = `${entry.id}-title`
  const chapter = schoolFairChapter(entry.id)
  const chapterId = `${entry.id}-chapter`
  const vars = {
    '--ar-phone': entry.framing.phone.aspect,
    '--ar-wide': entry.framing.wide.aspect,
    '--focus-phone': entry.framing.phone.focus,
    '--focus-wide': entry.framing.wide.focus,
  } as CSSProperties

  return (
    <a
      href={comicHref(entry.id)}
      aria-labelledby={titleId}
      aria-describedby={chapter ? chapterId : undefined}
      className="group flex flex-col rounded-[28px] border-[3px] border-ink/10 bg-white p-3 shadow-[0_10px_30px_rgb(36_57_159/0.15)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun sm:p-4"
    >
      <div
        style={vars}
        className="relative aspect-(--ar-phone) overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100 transition group-hover:-translate-y-0.5 sm:aspect-(--ar-wide)"
      >
        <img src={entry.cover} alt="" className="h-full w-full object-cover object-(--focus-phone) sm:object-(--focus-wide)" />
        <p className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border-[3px] border-ink bg-sun px-2.5 py-0.5 text-sm font-black text-ink shadow-[0_2px_0_var(--color-ink)]">
            {t.catalogTopics[entry.topic]}
          </span>
          {entry.grade !== undefined && (
            <span className="rounded-full border-[3px] border-ink bg-white px-2.5 py-0.5 text-sm font-black text-ink shadow-[0_2px_0_var(--color-ink)]">
              {t.gradeOption(entry.grade)}
            </span>
          )}
        </p>
      </div>
      <div className="flex-1 px-1 pt-3 pb-4">
        {chapter && (
          <p id={chapterId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-brand-dark">
            <span>{t.chapterLabel(chapter.number)}</span>
            {completed && (
              <span className="rounded-full border-2 border-emerald-700 bg-emerald-100 px-2 text-emerald-900">
                {t.chapterCompleted}
              </span>
            )}
          </p>
        )}
        <h3 id={titleId} className="text-xl font-black text-ink">
          {entry.title(lang, t)}
        </h3>
        <p className="mt-0.5 font-bold text-ink/80">{entry.hook(lang, t)}</p>
      </div>
      <span className="flex min-h-12 items-center justify-center rounded-2xl border-[3px] border-ink bg-sun text-lg font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition group-active:translate-y-[3px] group-active:shadow-[0_1px_0_var(--color-ink)]">
        {t.readComic} <span className="ml-2" aria-hidden>→</span>
      </span>
    </a>
  )
}

function hasActiveJob() {
  try {
    return sessionStorage.getItem('amc.activeJob') !== null
  } catch {
    return false
  }
}

export function HomeScreen({ lang, onReady, completedChapters, guardianWon }: {
  lang: Lang
  onReady: (comicId: string, request: ComicJobRequest) => void
  completedChapters: ReadonlySet<string>
  guardianWon: boolean
}) {
  const t = STRINGS[lang]
  const remaining = SCHOOL_FAIR_CHAPTER_COUNT - completedChapters.size
  // Open by default only when a generation job is in progress, so it can resume.
  const [createOpen, setCreateOpen] = useState(hasActiveJob)
  const panelId = useId()

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section aria-labelledby="catalog-title">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{t.schoolFairTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-sm font-black text-ink">
              {t.seasonProgress(completedChapters.size, SCHOOL_FAIR_CHAPTER_COUNT)}
            </p>
            <a href={GUARDIAN_HREF} className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-sun px-3 font-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {t.guardian.title}
            </a>
            {remaining > 0 ? (
              <p className="text-sm font-bold text-ink/80">{t.guardian.remaining(remaining)}</p>
            ) : guardianWon && (
              <p className="rounded-full border-2 border-emerald-700 bg-emerald-100 px-2 text-sm font-bold text-emerald-900">{t.guardian.wonBadge}</p>
            )}
          </div>
          <h2 id="catalog-title" className="mt-2 text-lg font-black text-ink sm:text-xl">
            {t.catalogTitle}
          </h2>
          <p className="mt-1 text-base font-bold text-brand-dark sm:text-lg">{t.catalogLead}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {CATALOG.map((entry) => (
            <CatalogCard key={entry.id} entry={entry} lang={lang} t={t} completed={completedChapters.has(entry.id)} />
          ))}
        </div>
      </section>

      <section aria-label={t.createOwn} className="flex flex-col items-start gap-3">
        <button
          type="button"
          aria-expanded={createOpen}
          aria-controls={panelId}
          onClick={() => setCreateOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border-[3px] border-ink bg-white px-4 font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition hover:bg-sky active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          <span aria-hidden>{createOpen ? '✕' : '✨'}</span>
          {createOpen ? t.hideForm : t.createOwn}
          <span aria-hidden className={`text-sm transition-transform ${createOpen ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {/* Stays mounted while collapsed, so selections (and any running job) are kept. */}
        <div id={panelId} hidden={!createOpen} className="w-full max-w-2xl">
          <GenerateCard lang={lang} onReady={onReady} />
        </div>
      </section>
    </div>
  )
}
