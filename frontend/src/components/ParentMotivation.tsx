import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { accounts, isAbortError, type Benchmark, type Challenge, type ChallengeKind, type Lang, type PracticeCalendar } from '../api'
import { CARD, PRIMARY } from './AuthScreen'
import { GOAL_TEXT, topicName } from './ParentCards'

// The parent's area, motivation: challenges with real rewards (set by the parent, counted from
// the child's results), a calendar of practice days with a rare frame for a five-day streak, and
// the child next to anonymous peers of the same grade.

type T = Record<Lang, string>
const t = (ru: string, kk: string): T => ({ ru, kk })

const COPY = {
  ru: {
    challenges: 'Челленджи с наградой',
    challengesLead: 'Пообещайте настоящую награду за цель — успехи посчитаются сами, ребёнок увидит челлендж у себя на главной.',
    done: (name: string) => `${name} выполнил челлендж! Пора порадовать героя 🎉`,
    rewarded: '✓ Награда вручена',
    markRewarded: 'Награда вручена',
    remove: 'Убрать',
    progress: (p: number, target: number) => `${p} из ${target}`,
    none: 'Пока нет челленджей. Добавьте первый — например, «Пройти 3 главы = поход в кино».',
    add: '➕ Новый челлендж',
    goal: 'Цель',
    topic: 'Тема',
    target: 'Сколько',
    reward: 'Награда',
    rewardPlaceholder: '+500 ₸ на карманные расходы',
    save: 'Пообещать',
    limit: 'Можно до 5 активных челленджей на ребёнка.',
    error: 'Не получилось сохранить. Проверьте награду и число.',
    kinds: {
      boss_clean: t('Победить босса на 3 звезды без ошибок', 'Боссты қатесіз 3 жұлдызға жеңу'),
      chapters: t('Пройти главы комиксов', 'Комикс тарауларын өту'),
      drills: t('Пройти тренировки по 5 задач', '5 есептен жаттығулар өту'),
      streak: t('Решать задачу дня несколько дней подряд', 'Күн есебін қатарынан бірнеше күн шешу'),
    } as Record<ChallengeKind, T>,
    goalText: GOAL_TEXT.ru,
    calendar: 'Календарь занятий',
    calendarLead: 'Жёлтые дни — прошёл главу или победил босса, светлые — решал задачи.',
    streak: (n: number) => (n ? `🔥 Серия: ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней'} подряд` : 'Серии пока нет'),
    giftOffer: (name: string, n: number) => `${name} держит ударную дозу математики уже ${n} дней! Отправить редкую рамку «Огненная серия» в подарок за усидчивость?`,
    giftSend: '🔥 Подарить рамку',
    giftSent: '✓ Рамка «Огненная серия» уже подарена.',
    giftHint: 'С 5 дней подряд можно подарить редкую рамку, которой нет в магазине.',
    weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    dayTitle: (d: string, n: number, ch: number, b: number) => `${d}: ${n ? `заданий ${n}${ch ? `, глав ${ch}` : ''}${b ? `, побед над боссом ${b}` : ''}` : 'не занимался'}`,
    prev: 'Предыдущий месяц',
    next: 'Следующий месяц',
    bench: 'Сравнение со сверстниками',
    benchLead: (grade: number | null | undefined, peers: number, days: number) => `Анонимно, ученики ${grade ? `${grade} класса` : 'того же класса'} на платформе (${peers}) за ${days} дней.`,
    benchFew: 'Пока мало учеников для честного сравнения — показываем только результаты ребёнка.',
    accuracy: (p: number) => `верно ${p}%`,
    peers: (p: number) => `в среднем ${p}%`,
    ahead: (p: number) => (p >= 90 ? `🏅 входит в топ-${Math.max(1, 100 - p)}% лучших` : `точнее, чем ${p}% сверстников`),
    fewAnswers: 'мало ответов для оценки',
    active: (days: number, avg: number | null | undefined, p: number | null | undefined) =>
      `Занимался ${days} дн. из 30${avg != null ? ` (в среднем по сверстникам — ${avg})` : ''}${p != null ? ` — регулярнее, чем ${p}% учеников` : ''}.`,
  },
  kk: {
    challenges: 'Сыйлықты челлендждер',
    challengesLead: 'Мақсат үшін нақты сыйлық уәде етіңіз — жетістіктер өзі есептеледі, бала челленджді басты бетінде көреді.',
    done: (name: string) => `${name} челленджді орындады! Батырды қуантатын уақыт келді 🎉`,
    rewarded: '✓ Сыйлық берілді',
    markRewarded: 'Сыйлық берілді',
    remove: 'Алып тастау',
    progress: (p: number, target: number) => `${target}-ден ${p}`,
    none: 'Әзірге челлендж жоқ. Біріншісін қосыңыз — мысалы, «3 тарау өту = киноға бару».',
    add: '➕ Жаңа челлендж',
    goal: 'Мақсат',
    topic: 'Тақырып',
    target: 'Қанша',
    reward: 'Сыйлық',
    rewardPlaceholder: 'Қалта шығынына +500 ₸',
    save: 'Уәде ету',
    limit: 'Бір балаға 5 белсенді челлендж болуы мүмкін.',
    error: 'Сақтау мүмкін болмады. Сыйлық пен санды тексеріңіз.',
    kinds: {
      boss_clean: t('Победить босса на 3 звезды без ошибок', 'Боссты қатесіз 3 жұлдызға жеңу'),
      chapters: t('Пройти главы комиксов', 'Комикс тарауларын өту'),
      drills: t('Пройти тренировки по 5 задач', '5 есептен жаттығулар өту'),
      streak: t('Решать задачу дня несколько дней подряд', 'Күн есебін қатарынан бірнеше күн шешу'),
    } as Record<ChallengeKind, T>,
    goalText: GOAL_TEXT.kk,
    calendar: 'Сабақ күнтізбесі',
    calendarLead: 'Сары күндер — тарау өтті немесе боссты жеңді, ашық күндер — есеп шығарды.',
    streak: (n: number) => (n ? `🔥 Қатарынан ${n} күн` : 'Серия әзірге жоқ'),
    giftOffer: (name: string, n: number) => `${name} қатарынан ${n} күн математикамен айналысып жүр! Табандылығы үшін «Отты серия» сирек жиегін сыйлайсыз ба?`,
    giftSend: '🔥 Жиекті сыйлау',
    giftSent: '✓ «Отты серия» жиегі сыйланған.',
    giftHint: 'Қатарынан 5 күннен бастап дүкенде жоқ сирек жиекті сыйлауға болады.',
    weekdays: ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сн', 'Жс'],
    dayTitle: (d: string, n: number, ch: number, b: number) => `${d}: ${n ? `тапсырма ${n}${ch ? `, тарау ${ch}` : ''}${b ? `, босс жеңісі ${b}` : ''}` : 'айналыспады'}`,
    prev: 'Алдыңғы ай',
    next: 'Келесі ай',
    bench: 'Құрдастармен салыстыру',
    benchLead: (grade: number | null | undefined, peers: number, days: number) => `Анонимді түрде, платформадағы ${grade ? `${grade}-сынып` : 'сол сынып'} оқушылары (${peers}), ${days} күн ішінде.`,
    benchFew: 'Әділ салыстыру үшін оқушылар әзірге аз — тек баланың нәтижелерін көрсетеміз.',
    accuracy: (p: number) => `${p}% дұрыс`,
    peers: (p: number) => `орташа ${p}%`,
    ahead: (p: number) => (p >= 90 ? `🏅 үздік ${Math.max(1, 100 - p)}%-ға кіреді` : `құрдастарының ${p}%-ынан дәлірек`),
    fewAnswers: 'бағалауға жауап аз',
    active: (days: number, avg: number | null | undefined, p: number | null | undefined) =>
      `30 күннің ${days} күнінде айналысты${avg != null ? ` (құрдастарда орташа — ${avg})` : ''}${p != null ? ` — оқушылардың ${p}%-ынан жүйелірек` : ''}.`,
  },
}

