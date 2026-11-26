import type { CSSProperties } from 'react'
import type { Lang } from '../api'
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
import { comicHref, DEMO_COMIC_ID } from '../route'
import { schoolFairChapter } from '../schoolFair'
import { BattleAlert, LessonAlert } from './BoardAlerts'
import { WeakSpotCard } from './PracticeScreen'
import { DailyCard } from './StudentDaily'
import { HomeHero } from './HomeHero'
import { PraiseInbox } from './ParentScreen'

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
      className="group flex flex-col rounded-2xl border-[3px] border-ink/10 bg-white p-3 shadow-[0_10px_30px_rgb(36_57_159/0.15)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun sm:p-4"
    >
      <div
        style={vars}
        className="relative aspect-(--ar-phone) overflow-hidden rounded-xl border-[5px] border-ink bg-sky-100 transition group-hover:-translate-y-0.5 sm:aspect-(--ar-wide)"
      >
        <img src={entry.cover} alt="" className="h-full w-full object-cover object-(--focus-phone) sm:object-(--focus-wide)" />
        <p className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          <span className="rounded-lg border-[3px] border-ink bg-sun px-2.5 py-0.5 text-sm font-black text-ink shadow-[0_2px_0_var(--shadow-ink)]">
            {t.catalogTopics[entry.topic]}
          </span>
          {entry.grade !== undefined && (
            <span className="rounded-lg border-[3px] border-ink bg-white px-2.5 py-0.5 text-sm font-black text-ink shadow-[0_2px_0_var(--shadow-ink)]">
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
              <span className="rounded-lg border-2 border-emerald-700 bg-emerald-100 px-2 text-emerald-900">
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
      <span className="flex min-h-12 items-center justify-center rounded-xl border-[3px] border-ink bg-sun text-lg font-black text-ink shadow-[0_4px_0_var(--shadow-ink)] transition group-active:translate-y-[3px] group-active:shadow-[0_1px_0_var(--shadow-ink)]">
        {t.readComic} <span className="ml-2" aria-hidden>→</span>
      </span>
    </a>
  )
}

export function HomeScreen({ lang, progress, finalesWon }: {
  lang: Lang
  progress: ReadonlySet<string>
  finalesWon: ReadonlySet<string>
}) {
  return (
    <div className="flex flex-col gap-5">
      <LessonAlert lang={lang} />
      <BattleAlert lang={lang} />
      <PraiseInbox lang={lang} />
      <HomeHero lang={lang} progress={progress} finalesWon={finalesWon} />
      <DailyCard lang={lang} />
      <WeakSpotCard lang={lang} />
    </div>
  )
}

export function CatalogScreen({ lang, completedChapters }: { lang: Lang; completedChapters: ReadonlySet<string> }) {
  const t = STRINGS[lang]
  return (
    <section aria-labelledby="catalog-title">
      <h1 id="catalog-title" className="mb-4 text-2xl font-black text-ink sm:text-3xl">{t.catalogTitle}</h1>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {CATALOG.map((entry) => (
          <CatalogCard key={entry.id} entry={entry} lang={lang} t={t} completed={completedChapters.has(entry.id)} />
        ))}
      </div>
    </section>
  )
}
