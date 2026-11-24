import { useId, useState, type FormEvent } from 'react'
import { FamilyCodeCard } from './ParentScreen'
import type { Lang } from '../api'
import { useAccount } from '../account'
import { ACCOUNT_COPY } from '../accountCopy'
import { SECTION_HREFS } from '../route'
import { COSMETICS, isCosmetic } from '../cosmetics'
import { CARD, errorKey, FieldError, INPUT, PRIMARY, SECONDARY } from './AuthScreen'

// A student's profile: coins, stars, class and the class-code form.

export function ProfileScreen({ lang }: { lang: Lang }) {
  const c = ACCOUNT_COPY[lang]
  const { user, joinClass, logOut, title } = useAccount()
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!user || user.role !== 'student') return null
  const profile = user.profile

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setError(c.errors.class_not_found)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const me = await joinClass(code.trim())
      setJoined(me.schoolClass?.name ?? '')
      setCode('')
    } catch (err) {
      setError(c.errors[errorKey(err)] ?? c.errors.network)
      document.getElementById(`${id}-code`)?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <section className={CARD} aria-labelledby={`${id}-title`}>
        <h1 id={`${id}-title`} className="text-2xl font-black text-ink sm:text-3xl">{c.profile.title}</h1>
        <p className="mt-1 font-bold text-ink/80">{user.displayName} · <span className="font-mono">{user.login}</span></p>
        {title && isCosmetic(title) && <p className="hero-title mt-2">{COSMETICS[title].icon} {COSMETICS[title].name[lang]}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border-[3px] border-ink bg-sun/60 p-3">
            <dt className="text-sm font-black text-ink/80">{c.profile.coins}</dt>
            <dd className="text-3xl font-black text-ink"><span aria-hidden>🪙 </span>{profile?.coins ?? 0}</dd>
          </div>
          <div className="rounded-xl border-[3px] border-ink bg-sky p-3">
            <dt className="text-sm font-black text-ink/80">{c.profile.stars}</dt>
            <dd className="text-3xl font-black text-amber-600"><span aria-hidden>★ </span><span className="text-ink">{profile?.stars ?? 0}</span></dd>
          </div>
        </dl>
      </section>

      <section className={CARD} aria-labelledby={`${id}-class`}>
        <h2 id={`${id}-class`} className="text-xl font-black text-ink">{c.profile.classTitle}</h2>
        {user.schoolClass ? (
          <div className="mt-2">
            <p className="text-2xl font-black text-ink">{user.schoolClass.name}</p>
            {user.schoolClass.teacherName && <p className="font-semibold text-ink/80">{c.profile.teacher(user.schoolClass.teacherName)}</p>}
          </div>
        ) : (
          <p className="mt-2 font-semibold text-ink/85">{c.profile.noClass}</p>
        )}
        <form onSubmit={onJoin} noValidate className="mt-4 flex flex-col gap-2">
          <label htmlFor={`${id}-code`} className="text-sm font-black text-ink/80">{c.classCode}</label>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <input
              id={`${id}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={32}
              placeholder="KOKSH-5A-2026"
              autoCapitalize="characters"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-code-error` : undefined}
              className={`${INPUT} font-mono uppercase`}
            />
            <button type="submit" disabled={busy} className={`${PRIMARY} shrink-0`}>{busy ? c.working : c.profile.join}</button>
          </div>
          <FieldError id={`${id}-code-error`} message={error ?? undefined} />
          {joined !== null && <p role="status" className="rounded-xl border-2 border-emerald-700 bg-emerald-50 px-3 py-2 font-bold text-emerald-950">{c.profile.joined(joined)}</p>}
        </form>
      </section>

      <FamilyCodeCard lang={lang} />

      <div className="flex flex-wrap gap-2">
        <a href={SECTION_HREFS.map} className={PRIMARY}>{c.profile.play} <span aria-hidden>→</span></a>
        <button type="button" onClick={logOut} className={SECONDARY}>{c.signOut}</button>
      </div>
    </div>
  )
}