const TARGETS: Record<ChallengeKind, number[]> = { boss_clean: [1, 2, 3], chapters: [1, 2, 3, 5, 10], drills: [1, 2, 3, 5], streak: [3, 5, 7, 14] }

/** Parent: challenges for one child, with the «done!» banner and a form for a new one. */
export function ChildChallenges({ childId, childName, lang }: { childId: number; childName: string; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [items, setItems] = useState<Challenge[] | null>(null)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ChallengeKind>('chapters')
  const [topic, setTopic] = useState<'equations' | 'fractions'>('equations')
  const [target, setTarget] = useState(3)
  const [reward, setReward] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    accounts.challenges(childId, ctrl.signal).then(setItems, (err) => { if (!isAbortError(err)) setItems([]) })
    return () => ctrl.abort()
  }, [childId])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      const made = await accounts.setChallenge(childId, { kind, topic: kind === 'boss_clean' ? topic : null, target, reward })
      setItems((list) => [made, ...(list ?? [])])
      setReward('')
      setOpen(false)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function rewarded(item: Challenge) {
    const updated = await accounts.challengeRewarded(item.id)
    setItems((list) => (list ?? []).map((i) => (i.id === item.id ? updated : i)))
  }

  async function remove(item: Challenge) {
    await accounts.deleteChallenge(item.id)
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id))
  }

  const fresh = (items ?? []).filter((i) => i.done && !i.rewardedAt)
  const field = 'mt-1 min-h-10 w-full rounded-xl border-[3px] border-ink bg-white px-2.5 font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun'
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🎯</span>{c.challenges}</h3>
      <p className="mt-1 text-sm font-semibold text-ink/75">{c.challengesLead}</p>

      {fresh.map((item) => (
        <div key={item.id} role="status" className="celebrate-pop mt-3 rounded-xl border-[3px] border-emerald-600 bg-emerald-50 p-3">
          <p className="font-black text-emerald-900">{c.done(childName)}</p>
          <p className="mt-0.5 text-sm font-bold text-ink">{c.goalText(item.kind, item.target, topicName(lang, item.topic))} → 🎁 {item.reward}</p>
          <button type="button" onClick={() => rewarded(item)} className={`${PRIMARY} mt-2 min-h-10 text-sm`}>✓ {c.markRewarded}</button>
        </div>
      ))}

      {items && items.length === 0 && !open && <p className="mt-3 text-sm font-semibold text-ink/70">{c.none}</p>}
      {items && items.filter((i) => !(i.done && !i.rewardedAt)).length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.filter((i) => !(i.done && !i.rewardedAt)).map((item) => (
            <li key={item.id} className={`rounded-xl border-2 p-2.5 ${item.rewardedAt ? 'border-ink/15 bg-ink/5' : 'border-ink/30'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-black text-ink">{c.goalText(item.kind, item.target, topicName(lang, item.topic))}</p>
                {item.rewardedAt ? <span className="text-xs font-black text-emerald-700">{c.rewarded}</span> : (
                  <button type="button" onClick={() => remove(item)} className="text-xs font-bold text-ink/55 underline hover:text-rose-700">{c.remove}</button>
                )}
              </div>
              <p className="text-sm font-bold text-ink/80">🎁 {item.reward}</p>
              {!item.rewardedAt && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white" aria-hidden>
                    <span className="block h-full bg-[#16a36a]" style={{ width: `${Math.min(100, (item.progress / item.target) * 100)}%` }} />
                  </span>
                  <span className="text-xs font-black text-ink tabular-nums">{c.progress(Math.min(item.progress, item.target), item.target)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={save} className="mt-3 grid gap-2 rounded-xl border-2 border-dashed border-ink/40 p-3">
          <div>
            <label htmlFor={`${id}-kind`} className="text-sm font-black text-ink/80">{c.goal}</label>
            <select id={`${id}-kind`} value={kind} onChange={(e) => { const k = e.target.value as ChallengeKind; setKind(k); setTarget(TARGETS[k][Math.min(1, TARGETS[k].length - 1)]) }} className={field}>
              {(Object.keys(c.kinds) as ChallengeKind[]).map((k) => <option key={k} value={k}>{c.kinds[k][lang]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kind === 'boss_clean' && (
              <div>
                <label htmlFor={`${id}-topic`} className="text-sm font-black text-ink/80">{c.topic}</label>
                <select id={`${id}-topic`} value={topic} onChange={(e) => setTopic(e.target.value as 'equations' | 'fractions')} className={field}>
                  <option value="equations">{topicName(lang, 'equations')}</option>
                  <option value="fractions">{topicName(lang, 'fractions')}</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor={`${id}-target`} className="text-sm font-black text-ink/80">{c.target}</label>
              <select id={`${id}-target`} value={target} onChange={(e) => setTarget(Number(e.target.value))} className={field}>
                {TARGETS[kind].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-reward`} className="text-sm font-black text-ink/80">{c.reward}</label>
            <input id={`${id}-reward`} value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} required minLength={2} placeholder={c.rewardPlaceholder} className={field} />
          </div>
          <p className="text-xs font-semibold text-ink/65">🎯 {c.goalText(kind, target, kind === 'boss_clean' ? topicName(lang, topic) : null)}{reward.trim() ? ` → 🎁 ${reward.trim()}` : ''}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || reward.trim().length < 2} className={`${PRIMARY} min-h-10`}>{c.save}</button>
            <span className="text-xs font-semibold text-ink/60">{c.limit}</span>
          </div>
          {error && <p role="alert" className="text-sm font-bold text-rose-700">{c.error}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-xl border-[3px] border-dashed border-ink/50 px-3 py-1.5 text-sm font-black text-ink hover:border-ink hover:bg-sky">{c.add}</button>
      )}
    </section>
  )
}

