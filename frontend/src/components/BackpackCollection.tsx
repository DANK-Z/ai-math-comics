import { useState } from 'react'
import type { Lang } from '../api'
import { useAccount } from '../account'
import { PORTRAITS } from '../art/sheet'
import { bonusPuzzle, BONUS_STICKER_IDS, type BonusSticker } from '../bonusPuzzles'
import type { UiStrings } from '../i18n'
import { GUIDE_COPY } from '../guideCopy'
import { OPERATION_FINDS, readFindsLog, TROPHIES, type FindId } from '../rewards'
import { comicHref } from '../route'
import { FairShop, PifikWardrobe, skinName } from './FairShop'
import { ItemLore } from './ItemLore'
import { PifikSprite } from './PifikSprite'
import { SCHOOL_FAIR_STOPS, type SchoolFairCollectible } from '../schoolFair'

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

/** A small yellow flag (the 🚩 emoji is red and cannot be recoloured reliably). */
export function YellowFlag({ className = 'size-[1.1em]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block align-[-0.15em] ${className}`}>
      <path d="M5 2.5 V22" stroke="#1d2766" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 3.5 L20 8.5 L6 13.5 Z" fill="#f8cd45" stroke="#1d2766" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function EmojiIcon({ icon, silhouette = false, size = 'size-9 text-lg' }: { icon: string; silhouette?: boolean; size?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg border-2 leading-none ${size} ${
      silhouette ? 'border-dashed border-ink/40 bg-white *:opacity-25 *:brightness-0' : 'border-ink/70 bg-sun/25'
    }`}>
      <span>{icon === '🚩' ? <YellowFlag /> : icon}</span>
    </span>
  )
}

const COPY = {
  ru: {
    tabs: { finds: 'Находки', pifik: 'Пифик', trophies: 'Трофеи', shop: 'Магазин ярмарки' },
    finds: (n: number, total: number) => `Находки: ${n} из ${total}`,
    look: 'Наряд Пифика',
    noSkin: 'Без наряда',
    recent: 'Последняя находка',
    fair: 'Школьная ярмарка',
    operations: 'Операции',
    reread: 'Перечитать главу',
    trophyEarned: 'Получено',
    trophyLocked: 'Как получить',
    toOperation: 'К операции',
  },
  kk: {
    tabs: { finds: 'Олжалар', pifik: 'Пифик', trophies: 'Жүлделер', shop: 'Жәрмеңке дүкені' },
    finds: (n: number, total: number) => `Олжалар: ${n} / ${total}`,
    look: 'Пификтің киімі',
    noSkin: 'Киімсіз',
    recent: 'Соңғы олжа',
    fair: 'Мектеп жәрмеңкесі',
    operations: 'Операциялар',
    reread: 'Тарауды қайта оқу',
    trophyEarned: 'Алынды',
    trophyLocked: 'Қалай алуға болады',
    toOperation: 'Операцияға',
  },
}

type Tab = 'finds' | 'pifik' | 'trophies' | 'shop'
const TAB_ICONS: Record<Tab, string> = { finds: '🧭', pifik: '🤖', trophies: '🏆', shop: '🏬' }
const TAB =
  'min-h-11 rounded-xl border-[3px] border-ink px-3 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand aria-selected:translate-y-[2px] aria-selected:bg-sun aria-selected:shadow-[0_1px_0_var(--shadow-ink)] sm:px-4'
const LINK = 'mt-1 inline-block text-xs font-black text-brand-dark underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

export function BackpackCollection({ t, lang, completedChapters, bonusStickers, operationChapters, finalesWon }: {
  t: UiStrings
  lang: Lang
  completedChapters: ReadonlySet<string>
  bonusStickers: ReadonlySet<BonusSticker>
  /** Solved chapters of the operations after the fair. */
  operationChapters: ReadonlySet<string>
  /** Won operation finales, by progress id (e.g. roads-finale). */
  finalesWon: ReadonlySet<string>
}) {
  const c = COPY[lang]
  const g = GUIDE_COPY[lang].backpack
  const account = useAccount()
  const [tab, setTab] = useState<Tab>('finds')

  const fairEarned = SCHOOL_FAIR_STOPS.filter(({ comicId }) => completedChapters.has(comicId))
  const opsEarned = OPERATION_FINDS.filter((find) => operationChapters.has(find.comicId))
  const earnedIds = new Set<FindId>([...fairEarned.map((s) => s.collectible), ...opsEarned.map((f) => f.id)])
  const totalFinds = SCHOOL_FAIR_STOPS.length + OPERATION_FINDS.length

  // The most recent find: from the unlock log, or else the last one in story order.
  const logged = readFindsLog().filter((e) => earnedIds.has(e.id)).sort((a, b) => b.at - a.at)[0]?.id
  const recentId: FindId | undefined = logged ?? opsEarned.at(-1)?.id ?? fairEarned.at(-1)?.collectible
  const recentOp = OPERATION_FINDS.find((f) => f.id === recentId)
  const recentFair = recentOp ? undefined : (recentId as SchoolFairCollectible | undefined)

  return (
    <section aria-labelledby="backpack-title" className="rounded-2xl border-2 border-ink bg-cream p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 id="backpack-title" className="text-2xl font-black text-ink sm:text-3xl">{t.backpack.title}</h1>
        <p className="text-sm font-bold text-brand-dark">{c.finds(earnedIds.size, totalFinds)}</p>
      </div>

      {/* Pifik's current look and the latest find. */}
      <div className="mt-3 grid gap-2 min-[480px]:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border-2 border-ink/40 bg-white p-2">
          <PifikSprite rect={PORTRAITS.pifik} eager className="aspect-square w-16 shrink-0 rounded-lg border-2 border-ink/40 bg-sky" />
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wide text-brand-dark uppercase">{c.look}</p>
            <p className="font-black leading-tight text-ink">{account.skin ? skinName(lang, account.skin) : c.noSkin}</p>
          </div>
        </div>
        {(recentOp || recentFair) && (
          <div className="flex items-center gap-3 rounded-xl border-2 border-ink/40 bg-white p-2">
            {recentOp ? <EmojiIcon icon={recentOp.icon} size="size-16 text-3xl" /> : <span className="grid size-16 place-items-center"><CollectibleIcon item={recentFair!} /></span>}
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-brand-dark uppercase">{c.recent}</p>
              <p className="font-black leading-tight text-ink">{recentOp ? recentOp.name[lang] : t.backpack.items[recentFair!].name}</p>
            </div>
          </div>
        )}
      </div>

      <div role="tablist" aria-label={t.backpack.title} className="mt-3 mb-3 flex flex-wrap gap-2">
        {(['finds', 'pifik', 'trophies', 'shop'] as const).map((name) => (
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
            <span aria-hidden>{TAB_ICONS[name]} </span>{c.tabs[name]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="backpack-panel-finds" aria-labelledby="backpack-tab-finds" hidden={tab !== 'finds'}>
        <h2 className="font-black text-ink">{c.fair}</h2>
        {fairEarned.length === 0 && <p className="mt-1 text-sm font-semibold">{t.backpack.empty}</p>}
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
                    <div className="mt-2"><ItemLore itemKey={`collectible-${collectible}`} name={name} lang={lang} /></div>
                  </div>
                </li>
              )
            }
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

        <h2 className="mt-4 font-black text-ink">{c.operations}</h2>
        <ul role="list" className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {OPERATION_FINDS.map((find) => {
            const earned = operationChapters.has(find.comicId)
            return (
              <li key={find.id} className={`flex items-start gap-2 rounded-xl border-2 p-2 ${earned ? 'border-ink/30 bg-white' : 'border-dashed border-ink/35 bg-white/50'}`}>
                <EmojiIcon icon={find.icon} silhouette={!earned} />
                <div className="min-w-0">
                  <p className={`text-sm leading-tight font-black ${earned ? '' : 'text-ink/70'}`}>{earned ? find.name[lang] : g.secret}</p>
                  <p className="mt-0.5 text-sm leading-snug font-semibold text-ink/80">{earned ? find.story[lang] : find.chapter[lang]}</p>
                  <a href={comicHref(find.comicId)} className={LINK}>{earned ? c.reread : g.open} <span aria-hidden>→</span></a>
                </div>
              </li>
            )
          })}
        </ul>

        <section aria-labelledby="backpack-bonus-title" className="mt-4 border-t-2 border-ink/20 pt-2">
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

      <div role="tabpanel" id="backpack-panel-pifik" aria-labelledby="backpack-tab-pifik" hidden={tab !== 'pifik'}>
        {tab === 'pifik' && <PifikWardrobe lang={lang} onOpenShop={() => setTab('shop')} />}
      </div>

      <div role="tabpanel" id="backpack-panel-trophies" aria-labelledby="backpack-tab-trophies" hidden={tab !== 'trophies'}>
        <ul role="list" className="grid gap-2 md:grid-cols-2">
          {TROPHIES.map((trophy) => {
            const earned = finalesWon.has(trophy.unlockedBy)
            return (
              <li key={trophy.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${earned ? 'border-ink/40 bg-sun/20' : 'border-dashed border-ink/35 bg-white/60'}`}>
                <EmojiIcon icon={trophy.icon} silhouette={!earned} size="size-14 text-3xl" />
                <div className="min-w-0">
                  <p className="font-black leading-tight text-ink">{trophy.name[lang]}</p>
                  <p className={`mt-1 inline-block rounded-md px-1.5 text-xs font-black ${earned ? 'bg-emerald-100 text-emerald-900' : 'bg-ink/10 text-ink/75'}`}>
                    {earned ? `✓ ${c.trophyEarned}` : `🔒 ${c.trophyLocked}`}
                  </p>
                  <p className="mt-1 text-sm leading-snug font-semibold text-ink/80">{earned ? trophy.earned[lang] : trophy.howTo[lang]}</p>
                  {!earned && <a href={trophy.href} className={LINK}>{c.toOperation} <span aria-hidden>→</span></a>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div role="tabpanel" id="backpack-panel-shop" aria-labelledby="backpack-tab-shop" hidden={tab !== 'shop'}>
        {tab === 'shop' && <FairShop lang={lang} />}
      </div>
    </section>
  )
}
