import { useId, useState } from 'react'
import { PORTRAITS } from '../art/sheet'
import type { UiStrings } from '../i18n'
import { comicHref, GUARDIAN_HREF } from '../route'
import { SCHOOL_FAIR_CHAPTER_COUNT, SCHOOL_FAIR_STOPS } from '../schoolFair'
import { BackpackCollection } from './BackpackCollection'
import { SheetCrop } from './SheetCrop'

interface StopArt {
  src: string
  focus: string
}

interface Props {
  t: UiStrings
  covers: ReadonlyMap<string, StopArt>
  completedChapters: ReadonlySet<string>
  remaining: number
  guardianWon: boolean
  hasPriceTagSticker: boolean
}

const LINK = 'flex min-h-14 items-center gap-2 rounded-xl border-2 p-2 text-ink shadow-[0_2px_0_var(--color-ink)] hover:border-brand hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-3'
const MARKER = 'grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black'

export function SchoolFairRoute({ t, covers, completedChapters, remaining, guardianWon, hasPriceTagSticker }: Props) {
  const [backpackOpen, setBackpackOpen] = useState(false)
  const backpackId = useId()
  const suggested = SCHOOL_FAIR_STOPS.find(({ comicId }) => !completedChapters.has(comicId))
  const guardianStatus = remaining > 0
    ? t.guardian.remaining(remaining)
    : guardianWon ? t.guardian.wonBadge : t.fairRoute.guardianUnlocked

  return (
    <section aria-labelledby="fair-route-title" className="rounded-[24px] border-[3px] border-ink bg-cream p-3 shadow-[0_5px_0_var(--color-ink)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 md:mb-4">
        <h2 id="fair-route-title" className="text-xl font-black sm:text-2xl">{t.fairRoute.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="rounded-full border-2 border-ink/70 bg-white px-2.5 py-0.5 text-sm font-extrabold">
            {t.seasonProgress(completedChapters.size, SCHOOL_FAIR_CHAPTER_COUNT)}
          </p>
          <button
            type="button"
            aria-expanded={backpackOpen}
            aria-controls={backpackId}
            onClick={() => setBackpackOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-ink bg-sun px-2.5 text-sm font-black text-ink hover:bg-[#fff2bd] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden="true">🎒</span>
            {t.backpack.title}
            <span aria-hidden="true">{backpackOpen ? '▴' : '▾'}</span>
          </button>
        </div>
      </div>

      <BackpackCollection
        t={t} id={backpackId} hidden={!backpackOpen}
        completedChapters={completedChapters} hasPriceTagSticker={hasPriceTagSticker}
      />

      <ol className="fair-route-stops list-none" role="list">
        {SCHOOL_FAIR_STOPS.map(({ comicId, number, location }) => {
          const art = covers.get(comicId)
          const solved = completedChapters.has(comicId)
          const next = comicId === suggested?.comicId
          return (
            <li key={comicId}>
              <a
                href={comicHref(comicId)}
                className={`${LINK} h-full ${next ? 'border-brand-dark bg-[#fff2bd]' : 'border-ink/70 bg-white'}`}
              >
                <span className={`${MARKER} ${next ? 'bg-sun' : 'bg-sky'}`}>{number}</span>
                {art && (
                  <img
                    src={art.src}
                    alt=""
                    style={{ objectPosition: art.focus }}
                    className="aspect-video w-16 shrink-0 rounded-md border border-ink/40 object-cover sm:w-24"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight font-black sm:text-base">{t.fairRoute.locations[location]}</span>
                  {solved && (
                    <span className="mt-0.5 block text-xs leading-tight font-bold text-emerald-800">
                      <span aria-hidden="true">✓ </span>{t.chapterCompleted}
                    </span>
                  )}
                  {next && (
                    <span className="mt-0.5 block text-xs leading-tight font-bold text-brand-dark">
                      <span aria-hidden="true">→ </span>{t.fairRoute.suggested}
                    </span>
                  )}
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <div className="fair-route-finale mt-2 md:mt-3">
        <a
          href={GUARDIAN_HREF}
          aria-labelledby="fair-route-guardian-title"
          aria-describedby="fair-route-guardian-status"
          className={`${LINK} border-ink/70 ${remaining === 0 ? 'bg-sun/30' : 'bg-white'}`}
        >
          <span className={`${MARKER} bg-sky`} aria-hidden="true">{remaining > 0 ? '🔒' : guardianWon ? '✓' : '★'}</span>
          <SheetCrop rect={PORTRAITS.pifikFace} eager className="w-8 shrink-0 rounded-md border border-ink/40 bg-sky sm:w-10" />
          <span className="min-w-0 flex-1">
            <span id="fair-route-guardian-title" className="block text-sm leading-tight font-black sm:text-base">{t.guardian.title}</span>
            <span id="fair-route-guardian-status" className="mt-0.5 block text-xs leading-tight font-bold text-brand-dark">{guardianStatus}</span>
          </span>
        </a>
      </div>
    </section>
  )
}
