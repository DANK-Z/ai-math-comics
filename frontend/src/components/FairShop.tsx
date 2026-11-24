import { useEffect, useId, useRef, useState } from 'react'
import { accounts, isAbortError, type Lang, type Shop, type SkinKey } from '../api'
import { useAccount } from '../account'
import { PORTRAITS } from '../art/sheet'
import { SECTION_HREFS } from '../route'
import { errorKey } from './AuthScreen'
import { PifikSprite } from './PifikSprite'

// «Магазин ярмарки»: spend coins on Pifik skins (cosmetics only; Pifik's hints stay free).
// Prices, balance, ownership and the worn skin are the server's; guests are asked to sign in.

const COPY: Record<Lang, {
  lead: string
  coins: string
  balance: (n: number) => string
  fitting: string
  fittingLead: string
  tryOn: string
  trying: string
  buy: (price: number) => string
  buying: string
  wear: string
  wearNow: (name: string) => string
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
  free: string
  noSkins: string
  toShop: string
  wardrobeLead: string
  errors: Record<string, string>
  items: Record<SkinKey, { name: string; about: string }>
}> = {
  ru: {
    lead: 'Трать монеты за главы, финалы и битвы с боссами на наряды для Пифика. Подсказки Пифика всегда бесплатны.',
    coins: 'Монеты',
    balance: (n) => `Монеты: ${n}`,
    fitting: 'Примерочная',
    fittingLead: 'Так Пифик будет выглядеть в наряде.',
    tryOn: 'Примерить',
    trying: 'Примеряем ✓',
    buy: (p) => `Купить за ${p}`,
    buying: 'Покупаем…',
    wear: 'Надеть',
    wearNow: (name) => `Надеть «${name}»`,
    takeOff: 'Снять',
    applied: 'Надето ✓',
    owned: 'Куплено',
    short: (n) => `Не хватает ${n} монет`,
    bought: (name) => `Готово! «${name}» теперь в рюкзаке, во вкладке «Пифик».`,
    worn: (name) => `Пифик надел: «${name}».`,
    takenOff: 'Пифик снял наряд.',
    signIn: 'Магазин и монеты — для учеников с аккаунтом. Монеты копятся за первые прохождения глав, финалов и битв с боссами.',
    signInButton: 'Войти',
    loading: 'Загружаем витрину…',
    free: 'Подсказки Пифика бесплатны: в магазине только наряды.',
    noSkins: 'Нарядов пока нет. Загляни в магазин ярмарки!',
    toShop: 'В магазин',
    wardrobeLead: 'Надетый наряд Пифик носит везде: в главах, подсказках и битвах.',
    errors: { not_enough_coins: 'Не хватает монет.', already_owned: 'Этот наряд уже есть в рюкзаке.', network: 'Нет связи с сервером. Попробуй ещё раз.' },
    items: {
      'smart-glasses': { name: 'Очки умника', about: 'Латунные очки исследователя — для тех, кто видит x насквозь.' },
      'yellow-backpack': { name: 'Марсианский рюкзак', about: 'Вмещает всё для экспедиции на перемене.' },
      'racer-helmet': { name: 'Шлем гонщика', about: 'Синий гоночный шлем для гонок по дорогам ярмарки.' },
    },
  },
  kk: {
    lead: 'Тараулар, финалдар және босстармен шайқас үшін алған тиындарыңды Пификтің киіміне жұмса. Пификтің кеңестері әрқашан тегін.',
    coins: 'Тиындар',
    balance: (n) => `Тиындар: ${n}`,
    fitting: 'Киіп көру бөлмесі',
    fittingLead: 'Пифик осы киіммен осылай көрінеді.',
    tryOn: 'Киіп көру',
    trying: 'Киіп көрудеміз ✓',
    buy: (p) => `${p} тиынға алу`,
    buying: 'Сатып алып жатырмыз…',
    wear: 'Кию',
    wearNow: (name) => `«${name}» кию`,
    takeOff: 'Шешу',
    applied: 'Киілген ✓',
    owned: 'Сатып алынды',
    short: (n) => `${n} тиын жетпейді`,
    bought: (name) => `Дайын! «${name}» енді рюкзакта, «Пифик» қойындысында.`,
    worn: (name) => `Пифик киді: «${name}».`,
    takenOff: 'Пифик киімін шешті.',
    signIn: 'Дүкен мен тиындар — аккаунты бар оқушыларға. Тиындар тараулардан, финалдардан және босстармен шайқастан алғаш өткенде жиналады.',
    signInButton: 'Кіру',
    loading: 'Сөре жүктелуде…',
    free: 'Пификтің кеңестері тегін: дүкенде тек киімдер.',
    noSkins: 'Әзірге киім жоқ. Жәрмеңке дүкеніне кіріп шық!',
    toShop: 'Дүкенге',
    wardrobeLead: 'Киген киімін Пифик барлық жерде киеді: тарауларда, кеңестерде және шайқастарда.',
    errors: { not_enough_coins: 'Тиын жетпейді.', already_owned: 'Бұл киім рюкзакта бар.', network: 'Сервермен байланыс жоқ. Тағы байқап көр.' },
    items: {
      'smart-glasses': { name: 'Ақылды көзілдірік', about: 'Зерттеушінің жез көзілдірігі — x-ті тура көретіндерге арналған.' },
      'yellow-backpack': { name: 'Марс рюкзагы', about: 'Үзілістегі экспедицияға керектің бәрі сыяды.' },
      'racer-helmet': { name: 'Жарысшы дулығасы', about: 'Жәрмеңке жолдарындағы жарыстарға арналған көк дулыға.' },
    },
  },
}

