import { useCallback, useEffect, useId, useState } from 'react'
import { accounts, type Lang, type PrepResult, type PrepTest } from '../api'
import { useAccount } from '../account'
import { useLoaded } from '../usePolled'
import { SECTION_HREFS } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'

// #/prep: NIS / BIL entrance prep. A mock test of 10 olympiad-style problems with a 25-minute
// timer; after submitting, every problem shows the right answer and a step-by-step walkthrough.

const COPY = {
  ru: {
    title: 'Подготовка к НИШ и БИЛ',
    lead: 'Пробный тест: 10 олимпиадных задач, 25 минут. После теста — разбор каждой задачи.',
    start: '▶ Начать пробный тест',
    history: 'Мои пробные тесты',
    noHistory: 'Пока ни одного теста. Начни первый!',
    left: (n: number) => `⏱ ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`,
    problem: (n: number) => `Задача ${n}`,
    answer: 'Ответ',
    submit: 'Сдать тест',
    confirm: (n: number) => `Не решено задач: ${n}. Всё равно сдать?`,
    timeUp: 'Время вышло — тест сдан автоматически.',
    score: (s: number, t: number) => `Результат: ${s} из ${t}`,
    verdict: (s: number, t: number) => (s / t >= 0.8 ? 'Отличный уровень для поступления!' : s / t >= 0.5 ? 'Хорошо! Разбери ошибки — и будет ещё лучше.' : 'Начало положено. Разбор ниже поможет понять задачи.'),
    minutes: (m: number) => `Время: ${m} мин`,
    yours: 'Твой ответ',
    right: 'Правильный ответ',
    empty: '—',
    walkthrough: 'Разбор',
    again: 'Ещё один тест',
    guest: 'Войди как ученик, чтобы проходить пробные тесты.',
    signIn: 'Войти',
    error: 'Нет связи. Попробуй ещё раз.',
  },
  kk: {
    title: 'НЗМ және БИЛ-ге дайындық',
    lead: 'Сынақ тест: 10 олимпиадалық есеп, 25 минут. Тесттен кейін — әр есептің талдауы.',
    start: '▶ Сынақ тестті бастау',
    history: 'Менің сынақ тесттерім',
    noHistory: 'Әзірге бірде-бір тест жоқ. Біріншісін баста!',
    left: (n: number) => `⏱ ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`,
    problem: (n: number) => `${n}-есеп`,
    answer: 'Жауап',
    submit: 'Тестті тапсыру',
    confirm: (n: number) => `Шешілмеген есеп: ${n}. Бәрібір тапсырасың ба?`,
    timeUp: 'Уақыт бітті — тест автоматты түрде тапсырылды.',
    score: (s: number, t: number) => `Нәтиже: ${t}-тен ${s}`,
    verdict: (s: number, t: number) => (s / t >= 0.8 ? 'Түсуге тамаша деңгей!' : s / t >= 0.5 ? 'Жақсы! Қателерді талда — одан да жақсы болады.' : 'Бастама жасалды. Төмендегі талдау есептерді түсінуге көмектеседі.'),
    minutes: (m: number) => `Уақыт: ${m} мин`,
    yours: 'Сенің жауабың',
    right: 'Дұрыс жауап',
    empty: '—',
    walkthrough: 'Талдау',
    again: 'Тағы бір тест',
    guest: 'Сынақ тест тапсыру үшін оқушы ретінде кір.',
    signIn: 'Кіру',
    error: 'Байланыс жоқ. Қайта көр.',
  },
}

function useCountdown(seconds: number | null, onZero: () => void) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => setLeft(seconds), [seconds])
  useEffect(() => {
    if (left == null) return
    if (left <= 0) { onZero(); return }
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [left, onZero])
  return left
}

