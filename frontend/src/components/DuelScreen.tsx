import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { accounts, type BattleTopic, type DuelState, type Lang } from '../api'
import { useAccount } from '../account'
import { CLASSROOM_COPY } from '../classroomCopy'
import { SECTION_HREFS } from '../route'
import { usePolled } from '../usePolled'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { Celebration } from './Celebration'

// #/duel: one on one. Pick a topic and play a waiting classmate (or wait for one), or open a
// duel by code and send it to a friend, or enter a friend's code. Both get the same five
// problems; the first to solve all five wins (3 minutes at most).

const COPY = {
  ru: {
    title: 'Дуэль 1 на 1',
    lead: 'Одни и те же 5 задач у обоих. Кто первым решит все — побеждает и получает 10 монет.',
    topic: 'Тема',
    withClass: '⚔️ С одноклассником',
    withClassHint: 'Сыграет тот, кто тоже ждёт дуэль по этой теме.',
    byCode: '🔗 По коду для друга',
    join: 'Есть код от друга?',
    joinButton: 'Войти',
    codePlaceholder: 'КОД',
    waiting: 'Ждём соперника…',
    shareCode: (code: string) => `Код дуэли: ${code} — отправь его другу`,
    you: 'Ты',
    opponent: (name?: string | null) => name ?? 'Соперник',
    left: (n: number) => `⏱ ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`,
    answer: 'Ответ',
    send: 'Ответить',
    wrong: 'Неверно — попробуй ещё раз',
    invalid: 'Запиши ответ числом или дробью',
    allDone: 'Ты решил все задачи! Ждём конца дуэли…',
    won: (coins: number) => `🏆 Победа! +${coins} монет`,
    lost: 'В этот раз соперник оказался быстрее. Реванш?',
    tie: 'Ничья! Оба молодцы.',
    again: 'Ещё дуэль',
    noCode: 'Дуэль с таким кодом не найдена или уже началась.',
    ownCode: 'Это твоя дуэль — отправь код другу.',
    noClass: 'Чтобы играть с одноклассником, вступи в класс по коду учителя.',
    guest: 'Войди как ученик, чтобы играть дуэли.',
    signIn: 'Войти',
    error: 'Нет связи. Попробуй ещё раз.',
  },
  kk: {
    title: '1-ге 1 жекпе-жек',
    lead: 'Екеуіңде де бірдей 5 есеп. Бәрін бірінші шешкен жеңеді және 10 тиын алады.',
    topic: 'Тақырып',
    withClass: '⚔️ Сыныптаспен',
    withClassHint: 'Осы тақырып бойынша жекпе-жек күтіп тұрған сыныптас ойнайды.',
    byCode: '🔗 Досқа арналған код',
    join: 'Достан код бар ма?',
    joinButton: 'Кіру',
    codePlaceholder: 'КОД',
    waiting: 'Қарсыласты күтеміз…',
    shareCode: (code: string) => `Жекпе-жек коды: ${code} — оны досыңа жібер`,
    you: 'Сен',
    opponent: (name?: string | null) => name ?? 'Қарсылас',
    left: (n: number) => `⏱ ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`,
    answer: 'Жауап',
    send: 'Жауап беру',
    wrong: 'Дұрыс емес — тағы көр',
    invalid: 'Жауапты санмен немесе бөлшекпен жаз',
    allDone: 'Барлық есепті шештің! Жекпе-жектің соңын күтеміз…',
    won: (coins: number) => `🏆 Жеңіс! +${coins} тиын`,
    lost: 'Бұл жолы қарсылас жылдамырақ болды. Реванш па?',
    tie: 'Тең! Екеуің де жарайсыңдар.',
    again: 'Тағы жекпе-жек',
    noCode: 'Мұндай кодпен жекпе-жек табылмады немесе басталып кеткен.',
    ownCode: 'Бұл сенің жекпе-жегің — кодты досыңа жібер.',
    noClass: 'Сыныптаспен ойнау үшін мұғалімнің коды арқылы сыныпқа қосыл.',
    guest: 'Жекпе-жек ойнау үшін оқушы ретінде кір.',
    signIn: 'Кіру',
    error: 'Байланыс жоқ. Қайта көр.',
  },
}

const TOPICS: BattleTopic[] = ['equations', 'fractions', 'addfractions', 'decimals', 'decimalops', 'gcd', 'parts', 'negatives', 'linear']

