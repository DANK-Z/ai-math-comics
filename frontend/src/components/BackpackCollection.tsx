import { useState } from 'react'
import type { Lang } from '../api'
import { bonusPuzzle, BONUS_STICKER_IDS, type BonusSticker } from '../bonusPuzzles'
import type { UiStrings } from '../i18n'
import { GUIDE_COPY } from '../guideCopy'
import { comicHref } from '../route'
import { FairShop } from './FairShop'
import { SCHOOL_FAIR_CHAPTER_COUNT, SCHOOL_FAIR_STOPS, type SchoolFairCollectible } from '../schoolFair'

const ICONS = {
  'pizza-token': '🍕',
  'yellow-backpack': '🎒',
  'clue-envelope': '✉️',
  'prize-book': '📘',
  'lemonade-recipe': '📝',
} satisfies Record<Exclude<SchoolFairCollectible, 'festival-garland'>, string>

export function CollectibleIcon({ item, silhouette = false }: { item: SchoolFairCollectible; silhouette?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg border-2 text-lg leading-none ${
      silhouette ? 'border-dashed border-ink/40 bg-white *:opacity-25 *:brightness-0' : 'border-ink/70 bg-sun/25'
    }`}>
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

const TABS = { ru: { collection: 'Коллекция', shop: 'Магазин ярмарки' }, kk: { collection: 'Коллекция', shop: 'Жәрмеңке дүкені' } }
const TAB =
  'min-h-11 rounded-xl border-[3px] border-ink px-4 font-black text-ink shadow-[0_3px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand aria-selected:translate-y-[2px] aria-selected:bg-sun aria-selected:shadow-[0_1px_0_var(--color-ink)]'

export function BackpackCollection({ t, lang, completedChapters, bonusStickers }: {
  t: UiStrings
  lang: Lang
  completedChapters: ReadonlySet<string>
  bonusStickers: ReadonlySet<BonusSticker>
}) {
  const earned = SCHOOL_FAIR_STOPS.filter(({ comicId }) => completedChapters.has(comicId))
  const [tab, setTab] = useState<'collection' | 'shop'>('collection')

  return (
    <section aria-labelledby="backpack-title" className="rounded-2xl border-2 border-ink bg-cream p-3 shadow-[0_4px_0_var(--color-ink)] sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 id="backpack-title" className="text-2xl font-black text-ink sm:text-3xl">{t.backpack.title}</h1>
        <p className="text-sm font-bold text-brand-dark">{t.backpack.progress(earned.length, SCHOOL_FAIR_CHAPTER_COUNT)}</p>
      </div>
      <div role="tablist" aria-label={t.backpack.title} className="mt-3 mb-3 flex flex-wrap gap-2">
        {(['collection', 'shop'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`backpack-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`backpack-panel-${name}`}
            onClick={() => setTab(name)}
            className={`${TAB} ${tab === name ? '' : 'bg-white hover:bg-sky'}`}
          >
            {name === 'shop' && <span aria-hidden>🏬 </span>}
            {TABS[lang][name]}
            {tab === name && <span aria-hidden> ✓</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="backpack-panel-shop" aria-labelledby="backpack-tab-shop" hidden={tab !== 'shop'}>
        {tab === 'shop' && <FairShop lang={lang} />}
      </div>
      <div role="tabpanel" id="backpack-panel-collection" aria-labelledby="backpack-tab-collection" hidden={tab !== 'collection'}>
      {earned.length === 0 && <p className="mt-1 text-sm font-semibold">{t.backpack.empty}</p>}
      {/* Items still to find stay as silhouettes that say which chapter gives them. */}
      <ul role="list" className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {SCHOOL_FAIR_STOPS.map(({ comicId, number, location, collectible }) => {
          if (completedChapters.has(comicId)) {
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
          }
          const g = GUIDE_COPY[lang].backpack
          return (
            <li key={collectible}>
              <a href={comicHref(comicId)} className="flex h-full items-start gap-2 rounded-xl border-2 border-dashed border-ink/35 bg-white/50 p-2 text-ink hover:border-brand hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <CollectibleIcon item={collectible} silhouette />
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-black text-ink/70">{g.secret}</span>
                  <span className="mt-0.5 block text-sm leading-snug font-semibold text-ink/75">{g.where(number, t.fairRoute.locations[location])}</span>
                  <span className="mt-0.5 block text-xs font-black text-brand-dark">{g.open} <span aria-hidden>→</span></span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <section aria-labelledby="backpack-bonus-title" className="mt-3 border-t-2 border-ink/20 pt-2">
        <h2 id="backpack-bonus-title" className="font-black">{t.priceTagBonus.stickerSection}</h2>
        {bonusStickers.size ? (
          <ul role="list" className="mt-1 flex flex-wrap gap-2">
            {BONUS_STICKER_IDS.filter((id) => bonusStickers.has(id)).map((id) => {
              const { icon, copy } = bonusPuzzle(id, lang, t)
              return <li key={id} className="inline-flex items-center gap-2 rounded-xl border-2 border-ink/70 bg-sun/25 px-2 py-1 text-sm font-bold">
                <span aria-hidden="true">{icon}</span><span>{copy.sticker}</span>
              </li>
            })}
          </ul>
        ) : (
          <p className="mt-1 text-sm font-semibold">{t.priceTagBonus.empty}</p>
        )}
      </section>
      </div>
    </section>
  )
}
