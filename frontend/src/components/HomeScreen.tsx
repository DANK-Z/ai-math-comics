import { useId, useState, type CSSProperties } from 'react'
import type { ComicJobRequest, Lang } from '../api'
import { SCHOOL_STORE_TITLES } from '../api/schoolStore'
import pizzaCover from '../assets/pizza/cover.png'
import storeCover from '../assets/school-store/cover.png'
import { STRINGS, type UiStrings } from '../i18n'
import { comicHref, DEMO_COMIC_ID, SCHOOL_STORE_COMIC_ID } from '../route'
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
  hook: (t: UiStrings) => string
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
    hook: (t) => t.pizzaHook,
    topic: 'fractions',
  },
  {
    id: SCHOOL_STORE_COMIC_ID,
    cover: storeCover,
    // Aldiyar at ~28%, Aruna ~55%, the backpack ~70–88%, Pifik top right.
    framing: { phone: { aspect: '4 / 3', focus: '82% 45%' }, wide: { aspect: '8 / 5', focus: '92% 45%' } },
    title: (lang) => SCHOOL_STORE_TITLES[lang],
    hook: (t) => t.schoolStoreHook,
    topic: 'percentages',
  },
]

function CatalogCard({ entry, lang, t }: { entry: CatalogEntry; lang: Lang; t: UiStrings }) {
  const titleId = `${entry.id}-title`
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
        <h3 id={titleId} className="text-xl font-black text-ink">
          {entry.title(lang, t)}
        </h3>
        <p className="mt-0.5 font-bold text-ink/80">{entry.hook(t)}</p>
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

export function HomeScreen({ lang, onReady }: { lang: Lang; onReady: (comicId: string, request: ComicJobRequest) => void }) {
  const t = STRINGS[lang]
  // Open by default only when a generation job is in progress, so it can resume.
  const [createOpen, setCreateOpen] = useState(hasActiveJob)
  const panelId = useId()

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section aria-labelledby="catalog-title">
        <div className="mb-4">
          <h1 id="catalog-title" className="text-2xl font-black text-ink sm:text-3xl">
            {t.catalogTitle}
          </h1>
          <p className="mt-1 text-base font-bold text-brand-dark sm:text-lg">{t.catalogLead}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {CATALOG.map((entry) => (
            <CatalogCard key={entry.id} entry={entry} lang={lang} t={t} />
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
