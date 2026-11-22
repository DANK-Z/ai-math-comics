import { useEffect, useId, useState } from 'react'
import { accounts, isAbortError, type Lang, type Shop, type SkinKey } from '../api'
import { useAccount } from '../account'
import { PORTRAITS } from '../art/sheet'
import { SECTION_HREFS } from '../route'
import { errorKey } from './AuthScreen'
import { PifikSprite } from './PifikSprite'

// «Магазин ярмарки»: spend boss-fight coins on Pifik skins. Prices and balance are the server's.

const COPY: Record<Lang, {
  lead: string
  coins: string
  buy: (price: number) => string
  wear: string
  takeOff: string
  applied: string
  owned: string
  short: (n: number) => string
  bought: (name: string) => string
  worn: (name: string) => string
  takenOff: string
  signIn: string
  signInButton: string
  loading: string
  errors: Record<string, string>
  items: Record<SkinKey, { name: string; about: string }>
}> = {
  ru: {
    lead: 'Трать монеты из битв с боссами на наряды для Пифика. Надетый наряд Пифик носит везде: в конструкторе, читалке и в битве.',
    coins: 'Монеты',
    buy: (p) => `Купить за ${p}`,
    wear: 'Надеть',
    takeOff: 'Снять',
    applied: 'Применено ✓',
    owned: 'Куплено',
    short: (n) => `Не хватает ${n} монет`,
    bought: (name) => `Готово! «${name}» теперь в рюкзаке.`,
    worn: (name) => `Пифик надел: «${name}».`,
    takenOff: 'Пифик снял наряд.',
    signIn: 'Магазин открыт для учеников с аккаунтом: монеты копятся за победы над боссами.',
    signInButton: 'Войти',
    loading: 'Загружаем витрину…',
    errors: { not_enough_coins: 'Не хватает монет.', already_owned: 'Этот наряд уже есть в рюкзаке.', network: 'Нет связи с сервером. Попробуй ещё раз.' },
    items: {
      'smart-glasses': { name: 'Очки умника', about: 'Для тех, кто видит x насквозь.' },
      'yellow-backpack': { name: 'Жёлтый рюкзак', about: 'Вмещает все подсказки ярмарки.' },
      'racer-helmet': { name: 'Шлем гонщика', about: 'Для погони за Хранителем Дорог.' },
    },
  },
  kk: {
    lead: 'Босстармен шайқаста тапқан тиындарыңды Пификтің киіміне жұмса. Киген киімін Пифик барлық жерде киеді: конструкторда, оқу кезінде және шайқаста.',
    coins: 'Тиындар',
    buy: (p) => `${p} тиынға алу`,
    wear: 'Кию',
    takeOff: 'Шешу',
    applied: 'Қолданылды ✓',
    owned: 'Сатып алынды',
    short: (n) => `${n} тиын жетпейді`,
    bought: (name) => `Дайын! «${name}» енді рюкзакта.`,
    worn: (name) => `Пифик киді: «${name}».`,
    takenOff: 'Пифик киімін шешті.',
    signIn: 'Дүкен аккаунты бар оқушыларға ашық: тиындар босстарды жеңгенде жиналады.',
    signInButton: 'Кіру',
    loading: 'Сөре жүктелуде…',
    errors: { not_enough_coins: 'Тиын жетпейді.', already_owned: 'Бұл киім рюкзакта бар.', network: 'Сервермен байланыс жоқ. Тағы байқап көр.' },
    items: {
      'smart-glasses': { name: 'Ақылды көзілдірік', about: 'x-ті тура көретіндерге арналған.' },
      'yellow-backpack': { name: 'Сары рюкзак', about: 'Жәрмеңкенің барлық кеңесі сыяды.' },
      'racer-helmet': { name: 'Жарысшы дулығасы', about: 'Жолдар Сақшысын қуу үшін.' },
    },
  },
}

const BUTTON = 'min-h-11 w-full rounded-xl border-[3px] border-ink px-3 font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

