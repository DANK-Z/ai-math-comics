import { useEffect, useState } from 'react'
import { accounts, type CardKind, type Lang, type PraiseCard } from '../api'
import { useAccount } from '../account'
import { CARD, PRIMARY } from './AuthScreen'

// The student's side of the parent's area: the family code in the profile and the praise cards
// on the home page. Kept apart from the parent's screen so the home page does not load it.

const t = (ru: string, kk: string) => ({ ru, kk })

export const PRAISE: Record<CardKind, { icon: string; text: Record<Lang, string> }> = {
  proud: { icon: '🎉', text: t('Горжусь тобой!', 'Сенімен мақтанамын!') },
  'keep-going': { icon: '💪', text: t('Ты молодец, продолжай!', 'Жарайсың, жалғастыр!') },
  star: { icon: '⭐', text: t('Ты моя звёздочка!', 'Сен менің жұлдызымсың!') },
  gift: { icon: '🎁', text: t('Подарок для магазина ярмарки', 'Жәрмеңке дүкеніне сыйлық') },
  coins: { icon: '🪙', text: t('Монеты для магазина ярмарки — трать с умом!', 'Жәрмеңке дүкеніне тиындар — ақылмен жұмса!') },
}

const STUDENT = {
  ru: { title: 'Семейный код', lead: 'Дай этот код маме или папе: в кабинете родителя они увидят твои успехи и смогут прислать открытку.', parents: (n: number) => `Подключено родителей: ${n}`, inbox: 'Открытка от родных', thanks: 'Спасибо!', coins: (n: number) => `+${n} монет в рюкзак` },
  kk: { title: 'Отбасылық код', lead: 'Бұл кодты анаң немесе әкеңе бер: ата-ана кабинетінде олар жетістіктеріңді көріп, ашықхат жібере алады.', parents: (n: number) => `Қосылған ата-ана: ${n}`, inbox: 'Туыстардан ашықхат', thanks: 'Рахмет!', coins: (n: number) => `Рюкзакқа +${n} тиын` },
}

/** Profile: the student's family code for a parent. */
export function FamilyCodeCard({ lang }: { lang: Lang }) {
  const c = STUDENT[lang]
  const [data, setData] = useState<{ code: string; parents: number } | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    accounts.familyCode(ctrl.signal).then(setData, () => {})
    return () => ctrl.abort()
  }, [])
  if (!data) return null
  return (
    <section className={CARD}>
      <h2 className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>👨‍👩‍👧</span>{c.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{c.lead}</p>
      <p className="mt-3 w-fit rounded-xl border-[3px] border-ink bg-sun px-4 py-2 font-mono text-2xl font-black tracking-wider text-ink select-all">{data.code}</p>
      <p className="mt-2 text-sm font-bold text-ink/70">{c.parents(data.parents)}</p>
    </section>
  )
}

/** Home: unseen praise cards from the student's parents. */
export function PraiseInbox({ lang }: { lang: Lang }) {
  const c = STUDENT[lang]
  const student = useAccount().user?.role === 'student'
  const { refresh } = useAccount()
  const [cards, setCards] = useState<PraiseCard[]>([])
  useEffect(() => {
    if (!student) return
    const ctrl = new AbortController()
    accounts.myPraise(ctrl.signal).then(setCards, () => {})
    return () => ctrl.abort()
  }, [student])
  if (!student || cards.length === 0) return null
  return (
    <section aria-live="polite" className="secret-pop rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#ffe4ec,#fff4d1)] p-4 shadow-[0_4px_0_var(--shadow-ink)]">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>💌</span>{c.inbox}</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {cards.map((card) => (
          <li key={card.id} className="text-lg font-black text-ink">
            {PRAISE[card.kind].icon} {card.fromName}: «{PRAISE[card.kind].text[lang]}»
            {card.coins > 0 && <span className="ml-2 rounded-lg border-2 border-amber-700 bg-sun px-2 py-0.5 text-sm">🪙 {c.coins(card.coins)}</span>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={async () => { await accounts.praiseSeen(); setCards([]); refresh().catch(() => {}) }} className={`${PRIMARY} mt-3`}>
        ❤️ {c.thanks}
      </button>
    </section>
  )
}
