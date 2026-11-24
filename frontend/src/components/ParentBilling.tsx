import { useState } from 'react'
import { accounts, type Billing, type ChildSummary, type CoinPack, type Lang } from '../api'
import { dayMonth } from '../dates'
import { errorKey } from './AuthScreen'

// The parent's purchases: the «Семья» plan and coin packs for a child. No payment provider is
// connected yet, so the server runs in test mode: a purchase works at once and no money moves.
// The screen says so plainly next to every button.

const COPY = {
  ru: {
    plan: 'Подписка «Семья»',
    planLead: 'Больше поддержки для ребёнка каждую неделю.',
    perks: ['Еженедельный подарок — 50 монет вместо 20', 'В 3 раза больше своих комиксов в день', 'Сводка Пифика и открытки — как и раньше'],
    price: (n: number) => `${n.toLocaleString('ru-RU')} ₸ / месяц`,
    active: (date: string) => `Подписка активна до ${date}`,
    buyPlan: 'Оформить',
    extend: 'Продлить на месяц',
    free: 'Бесплатно: сводка, открытки и подарок 20 монет раз в неделю.',
    coins: 'Купить монеты',
    coinsLead: 'Монеты придут ребёнку открыткой на главную. На них покупают наряды Пифика, рамки и звания.',
    pack: (coins: number, price: number) => `🪙 ${coins} — ${price.toLocaleString('ru-RU')} ₸`,
    paidCoins: (n: number) => `Готово: ${n} монет отправлены.`,
    paidPlan: 'Подписка оформлена.',
    test: 'Тестовый режим: оплата пока не подключена, деньги не списываются.',
    history: 'История покупок',
    errors: { payments_limit: 'На сегодня хватит покупок — попробуйте завтра.', payments_off: 'Покупки сейчас выключены.', network: 'Не получилось. Попробуйте ещё раз.' } as Record<string, string>,
  },
  kk: {
    plan: '«Отбасы» жазылымы',
    planLead: 'Балаға әр апта сайын көбірек қолдау.',
    perks: ['Апталық сыйлық — 20 емес, 50 тиын', 'Күніне 3 есе көп өз комикстері', 'Пификтің шолуы мен ашықхаттар — бұрынғыдай'],
    price: (n: number) => `${n.toLocaleString('ru-RU')} ₸ / ай`,
    active: (date: string) => `Жазылым ${date} дейін белсенді`,
    buyPlan: 'Рәсімдеу',
    extend: 'Бір айға ұзарту',
    free: 'Тегін: шолу, ашықхаттар және аптасына бір рет 20 тиын сыйлық.',
    coins: 'Тиын сатып алу',
    coinsLead: 'Тиындар балаға басты бетке ашықхат болып келеді. Олармен Пификтің киімін, жиектер мен атақтарды алады.',
    pack: (coins: number, price: number) => `🪙 ${coins} — ${price.toLocaleString('ru-RU')} ₸`,
    paidCoins: (n: number) => `Дайын: ${n} тиын жіберілді.`,
    paidPlan: 'Жазылым рәсімделді.',
    test: 'Сынақ режимі: төлем әлі қосылмаған, ақша алынбайды.',
    history: 'Сатып алу тарихы',
    errors: { payments_limit: 'Бүгінге жетер — ертең көріңіз.', payments_off: 'Сатып алу қазір өшірулі.', network: 'Болмады. Қайталап көріңіз.' } as Record<string, string>,
  },
}

const CARD = 'rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-5'
const BUY = 'min-h-12 rounded-xl border-[3px] border-ink bg-sun px-4 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--shadow-ink)] disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

function TestNote({ lang }: { lang: Lang }) {
  return <p className="mt-2 rounded-lg bg-sky px-2 py-1 text-xs font-bold text-ink/80">🧪 {COPY[lang].test}</p>
}

/** Coin packs for one child (inside the child's card). */
export function CoinPacks({ child, lang, billing, onChange, onPaid }: {
  child: ChildSummary
  lang: Lang
  billing: Billing
  onChange: (c: ChildSummary) => void
  onPaid: () => void
}) {
  const c = COPY[lang]
  const [busy, setBusy] = useState<CoinPack | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  async function buy(pack: CoinPack, coins: number) {
    setBusy(pack)
    setStatus(null)
    try {
      onChange(await accounts.buyCoins(child.id, pack))
      setStatus({ ok: true, text: c.paidCoins(coins) })
      onPaid()
    } catch (e) {
      setStatus({ ok: false, text: c.errors[errorKey(e)] ?? c.errors.network })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={CARD}>
      <h3 className="text-xl font-black text-ink">🪙 {c.coins}</h3>
      <p className="mt-1 text-sm font-semibold text-ink/75">{c.coinsLead}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {billing.packs.map((pack) => (
          <button key={pack.id} type="button" disabled={busy !== null} onClick={() => buy(pack.id, pack.coins)} className={BUY}>
            {c.pack(pack.coins, pack.price)}
          </button>
        ))}
      </div>
      {status && <p role="status" className={`mt-2 font-bold ${status.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{status.ok ? '✓ ' : ''}{status.text}</p>}
      {billing.mode === 'test' && <TestNote lang={lang} />}
    </section>
  )
}

/** The «Семья» plan: what it gives, its price and its end date. */
export function FamilyPlanCard({ lang, billing, onChange, onPlan }: {
  lang: Lang
  billing: Billing
  onChange: (b: Billing) => void
  onPlan: () => void
}) {
  const c = COPY[lang]
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const plan = billing.plans[0]
  if (!plan) return null

  async function buy() {
    setBusy(true)
    setStatus(null)
    try {
      onChange(await accounts.buyPlan('family'))
      setStatus({ ok: true, text: c.paidPlan })
      onPlan() // the weekly gift grows to 50 coins
    } catch (e) {
      setStatus({ ok: false, text: c.errors[errorKey(e)] ?? c.errors.network })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={c.plan} className="rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#fff6d6,#ffe08a)] p-4 text-ink shadow-[0_4px_0_var(--shadow-ink)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black">⭐ {c.plan}</h2>
          <p className="font-semibold text-ink/80">{c.planLead}</p>
        </div>
        <p className="rounded-xl border-[3px] border-ink bg-white px-3 py-1 text-lg font-black">{c.price(plan.price)}</p>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {c.perks.map((perk) => <li key={perk} className="font-bold">✓ {perk}</li>)}
      </ul>
      {billing.plan && billing.paidUntil && (
        <p className="mt-3 w-fit rounded-lg border-2 border-emerald-700 bg-emerald-100 px-2 py-0.5 font-black text-emerald-900">{c.active(dayMonth(new Date(billing.paidUntil), lang))}</p>
      )}
      <button type="button" disabled={busy} onClick={buy} className={`${BUY} mt-3 bg-white`}>{billing.plan ? c.extend : c.buyPlan}</button>
      {status && <p role="status" className={`mt-2 font-bold ${status.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{status.ok ? '✓ ' : ''}{status.text}</p>}
      <p className="mt-2 text-sm font-semibold text-ink/70">{c.free}</p>
      {billing.mode === 'test' && <TestNote lang={lang} />}
      {billing.history.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-black">{c.history}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold">
            {billing.history.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>{p.product === 'family' ? c.plan : `🪙 ${p.coins}`}</span>
                <span>{p.amount.toLocaleString('ru-RU')} ₸ · {dayMonth(new Date(p.at), lang)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
