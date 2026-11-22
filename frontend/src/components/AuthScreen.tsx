import { useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, type Lang } from '../api'
import { useAccount } from '../account'
import { ACCOUNT_COPY } from '../accountCopy'
import { SECTION_HREFS } from '../route'

// Sign-in and sign-up for students (login + password) and teachers (e-mail + password).

export const CARD = 'rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--color-ink)] sm:p-6'
export const INPUT =
  'min-h-12 w-full min-w-0 rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink placeholder:font-normal placeholder:text-ink/50 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand aria-invalid:border-rose-600 aria-invalid:bg-rose-50'
export const PRIMARY =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-[3px] border-ink bg-sun px-5 font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 disabled:shadow-none'
export const SECONDARY =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-[3px] border-ink bg-white px-4 font-black text-ink shadow-[0_3px_0_var(--color-ink)] hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'
const CHOICE =
  'group relative flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-[3px] border-ink bg-white px-3 py-2 text-center font-black text-ink shadow-[0_3px_0_var(--color-ink)] select-none hover:bg-sky has-checked:translate-y-[2px] has-checked:bg-sun has-checked:shadow-[0_1px_0_var(--color-ink)] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand'

const LOGIN = /^[a-z0-9_.-]{3,24}$/
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,185}\.[a-z]{2,24}$/

export function errorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'network'
    if (e.status === 422) return 'validation'
    if (e.detail && /^[a-z_]+$/.test(e.detail)) return e.detail
  }
  return 'network'
}

type Field = 'displayName' | 'login' | 'email' | 'password' | 'classCode'

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-1 text-sm font-bold text-rose-700">{message}</p> : null
}

export function AuthScreen({ lang }: { lang: Lang }) {
  const c = ACCOUNT_COPY[lang]
  const account = useAccount()
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [values, setValues] = useState({ displayName: '', login: '', email: '', password: '', classCode: '' })
  const [invalid, setInvalid] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (field: Field) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value }))

  function validate(): Partial<Record<Field, string>> {
    const errors: Partial<Record<Field, string>> = {}
    if (mode === 'signUp') {
      const name = values.displayName.trim()
      if (!name || /[0-9_<>@]/.test(name)) errors.displayName = c.displayNameHint
      if (role === 'student' && !LOGIN.test(values.login.trim().toLowerCase())) errors.login = c.loginHint
      if (role === 'teacher' && !EMAIL.test(values.email.trim().toLowerCase())) errors.email = c.errors.validation
      if (values.password.length < 8) errors.password = c.passwordHint
    } else {
      if (!values.login.trim()) errors.login = c.errors.validation
      if (!values.password) errors.password = c.passwordHint
    }
    return errors
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errors = validate()
    setInvalid(errors)
    setError(null)
    if (Object.keys(errors).length) {
      // Focus after React has rendered the red fields.
      requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setBusy(true)
    try {
      const user =
        mode === 'signIn'
          ? await account.logIn(values.login.trim(), values.password)
          : role === 'student'
            ? await account.signUpStudent({
                login: values.login.trim().toLowerCase(),
                password: values.password,
                displayName: values.displayName.trim(),
                ...(values.classCode.trim() ? { classCode: values.classCode.trim() } : {}),
              })
            : await account.signUpTeacher({ email: values.email.trim(), password: values.password, displayName: values.displayName.trim() })
      window.location.hash = user.role === 'teacher' ? SECTION_HREFS.teacher : SECTION_HREFS.map
    } catch (err) {
      const key = errorKey(err)
      setError(c.errors[key] ?? c.errors.network)
      const field: Field | undefined = key === 'login_taken' ? 'login' : key === 'email_taken' ? 'email' : key === 'class_not_found' ? 'classCode' : key === 'wrong_login_or_password' ? 'password' : undefined
      if (field) {
        setInvalid({ [field]: c.errors[key] })
        requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus())
      }
    } finally {
      setBusy(false)
    }
  }

  function input(field: Field, label: string, props: { type?: string; hint?: string; autoComplete?: string; maxLength?: number; placeholder?: string } = {}) {
    const fieldId = `${id}-${field}`
    const message = invalid[field]
    const describedBy = [props.hint ? `${fieldId}-hint` : '', message ? `${fieldId}-error` : ''].filter(Boolean).join(' ') || undefined
    return (
      <div className="min-w-0">
        <label htmlFor={fieldId} className="mb-1 block text-sm font-black text-ink/80">{label}</label>
        <input
          id={fieldId}
          name={field}
          type={props.type ?? 'text'}
          value={values[field]}
          onChange={set(field)}
          autoComplete={props.autoComplete}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          aria-invalid={!!message || undefined}
          aria-describedby={describedBy}
          className={INPUT}
        />
        {props.hint && !message && <p id={`${fieldId}-hint`} className="mt-1 text-sm font-semibold text-ink/70">{props.hint}</p>}
        <FieldError id={`${fieldId}-error`} message={message} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <section className={CARD} aria-labelledby={`${id}-title`}>
        <h1 id={`${id}-title`} className="text-2xl font-black text-ink sm:text-3xl">{mode === 'signIn' ? c.signIn : c.signUp}</h1>
        <form ref={form} onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
          {mode === 'signUp' && (
            <fieldset>
              <legend className="mb-2 text-sm font-black text-ink/80">{c.who}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'teacher'] as const).map((r) => (
                  <label key={r} className={CHOICE}>
                    <input type="radio" name={`${id}-role`} className="sr-only" checked={role === r} onChange={() => { setRole(r); setInvalid({}) }} />
                    <span aria-hidden>{r === 'student' ? '🎒' : '🧑‍🏫'}</span>
                    <span className="text-sm leading-tight sm:text-base">{r === 'student' ? c.student : c.teacher}</span>
                    <span aria-hidden className="absolute -top-2 -right-2 hidden size-6 place-items-center rounded-full border-2 border-ink bg-white text-xs group-has-checked:grid">✓</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {mode === 'signUp' && input('displayName', c.displayName, { hint: c.displayNameHint, autoComplete: 'name', maxLength: 60 })}
          {mode === 'signIn' && input('login', c.loginOrEmail, { autoComplete: 'username', maxLength: 254 })}
          {mode === 'signUp' && role === 'student' && input('login', c.login, { hint: c.loginHint, autoComplete: 'username', maxLength: 24, placeholder: 'aruna_5a' })}
          {mode === 'signUp' && role === 'teacher' && input('email', c.email, { type: 'email', autoComplete: 'email', maxLength: 254 })}
          {input('password', c.password, { type: 'password', hint: mode === 'signUp' ? c.passwordHint : undefined, autoComplete: mode === 'signIn' ? 'current-password' : 'new-password', maxLength: 72 })}
          {mode === 'signUp' && role === 'student' && input('classCode', c.classCode, { hint: c.classCodeHint, maxLength: 32, placeholder: 'KOKSH-5A-2026' })}

          {error && <p role="alert" className="rounded-xl border-2 border-rose-600 bg-rose-50 px-3 py-2 font-bold text-rose-900">{error}</p>}
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? c.working : mode === 'signIn' ? c.submitSignIn : c.submitSignUp}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setInvalid({}); setError(null) }}
          className="mt-4 min-h-11 font-black text-brand-dark underline decoration-2 underline-offset-4 hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {mode === 'signIn' ? c.noAccount : c.haveAccount}
        </button>
      </section>
      <p className="rounded-xl border-2 border-ink/30 bg-cream px-3 py-2 text-sm font-semibold text-ink/85">{c.guestNote}</p>
    </div>
  )
}
