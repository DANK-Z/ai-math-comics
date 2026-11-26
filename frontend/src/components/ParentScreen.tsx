import { MessagesCard } from './Messages'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { dayMonth } from '../dates'
import { accounts, isAbortError, type Billing, type ChildSummary, type Lang, type PraiseKind } from '../api'
import { CoinPacks, FamilyPlanCard } from './ParentBilling'
import { PRAISE } from './ParentCards'
import { ParentSummary } from './ParentSummary'
import { ChildChallenges, PeerBenchmark, PracticeCalendarCard, WeeklyLine } from './ParentMotivation'
import { useAccount } from '../account'
import { ACCOUNT_COPY, skillCopy } from '../accountCopy'
import { PORTRAITS } from '../art/sheet'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { PifikSprite } from './PifikSprite'

// The parent's area (#/parent) and the student's side of it: the family code in the profile and
// the praise cards on the home page. The summary is built from the child's real data in plain
// words — no grades, no charts.


const COPY = {
  ru: {
    title: 'Кабинет родителя',
    lead: 'Здесь видно, как идут дела у ребёнка, и можно его поддержать.',
    add: 'Добавить ребёнка',
    addLead: 'Попросите ребёнка открыть «Профиль» в игре — там его семейный код, например AMC-7KQ2MX4P.',
    code: 'Семейный код',
    adding: 'Добавляем…',
    empty: 'Пока здесь никого нет. Добавьте ребёнка по семейному коду.',
    notFound: 'Код не найден. Проверьте буквы и цифры.',
    error: 'Не получилось. Попробуйте ещё раз.',
    hero: 'Прогресс героя',
    chaptersMonth: (n: number) => `Глав за месяц: ${n}`,
    chaptersTotal: (n: number) => `всего пройдено: ${n}`,
    coins: (n: number) => `Монеты: ${n}`,
    stars: (n: number) => `Звёзды: ${n}`,
    summary: 'Сводка Пифика',
    summaryLead: 'По ответам за последний месяц, простыми словами.',
    praise: 'Похвалить и поддержать',
    praiseSent: 'Открытка отправлена — ребёнок увидит её на главной.',
    giftLater: (date: string) => `Следующий подарок можно отправить ${date}`,
    giftCoins: (n: number) => `+${n} монет`,
    recent: 'Последние успехи',
    boss: (topic: string, stars: number) => `Победа над боссом: ${topic} ${'⭐'.repeat(stars)}`,
    finale: 'Пройдено финальное испытание истории',
    remove: 'Убрать из кабинета',
    confirmRemove: 'Убрать ребёнка из кабинета? Добавить снова можно по семейному коду.',
    lastActive: (date: string) => `Последняя активность: ${date}`,
    // the summary
    noData: 'За этот месяц ещё нет данных. Предложите начать со следующей главы на главной — это минут десять.',
    month: (n: number) => `За этот месяц пройдено глав: ${n}.`,
    wins: (n: number, clean: number) => `Побед над боссами: ${n}${clean ? `, из них без единой ошибки: ${clean}` : ''}.`,
    strengths: (list: string) => `Хорошо получается: ${list}.`,
    weak: (skill: string, n: number) => `Чаще всего ошибки в теме «${skill}» (${n} раза за месяц). Это обычная трудность 5–6 класса: Пифик даёт к ней подсказки, а в игре уже предложена тренировка.`,
    drills: (n: number) => (n ? `Тренировок на этой неделе: ${n}.` : 'На этой неделе тренировок не было.'),
    homework: (open: number, overdue: number) => (open ? `Домашних заданий не сделано: ${open}${overdue ? `, из них просрочено: ${overdue}` : ''}.` : 'Все домашние задания выполнены.'),
  },
  kk: {
    title: 'Ата-ана кабинеті',
    lead: 'Мұнда баланың жетістіктері көрінеді және оны қолдауға болады.',
    add: 'Баланы қосу',
    addLead: 'Баладан ойындағы «Профильді» ашуды сұраңыз — онда отбасылық код бар, мысалы AMC-7KQ2MX4P.',
    code: 'Отбасылық код',
    adding: 'Қосып жатырмыз…',
    empty: 'Әзірге мұнда ешкім жоқ. Баланы отбасылық код арқылы қосыңыз.',
    notFound: 'Код табылмады. Әріптер мен сандарды тексеріңіз.',
    error: 'Болмады. Қайта көріңіз.',
    hero: 'Кейіпкердің жетістігі',
    chaptersMonth: (n: number) => `Айдағы тараулар: ${n}`,
    chaptersTotal: (n: number) => `барлығы өтілді: ${n}`,
    coins: (n: number) => `Тиын: ${n}`,
    stars: (n: number) => `Жұлдыз: ${n}`,
    summary: 'Пификтің шолуы',
    summaryLead: 'Соңғы айдағы жауаптар бойынша, қарапайым тілмен.',
    praise: 'Мақтау және қолдау',
    praiseSent: 'Ашықхат жіберілді — бала оны басты бетте көреді.',
    giftLater: (date: string) => `Келесі сыйлықты ${date} жіберуге болады`,
    giftCoins: (n: number) => `+${n} тиын`,
    recent: 'Соңғы жетістіктер',
    boss: (topic: string, stars: number) => `Босты жеңді: ${topic} ${'⭐'.repeat(stars)}`,
    finale: 'Оқиғаның финалдық сынағынан өтті',
    remove: 'Кабинеттен алып тастау',
    confirmRemove: 'Баланы кабинеттен алып тастау керек пе? Отбасылық код арқылы қайта қосуға болады.',
    lastActive: (date: string) => `Соңғы белсенділік: ${date}`,
    noData: 'Бұл айда әлі дерек жоқ. Басты беттегі келесі тараудан бастауды ұсыныңыз — он минуттай.',
    month: (n: number) => `Осы айда өтілген тараулар: ${n}.`,
    wins: (n: number, clean: number) => `Босты жеңу: ${n}${clean ? `, оның ішінде бір де қатесіз: ${clean}` : ''}.`,
    strengths: (list: string) => `Жақсы шығады: ${list}.`,
    weak: (skill: string, n: number) => `Көбіне «${skill}» тақырыбында қателеседі (айына ${n} рет). Бұл 5–6-сыныптың әдеттегі қиындығы: Пифик оған кеңестер береді, ал ойында жаттығу ұсынылған.`,
    drills: (n: number) => (n ? `Осы аптадағы жаттығулар: ${n}.` : 'Осы аптада жаттығу болған жоқ.'),
    homework: (open: number, overdue: number) => (open ? `Орындалмаған үй жұмысы: ${open}${overdue ? `, оның ішінде мерзімі өткені: ${overdue}` : ''}.` : 'Барлық үй жұмысы орындалды.'),
  },
}