export function FairShop({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const account = useAccount()
  const isStudent = account.user?.role === 'student'
  const [shop, setShop] = useState<Shop | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<SkinKey | null>(null)

  useEffect(() => {
    if (!isStudent) return
    const ctrl = new AbortController()
    accounts.shop(ctrl.signal).then(setShop, (e) => {
      if (!isAbortError(e)) setStatus({ ok: false, text: c.errors.network })
    })
    return () => ctrl.abort()
  }, [isStudent, c])

  if (!isStudent) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border-[3px] border-dashed border-ink/50 bg-white p-4">
        <p className="font-semibold text-ink">{c.signIn}</p>
        <a href={SECTION_HREFS.login} className={`${BUTTON} w-auto bg-sun px-5 inline-flex items-center`}>{c.signInButton}</a>
      </div>
    )
  }

  async function act(key: SkinKey, action: () => Promise<Shop>, done: string) {
    setBusy(key)
    setStatus(null)
    try {
      setShop(await action())
      setStatus({ ok: true, text: done })
      await account.refresh() // header coins and Pifik's look everywhere
    } catch (e) {
      setStatus({ ok: false, text: c.errors[errorKey(e)] ?? c.errors.network })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm font-semibold text-ink/85">{c.lead}</p>
        <p className="rounded-lg border-2 border-ink bg-sun px-3 py-1 font-black text-ink" aria-label={`${c.coins}: ${shop?.coins ?? '…'}`}>
          <span aria-hidden>🪙 </span>{shop?.coins ?? '…'}
        </p>
      </div>
      <p id={`${id}-status`} role="status" className={`min-h-6 text-sm font-bold ${status?.ok === false ? 'text-rose-700' : 'text-emerald-800'}`}>
        {status?.text}
      </p>
      {!shop && !status && <p className="font-semibold text-ink/70">{c.loading}</p>}
      {shop && (
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {shop.items.map((item) => {
            const info = c.items[item.id]
            const missing = item.price - shop.coins
            return (
              <li key={item.id} className={`flex flex-col gap-2 rounded-2xl border-[3px] border-ink p-3 shadow-[0_4px_0_var(--color-ink)] ${item.equipped ? 'bg-sun/40' : 'bg-white'}`}>
                <div className="relative">
                  <PifikSprite rect={PORTRAITS.pifik} skin={item.id} className="aspect-square w-full rounded-xl border-2 border-ink/40 bg-sky" />
                  {item.equipped && (
                    <span className="absolute top-2 left-2 rounded-lg border-2 border-ink bg-sun px-2 py-0.5 text-xs font-black text-ink">{c.applied}</span>
                  )}
                  {item.owned && !item.equipped && (
                    <span className="absolute top-2 left-2 rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-black text-ink">{c.owned}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black leading-tight text-ink">{info.name}</h3>
                  {!item.owned && <span className="shrink-0 rounded-lg border-2 border-ink/60 bg-cream px-2 py-0.5 text-sm font-black text-ink">🪙 {item.price}</span>}
                </div>
                <p className="text-sm font-semibold text-ink/75">{info.about}</p>
                <div className="mt-auto">
                  {!item.owned ? (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null || missing > 0}
                        aria-describedby={missing > 0 ? `${id}-${item.id}-short` : undefined}
                        onClick={() => act(item.id, () => accounts.buy(item.id), c.bought(info.name))}
                        className={`${BUTTON} bg-sun`}
                      >
                        {c.buy(item.price)}
                      </button>
                      {missing > 0 && <p id={`${id}-${item.id}-short`} className="mt-1 text-xs font-bold text-ink/70">{c.short(missing)}</p>}
                    </>
                  ) : item.equipped ? (
                    <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(null), c.takenOff)} className={`${BUTTON} bg-white`}>
                      {c.takeOff}
                    </button>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(item.backpackItemId), c.worn(info.name))} className={`${BUTTON} bg-white`}>
                      {c.wear}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