function Progress({ label, value, total, me }: { label: string; value: number; total: number; me?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-28 truncate text-sm font-black ${me ? 'text-brand-dark' : 'text-ink'}`}>{label}</span>
      <div className="flex flex-1 gap-1" aria-label={`${label}: ${value} / ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-4 flex-1 rounded-md border-2 border-ink ${i < value ? (me ? 'bg-[#3366e0]' : 'bg-[#fb9a3c]') : 'bg-white'}`} />
        ))}
      </div>
      <span className="w-10 text-right font-black tabular-nums">{value}/{total}</span>
    </div>
  )
}

function Arena({ duelId, lang, onAgain }: { duelId: string; lang: Lang; onAgain: () => void }) {
  const c = COPY[lang]
  const id = useId()
  const load = useCallback((signal: AbortSignal) => accounts.duel(duelId, lang, signal), [duelId, lang])
  const { value: polled, setValue } = usePolled<DuelState>(load, 1500)
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const duel = polled

  useEffect(() => { input.current?.focus() }, [duel?.me])
  if (!duel) return null

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!answer.trim() || busy) return
    setBusy(true)
    try {
      const result = await accounts.answerDuel(duelId, answer, lang)
      setValue(result.duel)
      setMessage(result.status === 'correct' ? null : result.status === 'invalid' ? c.invalid : c.wrong)
      if (result.status === 'correct') setAnswer('')
    } catch {
      setMessage(c.error)
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-live="polite">
      {duel.status === 'waiting' ? (
        <>
          <p className="text-xl font-black text-ink">⏳ {c.waiting}</p>
          <p className="w-fit rounded-xl border-[3px] border-ink bg-sun px-4 py-2 font-mono text-2xl font-black tracking-widest text-ink select-all">{duel.code}</p>
          <p className="text-sm font-semibold text-ink/75">{c.shareCode(duel.code)}</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black text-ink">{CLASSROOM_COPY[lang].board.topics[duel.topic]}</p>
            {duel.secondsLeft != null && <p className={`rounded-full border-2 border-ink px-3 py-0.5 font-black tabular-nums ${duel.secondsLeft <= 20 ? 'bg-rose-500 text-white' : 'bg-white text-ink'}`}>{c.left(duel.secondsLeft)}</p>}
          </div>
          <Progress label={c.you} value={duel.me} total={duel.total} me />
          <Progress label={c.opponent(duel.opponentName)} value={duel.opponent} total={duel.total} />
          {duel.status === 'active' && duel.prompt && (
            <form onSubmit={send} className="mt-1 flex flex-col gap-2 rounded-xl border-2 border-ink/25 bg-sky-50 p-3">
              <p className="text-xl leading-snug font-extrabold text-ink">{duel.prompt}</p>
              <div className="flex gap-2">
                <label htmlFor={`${id}-a`} className="sr-only">{c.answer}</label>
                <input ref={input} id={`${id}-a`} value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" autoFocus
                  inputMode={duel.answerFormat === 'whole-number' ? 'numeric' : 'text'} placeholder={c.answer}
                  className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-2xl font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
                <button type="submit" disabled={busy || !answer.trim()} className={`${PRIMARY} shrink-0`}>{c.send}</button>
              </div>
              {message && <p role="alert" className="font-bold text-rose-700">{message}</p>}
            </form>
          )}
          {duel.status === 'active' && !duel.prompt && <p className="font-bold text-emerald-700">{c.allDone}</p>}
          {duel.status === 'done' && (
            <div className="flex flex-col items-start gap-2">
              <Celebration when={duel.result === 'won'} />
              <p className={`text-2xl font-black ${duel.result === 'won' ? 'text-emerald-700' : 'text-ink'}`}>
                {duel.result === 'won' ? c.won(duel.coins) : duel.result === 'lost' ? c.lost : c.tie}
              </p>
              <button type="button" onClick={onAgain} className={PRIMARY}>{c.again}</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function DuelScreen({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const user = useAccount().user
  const id = useId()
  const [topic, setTopic] = useState<BattleTopic>('equations')
  const [code, setCode] = useState('')
  const [duelId, setDuelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user?.role !== 'student') {
    return (
      <section className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-3xl font-black text-ink">⚔️ {c.title}</h1>
        <p className={CARD}>{c.guest} <a href={SECTION_HREFS.login} className="font-black text-brand-dark underline">{c.signIn}</a></p>
      </section>
    )
  }

  async function run(action: () => Promise<DuelState>) {
    setBusy(true)
    setError(null)
    try {
      setDuelId((await action()).id)
    } catch (err) {
      const status = (err as { status?: number; code?: string }).status
      const errCode = (err as { code?: string }).code
      setError(errCode === 'no_class' ? c.noClass : errCode === 'own_duel' ? c.ownCode : status === 404 ? c.noCode : c.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4" aria-labelledby={`${id}-title`}>
      <div>
        <h1 id={`${id}-title`} className="text-3xl font-black text-ink">⚔️ {c.title}</h1>
        <p className="mt-1 font-semibold text-ink/80">{c.lead}</p>
      </div>
      {duelId ? <Arena duelId={duelId} lang={lang} onAgain={() => setDuelId(null)} /> : (
        <section className={`${CARD} flex flex-col gap-3`}>
          <fieldset>
            <legend className="text-sm font-black text-ink/80">{c.topic}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}
                  className={`rounded-xl border-[3px] border-ink px-3 py-1.5 text-sm font-black text-ink ${topic === t ? 'bg-sun' : 'bg-white hover:bg-sky'}`}>
                  {CLASSROOM_COPY[lang].board.topics[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => accounts.openDuel(topic, 'class', lang))} className={PRIMARY}>{c.withClass}</button>
            <button type="button" disabled={busy} onClick={() => run(() => accounts.openDuel(topic, 'code', lang))} className={SECONDARY}>{c.byCode}</button>
          </div>
          <p className="text-xs font-semibold text-ink/65">{c.withClassHint}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) void run(() => accounts.joinDuel(code, lang)) }} className="flex flex-wrap items-center gap-2 border-t-2 border-ink/10 pt-3">
            <label htmlFor={`${id}-code`} className="text-sm font-black text-ink/80">{c.join}</label>
            <input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder={c.codePlaceholder}
              className="min-h-10 w-28 rounded-xl border-[3px] border-ink bg-white px-2 font-mono font-black tracking-widest text-ink focus-visible:ring-4 focus-visible:ring-sun" />
            <button type="submit" disabled={busy || !code.trim()} className={`${SECONDARY} min-h-10`}>{c.joinButton}</button>
          </form>
          {error && <p role="alert" className="font-bold text-rose-700">{error}</p>}
        </section>
      )}
    </section>
  )
}