const date = (iso: string, lang: Lang) => dayMonth(new Date(iso), lang)

/** «Сводка Пифика»: the child's month in a few plain sentences. */
export function childSummaryText(child: ChildSummary, lang: Lang): string[] {
  const c = COPY[lang]
  const skill = (key: string) => skillCopy(lang, key)?.name ?? key
  const lines: string[] = []
  if (!child.chaptersMonth && !child.bossWins && !child.drillsWeek) lines.push(c.noData)
  if (child.chaptersMonth) lines.push(c.month(child.chaptersMonth))
  if (child.bossWins) lines.push(c.wins(child.bossWins, child.cleanWins))
  if (child.strengths.length) lines.push(c.strengths(child.strengths.map(skill).join(', ')))
  if (child.weakSkill) lines.push(c.weak(skillCopy(lang, child.weakSkill)?.review ?? child.weakSkill, child.weakMistakes))
  lines.push(c.drills(child.drillsWeek))
  if (child.className) lines.push(c.homework(child.homeworkOpen, child.homeworkOverdue))
  return lines
}

function ChildCard({ child, lang, billing, onChange, onPaid, onRemove }: {
  child: ChildSummary
  lang: Lang
  billing: Billing | null
  onChange: (c: ChildSummary) => void
  onPaid: () => void
  onRemove: () => void
}) {
  const c = COPY[lang]
  const topics = ACCOUNT_COPY[lang].topics
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const id = useId()

  async function praise(kind: PraiseKind) {
    setBusy(true)
    setSent(false)
    try {
      onChange(await accounts.sendPraise(child.id, kind))
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-labelledby={`${id}-name`} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#24399f,#3366e0)] p-4 text-white shadow-[0_4px_0_var(--shadow-ink)] sm:p-5">
        <PifikSprite rect={PORTRAITS.pifik} skin={child.skin ?? null} className="w-24 shrink-0 rounded-2xl border-[3px] border-white/70 bg-white/15" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-sun uppercase">{c.hero}</p>
          <h2 id={`${id}-name`} className="text-2xl font-black">{child.name}{child.className ? ` · ${child.className}` : ''}</h2>
          <p className="mt-1 font-bold text-white/90">{c.chaptersMonth(child.chaptersMonth)} · {c.chaptersTotal(child.chaptersTotal)}</p>
          <p className="mt-1 flex flex-wrap gap-2 text-sm font-black">
            <span className="rounded-lg bg-white/15 px-2 py-0.5">🪙 {c.coins(child.coins)}</span>
            <span className="rounded-lg bg-white/15 px-2 py-0.5">⭐ {c.stars(child.stars)}</span>
          </p>
          {child.lastActive && <p className="mt-1 text-xs font-semibold text-white/75">{c.lastActive(date(child.lastActive, lang))}</p>}
        </div>
      </section>

      <ParentSummary child={child} lang={lang} />
      <PracticeCalendarCard childId={child.id} childName={child.name.split(' ')[0]} lang={lang} />
      <PeerBenchmark childId={child.id} lang={lang} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
      <WeeklyLine child={child} lang={lang} />
      <ChildChallenges childId={child.id} childName={child.name.split(' ')[0]} lang={lang} />

      <section className={CARD}>
        <h3 className="text-xl font-black text-ink">{c.praise}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['proud', 'keep-going', 'star'] as const).map((kind) => (
            <button key={kind} type="button" disabled={busy} onClick={() => praise(kind)} className={SECONDARY}>
              {PRAISE[kind].icon} {PRAISE[kind].text[lang]}
            </button>
          ))}
          <button type="button" disabled={busy || !!child.giftReadyAt} onClick={() => praise('gift')} className={PRIMARY}>
            🎁 {c.giftCoins(child.giftCoins ?? 20)}
          </button>
        </div>
        {child.giftReadyAt && <p className="mt-2 text-sm font-semibold text-ink/70">{c.giftLater(date(child.giftReadyAt, lang))}</p>}
        {sent && <p role="status" className="mt-2 font-bold text-emerald-700">✓ {c.praiseSent}</p>}
      </section>

      {billing && billing.mode !== 'off' && <CoinPacks child={child} lang={lang} billing={billing} onChange={onChange} onPaid={onPaid} />}

      {child.recent.length > 0 && (
        <section className={CARD}>
          <h3 className="text-xl font-black text-ink">{c.recent}</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {child.recent.map((win) => (
              <li key={`${win.kind}-${win.at}`} className="flex flex-wrap justify-between gap-2 font-semibold text-ink">
                <span>{win.kind === 'boss' ? `⚔️ ${c.boss(topics[win.key as keyof typeof topics] ?? win.key, win.stars)}` : `🏆 ${c.finale}`}</span>
                <span className="text-sm text-ink/60">{date(win.at, lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={onRemove} className="self-start text-sm font-bold text-ink/60 underline hover:text-rose-700">{c.remove}</button>
      </div>
    </article>
  )
}

/** #/parent: the parent's area. */
export function ParentScreen({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const { user, logOut } = useAccount()
  const id = useId()
  const [children, setChildren] = useState<ChildSummary[] | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<number | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    accounts.parentChildren(ctrl.signal).then(setChildren, (err) => { if (!isAbortError(err)) setError(c.error) })
    accounts.billing(ctrl.signal).then(setBilling, () => {})
    return () => ctrl.abort()
  }, [c])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    setError(null)
    try {
      const child = await accounts.addChild(code.trim())
      setChildren((prev) => [...(prev ?? []).filter((x) => x.id !== child.id), child])
      setCode('')
    } catch (err) {
      setError((err as { status?: number }).status === 404 ? c.notFound : c.error)
    } finally {
      setBusy(false)
    }
  }

  async function remove(child: ChildSummary) {
    if (!window.confirm(c.confirmRemove)) return
    await accounts.removeChild(child.id)
    setChildren((prev) => (prev ?? []).filter((x) => x.id !== child.id))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-ink">{c.title}</h1>
          <p className="mt-1 font-semibold text-ink/80">{user?.displayName} · {c.lead}</p>
        </div>
        <button type="button" onClick={logOut} className="min-h-11 rounded-lg px-2 text-sm font-bold text-ink/70 underline decoration-2 underline-offset-4 hover:text-ink focus-visible:outline-3 focus-visible:outline-brand">{ACCOUNT_COPY[lang].signOut}</button>
      </div>
      {children?.length === 0 && <p className={`${CARD} font-bold`}>{c.empty}</p>}
      <MessagesCard as="parent" lang={lang} />
      {children && children.length > 1 && (
        <div role="tablist" aria-label={c.title} className="flex flex-wrap gap-1.5 self-start rounded-2xl border-[3px] border-ink bg-white p-1.5 shadow-[0_3px_0_var(--shadow-ink)]">
          {children.map((child) => {
            const active = (shown ?? children[0].id) === child.id
            return (
              <button key={child.id} type="button" role="tab" aria-selected={active} onClick={() => setShown(child.id)}
                className={`min-h-11 rounded-xl border-2 px-3 font-black text-ink focus-visible:outline-3 focus-visible:outline-brand ${active ? 'border-ink bg-sun' : 'border-transparent hover:bg-sky'}`}>
                {child.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      )}
      {children?.filter((child) => children.length < 2 || (shown ?? children[0].id) === child.id).map((child) => (
        <ChildCard key={child.id} child={child} lang={lang} billing={billing}
          onChange={(next) => setChildren((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)))}
          onPaid={() => { accounts.billing().then(setBilling, () => {}) }}
          onRemove={() => remove(child)} />
      ))}
      <form onSubmit={add} className={CARD}>
        <h2 className="text-xl font-black text-ink">{c.add}</h2>
        <p className="mt-1 text-sm font-semibold text-ink/75">{c.addLead}</p>
        <label htmlFor={`${id}-code`} className="mt-3 block text-sm font-black text-ink/80">{c.code}</label>
        <div className="mt-1 flex gap-2">
          <input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="AMC-7KQ2MX4P" autoComplete="off"
            className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-lg font-bold text-ink uppercase outline-none focus-visible:ring-4 focus-visible:ring-sun" />
          <button type="submit" disabled={busy || !code.trim()} className={`${PRIMARY} shrink-0`}>{busy ? c.adding : c.add}</button>
        </div>
        {error && <p role="alert" className="mt-2 font-bold text-rose-700">{error}</p>}
      </form>
      {billing && billing.mode !== 'off' && (
        <FamilyPlanCard lang={lang} billing={billing} onChange={setBilling}
          onPlan={() => { accounts.parentChildren().then(setChildren, () => {}) }} />
      )}
    </div>
  )
}
