import { useEffect, useState } from 'react'
import { accounts, isAbortError, type CardKind, type Challenge, type ChallengeKind, type Lang, type PraiseCard } from '../api'
import { ACCOUNT_COPY } from '../accountCopy'
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
  streak: { icon: '🔥', text: t('Редкая рамка «Огненная серия» — за 5 дней занятий подряд! Надень её в рюкзаке.', '«Отты серия» сирек жиегі — қатарынан 5 күн айналысқаның үшін! Оны рюкзакта киіп ал.') },
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


// ---- challenges from parents (the student's side) ----------------------------------------

export const topicName = (lang: Lang, topic?: string | null) => (topic ? (ACCOUNT_COPY[lang].topics as Record<string, string>)[topic] ?? topic : null)

/** «Пройти 3 главы» and the like, for a challenge's goal. */
export const GOAL_TEXT: Record<Lang, (kind: ChallengeKind, target: number, topic: string | null) => string> = {
  ru: (kind, target, topic) =>
      kind === 'boss_clean' ? `Победить босса${topic ? ` по теме «${topic}»` : ''} на 3 звезды без ошибок${target > 1 ? ` — ${target} раза` : ''}`
        : kind === 'chapters' ? `Пройти ${target} ${target === 1 ? 'главу' : target < 5 ? 'главы' : 'глав'}`
        : kind === 'drills' ? `Пройти ${target} ${target === 1 ? 'тренировку' : target < 5 ? 'тренировки' : 'тренировок'}`
        : `Решать задачу дня ${target} дней подряд`,
  kk: (kind, target, topic) =>
      kind === 'boss_clean' ? `Боссты${topic ? ` «${topic}» тақырыбы бойынша` : ''} қатесіз 3 жұлдызға жеңу${target > 1 ? ` — ${target} рет` : ''}`
        : kind === 'chapters' ? `${target} тарау өту`
        : kind === 'drills' ? `${target} жаттығу өту`
        : `Күн есебін қатарынан ${target} күн шешу`,
}

const CHALLENGE_COPY = {
  ru: { title: 'Челленджи от родителей', progress: (p: number, t: number) => `${p} из ${t}`, done: 'Выполнено! Награда ждёт 🎁', given: 'Награда получена ✓' },
  kk: { title: 'Ата-анадан челлендждер', progress: (p: number, t: number) => `${t}-ден ${p}`, done: 'Орындалды! Сыйлық күтіп тұр 🎁', given: 'Сыйлық алынды ✓' },
}

/** Student's home: the challenges the parents set, with progress. */
export function MyChallengesCard({ lang }: { lang: Lang }) {
  const s = CHALLENGE_COPY[lang]
  const student = useAccount().user?.role === 'student'
  const [items, setItems] = useState<Challenge[]>([])
  useEffect(() => {
    if (!student) return
    const ctrl = new AbortController()
    accounts.myChallenges(ctrl.signal).then(setItems, (err) => { if (!isAbortError(err)) setItems([]) })
    return () => ctrl.abort()
  }, [student])
  if (!student || !items.length) return null
  return (
    <section className="rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#fff4d1,#e9ffe9)] p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4">
      <h2 className="flex items-center gap-2 text-lg font-black text-ink"><span aria-hidden>🎯</span>{s.title}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border-2 border-ink/25 bg-white/70 p-2.5">
            <p className="text-sm font-black text-ink">{GOAL_TEXT[lang](item.kind, item.target, topicName(lang, item.topic))}</p>
            <p className="text-sm font-bold text-ink/80">🎁 {item.reward} <span className="text-xs font-semibold text-ink/55">· {item.fromName}</span></p>
            {item.done ? (
              <p className="mt-1 text-sm font-black text-emerald-800">{item.rewardedAt ? s.given : s.done}</p>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                  <span className="block h-full bg-[#16a36a]" style={{ width: `${Math.min(100, (item.progress / item.target) * 100)}%` }} />
                </span>
                <span className="text-xs font-black text-ink tabular-nums">{s.progress(Math.min(item.progress, item.target), item.target)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
