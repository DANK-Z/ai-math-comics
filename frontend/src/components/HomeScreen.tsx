import type { ComicJobRequest, Lang } from '../api'
import { STRINGS } from '../i18n'
import { comicHref, DEMO_COMIC_ID } from '../route'
import { CastCard } from './CastCard'
import { GenerateCard } from './GenerateCard'
import { PanelArt } from './PanelArt'

function DemoCard({ lang }: { lang: Lang }) {
  const t = STRINGS[lang]
  return (
    <section
      aria-labelledby="demo-title"
      className="rounded-[28px] border-[3px] border-ink/10 bg-white p-3 shadow-[0_10px_30px_rgb(36_57_159/0.15)] sm:p-4"
    >
      <a
        href={comicHref(DEMO_COMIC_ID)}
        className="group block rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sun"
      >
        <div className="overflow-hidden rounded-2xl border-[5px] border-ink transition group-hover:-translate-y-0.5">
          <PanelArt imageKey="pizza-03" lang={lang} speaker="Алдияр" text={t.demoTeaser} />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink uppercase">{t.demoBadge}</span>
              <span className="text-xs font-extrabold text-ink/70">
                {t.gradeOption(5)} · {t.topics.fractions}
              </span>
            </p>
            <h2 id="demo-title" className="mt-1 text-xl font-black text-ink">
              {t.demoTitle}
            </h2>
            <p className="text-sm font-semibold text-ink/75">{t.demoLead}</p>
          </div>
        </div>
        <span className="mt-3 flex min-h-11 items-center justify-center rounded-2xl border-[3px] border-ink bg-white font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition group-active:translate-y-[3px] group-active:shadow-[0_1px_0_var(--color-ink)]">
          📖 {t.readComic} →
        </span>
      </a>
    </section>
  )
}

export function HomeScreen({ lang, onReady }: { lang: Lang; onReady: (comicId: string, request: ComicJobRequest) => void }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:gap-7">
      <GenerateCard lang={lang} onReady={onReady} />
      <div className="flex flex-col gap-5">
        <DemoCard lang={lang} />
        <CastCard lang={lang} activeSpeaker="" compact />
      </div>
    </div>
  )
}