/** The localized name of a Pifik skin. */
export function skinName(lang: Lang, key: SkinKey): string {
  return COPY[lang].items[key].name
}

const BUTTON = 'min-h-11 w-full rounded-xl border-[3px] border-ink px-3 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

/** Shop data and one-at-a-time actions (a second click while one runs is ignored). */
function useShop(lang: Lang) {
  const c = COPY[lang]
  const account = useAccount()
  const isStudent = account.user?.role === 'student'
  const [shop, setShop] = useState<Shop | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<SkinKey | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!isStudent) return
    const ctrl = new AbortController()
    accounts.shop(ctrl.signal).then(setShop, (e) => {
      if (!isAbortError(e)) setStatus({ ok: false, text: c.errors.network })
    })
    return () => ctrl.abort()
  }, [isStudent, c])

  async function act(key: SkinKey, action: () => Promise<Shop>, done: string) {
    // A ref, not state: a double click arrives before React re-renders the disabled button.
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(key)
    setStatus(null)
    try {
      setShop(await action())
      setStatus({ ok: true, text: done })
      await account.refresh() // header coins and Pifik's look everywhere
      return true
    } catch (e) {
      setStatus({ ok: false, text: c.errors[errorKey(e)] ?? c.errors.network })
      return false
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  return { c, isStudent, shop, status, busy, act }
}

function SignInPrompt({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border-[3px] border-dashed border-ink/50 bg-white p-4">
      <p className="font-semibold text-ink">{c.signIn}</p>
      <a href={SECTION_HREFS.login} className={`${BUTTON} inline-flex w-auto items-center bg-sun px-5`}>{c.signInButton}</a>
    </div>
  )
}

export function FairShop({ lang }: { lang: Lang }) {
  const { c, isStudent, shop, status, busy, act } = useShop(lang)
  const id = useId()
  // The fitting room starts on the Racer Helmet, the pilot item of «Дороги ярмарки».
  const [preview, setPreview] = useState<SkinKey>('racer-helmet')
  const [justBought, setJustBought] = useState<SkinKey | null>(null)

  if (!isStudent) return <SignInPrompt lang={lang} />

  const previewItem = shop?.items.find((item) => item.id === preview)
  const bought = justBought && shop?.items.find((item) => item.id === justBought)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm font-semibold text-ink/85">{c.lead}</p>
        <p className="rounded-lg border-2 border-ink bg-sun px-3 py-1 font-black text-ink" aria-label={shop ? c.balance(shop.coins) : c.coins}>
          <span aria-hidden>🪙 </span>{shop?.coins ?? '…'}
        </p>
      </div>

      {/* Fitting room: the previewed skin on a large Pifik. */}
      <section aria-labelledby={`${id}-fitting`} className="flex flex-col items-center gap-3 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--shadow-ink)] min-[480px]:flex-row min-[480px]:items-center">
        <PifikSprite rect={PORTRAITS.pifik} skin={preview} eager className="aspect-square w-32 shrink-0 rounded-xl border-2 border-ink/40 bg-sky sm:w-40" />
        <div className="min-w-0 text-center min-[480px]:text-left">
          <h3 id={`${id}-fitting`} className="text-xs font-black tracking-wide text-brand-dark uppercase">{c.fitting}</h3>
          <p className="text-lg leading-tight font-black text-ink">{c.items[preview].name}</p>
          <p className="mt-1 text-sm font-semibold text-ink/75">{c.fittingLead}</p>
          {previewItem && (
            <p className="mt-2 inline-block rounded-lg border-2 border-ink/60 bg-cream px-2 py-0.5 text-sm font-black text-ink">
              {previewItem.equipped ? c.applied : previewItem.owned ? c.owned : `🪙 ${previewItem.price}`}
            </p>
          )}
        </div>
      </section>

      <div id={`${id}-status`} role="status" className={`flex min-h-6 flex-wrap items-center gap-2 text-sm font-bold ${status?.ok === false ? 'text-rose-700' : 'text-emerald-800'}`}>
        {status?.text}
        {status?.ok && bought && bought.owned && !bought.equipped && bought.backpackItemId !== null && (
          <button type="button" disabled={busy !== null}
            onClick={() => act(bought.id, () => accounts.equip(bought.backpackItemId), c.worn(c.items[bought.id].name))}
            className={`${BUTTON} w-auto bg-sun px-4 text-sm`}>
            {c.wearNow(c.items[bought.id].name)}
          </button>
        )}
      </div>
      {!shop && !status && <p className="font-semibold text-ink/70">{c.loading}</p>}
      {shop && (
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {shop.items.map((item) => {
            const info = c.items[item.id]
            const missing = item.price - shop.coins
            const buying = busy === item.id && !item.owned
            return (
              <li key={item.id} className={`flex flex-col gap-2 rounded-2xl border-[3px] border-ink p-3 shadow-[0_4px_0_var(--shadow-ink)] ${item.equipped ? 'bg-sun/40' : 'bg-white'}`}>
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
                <div className="mt-auto flex flex-col gap-2">
                  <button type="button" aria-pressed={preview === item.id} onClick={() => setPreview(item.id)}
                    className={`${BUTTON} text-sm ${preview === item.id ? 'bg-sky' : 'bg-white'}`}>
                    {preview === item.id ? c.trying : c.tryOn}
                  </button>
                  {!item.owned ? (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null || missing > 0}
                        aria-describedby={missing > 0 ? `${id}-${item.id}-short` : undefined}
                        onClick={async () => {
                          setPreview(item.id)
                          if (await act(item.id, () => accounts.buy(item.id), c.bought(info.name))) setJustBought(item.id)
                        }}
                        className={`${BUTTON} bg-sun`}
                      >
                        {buying ? c.buying : c.buy(item.price)}
                      </button>
                      {missing > 0 && (
                        <p id={`${id}-${item.id}-short`} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800">{c.short(missing)}</p>
                      )}
                    </>
                  ) : item.equipped ? (
                    <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(null), c.takenOff)} className={`${BUTTON} bg-white`}>
                      {c.takeOff}
                    </button>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(item.backpackItemId), c.worn(info.name))} className={`${BUTTON} bg-sun`}>
                      {c.wear}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs font-semibold text-ink/65">{c.free}</p>
    </div>
  )
}

/** The Pifik tab of the backpack: owned skins with Equip / Take off. */
export function PifikWardrobe({ lang, onOpenShop }: { lang: Lang; onOpenShop: () => void }) {
  const { c, isStudent, shop, status, busy, act } = useShop(lang)
  if (!isStudent) return <SignInPrompt lang={lang} />
  const owned = shop?.items.filter((item) => item.owned) ?? []
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink/85">{c.wardrobeLead}</p>
      <p role="status" className={`min-h-6 text-sm font-bold ${status?.ok === false ? 'text-rose-700' : 'text-emerald-800'}`}>{status?.text}</p>
      {!shop && !status && <p className="font-semibold text-ink/70">{c.loading}</p>}
      {shop && owned.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border-[3px] border-dashed border-ink/40 bg-white/70 p-4">
          <p className="font-semibold text-ink">{c.noSkins}</p>
          <button type="button" onClick={onOpenShop} className={`${BUTTON} w-auto bg-sun px-5`}><span aria-hidden>🏬 </span>{c.toShop}</button>
        </div>
      )}
      {owned.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {owned.map((item) => (
            <li key={item.id} className={`flex flex-col gap-2 rounded-2xl border-[3px] border-ink p-2 shadow-[0_3px_0_var(--shadow-ink)] ${item.equipped ? 'bg-sun/40' : 'bg-white'}`}>
              <PifikSprite rect={PORTRAITS.pifik} skin={item.id} className="aspect-square w-full rounded-xl border-2 border-ink/40 bg-sky" />
              <p className="text-sm leading-tight font-black text-ink">{c.items[item.id].name}</p>
              {item.equipped ? (
                <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(null), c.takenOff)} className={`${BUTTON} mt-auto bg-white text-sm`}>
                  {c.takeOff}
                </button>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => act(item.id, () => accounts.equip(item.backpackItemId), c.worn(c.items[item.id].name))} className={`${BUTTON} mt-auto bg-sun text-sm`}>
                  {c.wear}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
