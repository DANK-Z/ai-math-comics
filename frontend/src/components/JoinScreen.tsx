import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Lang } from '../api'
import { useAccount } from '../account'
import { rememberAfterLogin } from '../afterLogin'
import { SECTION_HREFS } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { PifikSprite } from './PifikSprite'

// #/join/{CODE}?to=battle|lesson — the QR on a class board. A student types only their name;
// the phone keeps a random key that is the new account's password, so next time the same
// phone gets in by itself. Students who already have an account just sign in.

const STORE = 'amc.quickJoin'

type Saved = Record<string, { login: string; key: string }>

function readSaved(): Saved {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORE) ?? '{}')
    return value && typeof value === 'object' ? (value as Saved) : {}
  } catch {
    return {}
  }
}

function save(code: string, login: string, key: string) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readSaved(), [code]: { login, key } }))
  } catch {
    // Without storage the student types the name again next time.
  }
}

function forget(code: string) {
  const saved = readSaved()
  delete saved[code]
  try {
    localStorage.setItem(STORE, JSON.stringify(saved))
  } catch {
    // Nothing to forget.
  }
}

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const COPY = {
  ru: {
    title: 'Входим в класс',
    name: 'Как тебя зовут?',
    hint: 'Имя и фамилия, как в журнале. Учитель увидит тебя в списке класса.',
    go: 'Войти',
    going: 'Входим…',
    signing: 'Входим с этого телефона…',
    other: 'У меня уже есть аккаунт',
    join: (name: string) => `Ты вошёл как ${name}. Вступить в этот класс?`,
    joinGo: 'Вступить и продолжить',
    teacher: 'Вы вошли как учитель. Ученики сканируют этот код со своих телефонов.',
    errors: {
      class_not_found: 'Класс не найден. Отсканируй код с доски ещё раз.',
      validation: 'Напиши имя буквами, без цифр.',
      sign_in_rate_limited: 'Слишком много входов подряд. Подожди минуту.',
      network: 'Нет связи. Попробуй ещё раз.',
    } as Record<string, string>,
  },
  kk: {
    title: 'Сыныпқа кіреміз',
    name: 'Атың кім?',
    hint: 'Журналдағыдай атың мен тегің. Мұғалім сені сынып тізімінде көреді.',
    go: 'Кіру',
    going: 'Кіріп жатырмыз…',
    signing: 'Осы телефоннан кіріп жатырмыз…',
    other: 'Менде аккаунт бар',
    join: (name: string) => `Сен ${name} ретінде кірдің. Осы сыныпқа қосыласың ба?`,
    joinGo: 'Қосылып, жалғастыру',
    teacher: 'Сіз мұғалім ретінде кірдіңіз. Оқушылар бұл кодты өз телефондарынан сканерлейді.',
    errors: {
      class_not_found: 'Сынып табылмады. Тақтадағы кодты қайта сканерле.',
      validation: 'Атыңды әріппен, сансыз жаз.',
      sign_in_rate_limited: 'Тым көп кіру әрекеті. Бір минут күте тұр.',
      network: 'Байланыс жоқ. Қайта көр.',
    } as Record<string, string>,
  },
}

const errorCode = (err: unknown) => {
  const e = err as { status?: number; detail?: string | null; code?: string }
  if (e.status === 404) return 'class_not_found'
  if (e.status === 422) return 'validation'
  if (e.status === 429) return 'sign_in_rate_limited'
  return 'network'
}

export function JoinScreen({ lang, code, to }: { lang: Lang; code: string; to: 'battle' | 'lesson' }) {
  const copy = COPY[lang]
  const account = useAccount()
  const { user, ready } = account
  const target = to === 'lesson' ? SECTION_HREFS.lesson : SECTION_HREFS.battle
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tried = useRef(false)
  const id = useId()

  // Already in this class: straight to the board's activity. A saved phone key: sign in.
  useEffect(() => {
    if (!ready) return
    if (user?.role === 'student' && user.schoolClass?.code === code) {
      window.location.hash = target
      return
    }
    const saved = readSaved()[code]
    if (!user && saved && !tried.current) {
      tried.current = true
      setAuto(true)
      account.logIn(saved.login, saved.key).then(
        () => { window.location.hash = target },
        () => { forget(code); setAuto(false) },
      )
    }
  }, [ready, user, code, target, account])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    const key = newKey()
    try {
      const me = await account.quickJoin({ classCode: code, displayName: name.trim(), deviceKey: key })
      if (me.login) save(code, me.login, key)
      window.location.hash = target
    } catch (err) {
      setError(copy.errors[errorCode(err)])
      setBusy(false)
    }
  }

  async function joinClass() {
    setBusy(true)
    try {
      await account.joinClass(code)
      window.location.hash = target
    } catch (err) {
      setError(copy.errors[errorCode(err)])
      setBusy(false)
    }
  }

  const header = (
    <div className="flex items-center gap-3">
      <PifikSprite eager className="w-14 shrink-0 rounded-2xl border-[3px] border-ink bg-sky-100" />
      <h1 className="text-3xl font-black text-ink">{copy.title}</h1>
    </div>
  )
  if (!ready || auto) return <div className="flex max-w-md flex-col gap-4">{header}<p aria-busy="true" className="font-bold text-ink/70">{copy.signing}</p></div>
  if (user?.role === 'teacher') return <div className="flex max-w-md flex-col gap-4">{header}<p className={CARD}>{copy.teacher}</p></div>
  if (user?.role === 'student') {
    return (
      <div className="flex max-w-md flex-col gap-4">
        {header}
        <div className={CARD}>
          <p className="font-bold text-ink">{copy.join(user.displayName)}</p>
          <button type="button" onClick={joinClass} disabled={busy} className={`${PRIMARY} mt-3`}>{copy.joinGo}</button>
          {error && <p role="alert" className="mt-2 font-bold text-rose-700">{error}</p>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex max-w-md flex-col gap-4">
      {header}
      <form onSubmit={submit} className={`${CARD} flex flex-col gap-3`}>
        <label htmlFor={`${id}-name`} className="text-lg font-black text-ink">{copy.name}</label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus maxLength={60}
          aria-describedby={`${id}-hint`}
          className="min-h-12 w-full rounded-xl border-[3px] border-ink bg-white px-3 text-xl font-bold text-ink outline-none focus-visible:ring-4 focus-visible:ring-sun" />
        <p id={`${id}-hint`} className="text-sm font-semibold text-ink/70">{copy.hint}</p>
        <button type="submit" disabled={busy || !name.trim()} className={PRIMARY}>{busy ? copy.going : copy.go}</button>
        {error && <p role="alert" className="font-bold text-rose-700">{error}</p>}
      </form>
      <a href={SECTION_HREFS.login} onClick={() => rememberAfterLogin(target)} className={`${SECONDARY} self-start`}>{copy.other}</a>
    </div>
  )
}