/** Parent: a month of practice days, the streak and the rare frame for five days in a row. */
export function PracticeCalendarCard({ childId, childName, lang }: { childId: number; childName: string; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [month, setMonth] = useState<string | undefined>(undefined)
  const [cal, setCal] = useState<PracticeCalendar | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    accounts.practiceCalendar(childId, month, ctrl.signal).then(setCal, () => {})
    return () => ctrl.abort()
  }, [childId, month])

  const shift = useCallback((by: number) => {
    if (!cal) return
    const [y, m] = cal.month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + by, 1))
    setMonth(d.toISOString().slice(0, 7))
  }, [cal])

  if (!cal) return null
  const [y, m] = cal.month.split('-').map(Number)
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const lead = (new Date(`${cal.days[0].day}T00:00:00Z`).getUTCDay() + 6) % 7
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
  const isCurrent = cal.month === today.slice(0, 7)

  async function gift() {
    setBusy(true)
    try {
      setCal(await accounts.streakGift(childId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📅</span>{c.calendar}</h3>
        <span className="flex-1" />
        <span className="font-black text-orange-700">{c.streak(cal.streak)}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink/65">{c.calendarLead}</p>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label={c.prev} className="grid size-8 place-items-center rounded-lg border-2 border-ink font-black hover:bg-sky">‹</button>
        <span className="font-black text-ink capitalize">{title}</span>
        <button type="button" onClick={() => shift(1)} disabled={isCurrent} aria-label={c.next} className="grid size-8 place-items-center rounded-lg border-2 border-ink font-black hover:bg-sky disabled:opacity-30">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={title}>
        {c.weekdays.map((w) => <span key={w} className="text-[11px] font-black text-ink/55">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`pad-${i}`} />)}
        {cal.days.map((d) => {
          const bright = d.chapters > 0 || d.bosses > 0
          const future = d.day > today
          return (
            <span key={d.day} title={c.dayTitle(d.day.slice(8), d.count, d.chapters, d.bosses)}
              className={`grid h-9 place-items-center rounded-lg border-2 text-sm font-black tabular-nums ${
                future ? 'border-transparent text-ink/25' : bright ? 'border-ink bg-[#ffc83d] text-ink' : d.count ? 'border-ink/40 bg-[#fff1b8] text-ink' : 'border-ink/10 bg-white text-ink/45'
              } ${d.day === today ? 'outline-3 outline-offset-1 outline-brand' : ''}`}>
              {Number(d.day.slice(8))}
            </span>
          )
        })}
      </div>
      {cal.giftReady ? (
        <div className="mt-3 rounded-xl border-[3px] border-orange-500 bg-orange-50 p-3">
          <p className="font-black text-ink">{c.giftOffer(childName, cal.streak)}</p>
          <button type="button" disabled={busy} onClick={gift} className={`${PRIMARY} mt-2 min-h-10 text-sm`}>{c.giftSend}</button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-ink/65">{cal.giftSent ? c.giftSent : c.giftHint}</p>
      )}
    </section>
  )
}

/** Parent: the child next to anonymous peers of the same grade on the platform. */
export function PeerBenchmark({ childId, lang }: { childId: number; lang: Lang }) {
  const c = COPY[lang]
  const id = useId()
  const [bench, setBench] = useState<Benchmark | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    accounts.benchmark(childId, ctrl.signal).then(setBench, () => {})
    return () => ctrl.abort()
  }, [childId])
  if (!bench) return null
  const enough = bench.topics.some((t) => t.percentile != null) || bench.activePercentile != null
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📊</span>{c.bench}</h3>
      <p className="mt-1 text-xs font-semibold text-ink/65">{enough ? c.benchLead(bench.grade, bench.peers, bench.days) : c.benchFew}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {bench.topics.map((t) => (
          <li key={t.topic}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-black text-ink">{topicName(lang, t.topic)}</span>
              <span className="text-sm font-bold text-ink/80">
                {t.accuracy == null ? c.fewAnswers : c.accuracy(t.accuracy)}{t.peerAverage != null ? ` · ${c.peers(t.peerAverage)}` : ''}
              </span>
            </div>
            {t.accuracy != null && (
              <div className="relative mt-1 h-4 overflow-visible rounded-xl border-2 border-ink bg-white" aria-hidden>
                <span className={`block h-full rounded-[10px] ${t.percentile != null && t.percentile >= 50 ? 'bg-[#16a36a]' : 'bg-[#f5c542]'}`} style={{ width: `${t.accuracy}%` }} />
                {t.peerAverage != null && <span className="absolute -top-1 -bottom-1 w-1 rounded bg-ink" style={{ left: `calc(${t.peerAverage}% - 2px)` }} />}
              </div>
            )}
            {t.percentile != null && <p className="mt-0.5 text-sm font-black text-emerald-800">{c.ahead(t.percentile)}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-semibold text-ink/80">{c.active(bench.activeDays, bench.peerActiveDays, bench.activePercentile)}</p>
    </section>
  )
}