function Test({ test, lang, onDone }: { test: PrepTest; lang: Lang; onDone: (r: PrepResult, timeUp: boolean) => void }) {
  const c = COPY[lang]
  const id = useId()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (timeUp: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim()))
      onDone(await accounts.submitPrep(test.id, filled, lang), timeUp)
    } catch {
      setError(c.error)
      setBusy(false)
    }
  }, [answers, test.id, lang, onDone, c.error])
  const timeUp = useCallback(() => { void submit(true) }, [submit])
  const left = useCountdown(test.secondsLeft, timeUp)
  const unanswered = test.problems.filter((p) => !answers[p.id]?.trim()).length

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      if (unanswered && !window.confirm(c.confirm(unanswered))) return
      void submit(false)
    }}>
      <div className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-2xl border-[3px] border-ink bg-white px-4 py-2 shadow-[3px_3px_0_#17233a]">
        <span className="font-black text-ink">{test.problems.length - unanswered}/{test.problems.length}</span>
        <span className={`rounded-full border-2 border-ink px-3 py-0.5 font-black tabular-nums ${left != null && left <= 120 ? 'bg-rose-500 text-white' : 'bg-sun text-ink'}`} aria-live="off">{c.left(Math.max(0, left ?? 0))}</span>
      </div>
      <ol className="flex flex-col gap-3">
        {test.problems.map((p, i) => (
          <li key={p.id} className={`${CARD} flex flex-col gap-2`}>
            <p className="text-xs font-black tracking-wide text-ink/60 uppercase">{c.problem(i + 1)}</p>
            <p className="text-lg leading-snug font-bold text-ink">{p.prompt}</p>
            <label htmlFor={`${id}-${p.id}`} className="sr-only">{c.answer} {i + 1}</label>
            <input id={`${id}-${p.id}`} value={answers[p.id] ?? ''} autoComplete="off" placeholder={c.answer}
              onChange={(e) => setAnswers((a) => ({ ...a, [p.id]: e.target.value }))}
              className="min-h-11 w-40 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-xl font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="font-bold text-rose-700">{error}</p>}
      <button type="submit" disabled={busy} className={`${PRIMARY} self-start`}>{c.submit}</button>
    </form>
  )
}

function Result({ result, timeUp, lang, onAgain }: { result: PrepResult; timeUp: boolean; lang: Lang; onAgain: () => void }) {
  const c = COPY[lang]
  return (
    <div className="flex flex-col gap-3">
      <section className={`${CARD} flex flex-col gap-1`} aria-live="polite">
        {timeUp && <p className="font-bold text-rose-700">{c.timeUp}</p>}
        <p className="text-3xl font-black text-ink">{c.score(result.score, result.total)}</p>
        <p className="font-semibold text-ink/80">{c.verdict(result.score, result.total)} · {c.minutes(result.minutesUsed)}</p>
        <button type="button" onClick={onAgain} className={`${PRIMARY} mt-2 self-start`}>{c.again}</button>
      </section>
      <ol className="flex flex-col gap-3">
        {result.problems.map((p, i) => (
          <li key={p.id} className={`rounded-2xl border-[3px] border-ink p-4 ${p.correct ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <p className="text-xs font-black tracking-wide text-ink/60 uppercase">{p.correct ? '✅' : '❌'} {c.problem(i + 1)}</p>
            <p className="mt-1 font-bold text-ink">{p.prompt}</p>
            <p className="mt-2 text-sm font-semibold text-ink/85">{c.yours}: <b className="font-mono">{p.yourAnswer || c.empty}</b> · {c.right}: <b className="font-mono">{p.answer}</b></p>
            <details className="mt-2" open={!p.correct}>
              <summary className="cursor-pointer text-sm font-black text-brand-dark">{c.walkthrough}</summary>
              <p className="mt-1 text-sm leading-relaxed font-semibold text-ink/90">{p.solution}</p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PrepScreen({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const user = useAccount().user
  const [test, setTest] = useState<PrepTest | null>(null)
  const [result, setResult] = useState<{ r: PrepResult; timeUp: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isStudent = user?.role === 'student'
  const history = useLoaded(useCallback((s: AbortSignal) => (isStudent ? accounts.prepHistory(s) : Promise.resolve([])), [isStudent, result]))
  const onDone = useCallback((r: PrepResult, timeUp: boolean) => { setResult({ r, timeUp }); setTest(null); window.scrollTo({ top: 0 }) }, [])

  if (!isStudent) {
    return (
      <section className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-3xl font-black text-ink">🎓 {c.title}</h1>
        <p className={CARD}>{c.guest} <a href={SECTION_HREFS.login} className="font-black text-brand-dark underline">{c.signIn}</a></p>
      </section>
    )
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      setResult(null)
      setTest(await accounts.startPrep(lang))
    } catch {
      setError(c.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black text-ink">🎓 {c.title}</h1>
        <p className="mt-1 font-semibold text-ink/80">{c.lead}</p>
      </div>
      {test ? <Test test={test} lang={lang} onDone={onDone} /> : result ? <Result result={result.r} timeUp={result.timeUp} lang={lang} onAgain={start} /> : (
        <section className={`${CARD} flex flex-col gap-3`}>
          <button type="button" disabled={busy} onClick={start} className={`${PRIMARY} self-start`}>{c.start}</button>
          {error && <p role="alert" className="font-bold text-rose-700">{error}</p>}
          <h2 className="mt-1 font-black text-ink">{c.history}</h2>
          {history.value?.length ? (
            <ul className="flex flex-wrap gap-2">
              {history.value.slice(0, 8).map((h) => (
                <li key={h.id} className="rounded-xl border-2 border-ink bg-sky-50 px-3 py-1 text-sm font-bold text-ink">
                  {new Date(h.at).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'short' })} · <b>{h.score}/{h.total}</b>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm font-semibold text-ink/70">{c.noHistory}</p>}
        </section>
      )}
      {!test && !result && <a href={SECTION_HREFS.myClass} className={`${SECONDARY} self-start`}>←</a>}
    </section>
  )
}
