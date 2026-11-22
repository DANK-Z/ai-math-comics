import type { UiStrings } from '../i18n'
import { comicHref, GUARDIAN_HREF } from '../route'
import { SCHOOL_FAIR_CHAPTER_COUNT, SCHOOL_FAIR_STOPS } from '../schoolFair'
import { PifikSprite } from './PifikSprite'

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
}

// One radius (16px, rounded-2xl) for every card on the route; small inner art uses 8px.
const CARD = 'flex min-h-16 items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-ink shadow-[0_2px_0_var(--color-ink)] transition hover:border-brand hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-4 sm:px-4'
const MARKER = 'fair-route-marker grid size-8 place-items-center rounded-full border-[3px] border-ink text-sm font-black sm:size-9'

/**
 * The season as one top-to-bottom path in reading order (1 → 6), joined by a dashed
 * line, with the final challenge as the last, full-width step.
 */
export function SchoolFairRoute({ t, covers, completedChapters, remaining, guardianWon }: Props) {
  const suggested = SCHOOL_FAIR_STOPS.find(({ comicId }) => !completedChapters.has(comicId))
  const unlocked = remaining === 0
  const guardianStatus = remaining > 0
    ? t.guardian.remaining(remaining)
    : guardianWon ? t.guardian.wonBadge : t.fairRoute.guardianUnlocked

  return (
    <section aria-labelledby="fair-route-title" className="max-w-3xl rounded-2xl border-[3px] border-ink bg-cream p-3 shadow-[0_5px_0_var(--color-ink)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="fair-route-title" className="text-lg font-extrabold text-brand-dark sm:text-xl">{t.fairRoute.title}</h2>
        <p className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold text-ink">
          {t.seasonProgress(completedChapters.size, SCHOOL_FAIR_CHAPTER_COUNT)}
        </p>
      </div>

      <ol className="fair-route-path list-none" role="list">
        {SCHOOL_FAIR_STOPS.map(({ comicId, number, location }) => {
          const art = covers.get(comicId)
          const solved = completedChapters.has(comicId)
          const next = comicId === suggested?.comicId
          return (
            <li key={comicId}>
              <span aria-hidden="true" className={`${MARKER} ${solved ? 'bg-emerald-300' : next ? 'bg-sun' : 'bg-white'}`}>
                {solved ? '✓' : number}
              </span>
              <a
                href={comicHref(comicId)}
                aria-current={next ? 'step' : undefined}
                className={`${CARD} ${next ? 'border-brand-dark bg-[#fff2bd]' : 'border-ink/60 bg-white'}`}
              >
                {art && (
                  <img
                    src={art.src}
                    alt=""
                    style={{ objectPosition: art.focus }}
                    className="aspect-video w-16 shrink-0 rounded-lg border border-ink/30 object-cover sm:w-24"
                  />
                )}
                <span className="min-w-0 flex-1">
                  {/* Chapter label and status share one line, so every stop is two lines tall. */}
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-tight font-bold">
                    <span className="tracking-wide text-ink/75 uppercase">{t.chapterLabel(number)}</span>
                    {solved && (
                      <span className="text-xs text-emerald-800 sm:text-sm"><span aria-hidden="true">✓ </span>{t.chapterCompleted}</span>
                    )}
                    {next && (
                      <span className="rounded-full bg-brand-dark px-2 py-0.5 text-xs text-white sm:px-2.5 sm:text-sm">
                        <span aria-hidden="true">→ </span>{t.fairRoute.suggested}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[15px] leading-snug font-bold sm:text-lg">{t.fairRoute.locations[location]}</span>
                </span>
              </a>
            </li>
          )
        })}

        {/* The finale: same card size, full width, highlighted once it opens. */}
        <li>
          <span aria-hidden="true" className={`${MARKER} ${unlocked ? 'bg-sun' : 'bg-white'}`}>
            {remaining > 0 ? '🔒' : guardianWon ? '✓' : '★'}
          </span>
          <a
            href={GUARDIAN_HREF}
            aria-labelledby="fair-route-guardian-title"
            aria-describedby="fair-route-guardian-status"
            className={`${CARD} min-h-20 border-[3px] ${unlocked ? 'border-ink bg-sun/40' : 'border-dashed border-ink/60 bg-white'}`}
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-ink/30 bg-sky p-1.5 sm:size-16">
              <PifikSprite eager className="w-full rounded-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span id="fair-route-guardian-title" className="block text-lg leading-snug font-black sm:text-xl">{t.guardian.title}</span>
              <span id="fair-route-guardian-status" className="mt-1 block text-sm leading-tight font-bold text-brand-dark">{guardianStatus}</span>
            </span>
          </a>
        </li>
      </ol>
    </section>
  )
}
