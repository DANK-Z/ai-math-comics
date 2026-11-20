import type { UiStrings } from '../i18n'
import { SCHOOL_FAIR_CHAPTER_COUNT, SCHOOL_FAIR_STOPS, type SchoolFairCollectible } from '../schoolFair'

const ICONS = {
  'pizza-token': '🍕',
  'yellow-backpack': '🎒',
  'clue-envelope': '✉️',
  'prize-book': '📘',
  'lemonade-recipe': '📝',
} satisfies Record<Exclude<SchoolFairCollectible, 'festival-garland'>, string>

export function CollectibleIcon({ item }: { item: SchoolFairCollectible }) {
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink/70 bg-sun/25 text-lg leading-none">
      {item === 'festival-garland' ? (
        <span className="flex gap-px border-t-2 border-ink pt-px *:h-2.5 *:w-1.5 *:[clip-path:polygon(0_0,100%_0,50%_100%)]">
          <span className="bg-rose-600" /><span className="bg-brand" /><span className="bg-emerald-700" />
        </span>
      ) : (
        <span className={item === 'yellow-backpack' ? 'grayscale sepia saturate-[5]' : undefined}>{ICONS[item]}</span>
      )}
    </span>
  )
}

export function BackpackCollection({ t, completedChapters, id, hidden }: {
  t: UiStrings
  completedChapters: ReadonlySet<string>
  id: string
  hidden: boolean
}) {
  const earned = SCHOOL_FAIR_STOPS.filter(({ comicId }) => completedChapters.has(comicId))

  return (
    <section id={id} hidden={hidden} aria-labelledby={`${id}-title`} className="mb-3 rounded-2xl border-2 border-ink/70 bg-sky p-3 md:mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-title`} className="font-black text-ink">{t.backpack.title}</h3>
        <p className="text-sm font-bold text-brand-dark">{t.backpack.progress(earned.length, SCHOOL_FAIR_CHAPTER_COUNT)}</p>
      </div>
      {earned.length > 0 ? (
        <ul role="list" className="mt-2 grid gap-2 md:grid-cols-3">
          {earned.map(({ collectible }) => {
            const { name, story } = t.backpack.items[collectible]
            return (
              <li key={collectible} className="flex items-start gap-2 rounded-xl border-2 border-ink/30 bg-white p-2">
                <CollectibleIcon item={collectible} />
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-black">{name}</p>
                  <p className="mt-0.5 text-sm leading-snug font-semibold text-ink/80">{story}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm font-semibold">{t.backpack.empty}</p>
      )}
    </section>
  )
}
