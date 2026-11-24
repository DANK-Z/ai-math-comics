import { useEffect, useId, useState, type FormEvent } from 'react'
import { accounts, isAbortError, type Lang, type PracticeReport, type StudentCredentials, type StudentRow } from '../api'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'

// Class page, «Ученики»: the teacher creates accounts for the class and gives a new password to
// a student who forgot theirs. Passwords are shown once (the server keeps only a hash), so the
// card offers a printable list of login cards right away.

export const ROSTER_COPY = {
  ru: {
    tab: 'Ученики',
    title: 'Аккаунты учеников',
    lead: 'Впишите имена — по одному в строке. Логин и простой пароль придумаются сами. Пароль виден только сейчас: распечатайте карточки или перепишите.',
    names: 'Имена учеников',
    placeholder: 'Аружан Бекова\nТимур Ахметов',
    create: 'Создать аккаунты',
    creating: 'Создаём…',
    made: 'Новые входы — раздайте ученикам',
    print: 'Распечатать карточки',
    login: 'Логин',
    password: 'Пароль',
    site: 'Сайт',
    list: 'Ученики класса',
    empty: 'В классе пока нет учеников.',
    reset: 'Новый пароль',
    resetting: '…',
    newPassword: (name: string, login: string, password: string) => `${name}: логин ${login}, новый пароль ${password}`,
    error: 'Не получилось. Проверьте имена: только буквы, без цифр.',
    report: 'Тренировки за 30 дней',
    reportLead: 'Кто повторял темы сам: начатые тренировки, решённые задачи и темы.',
    drills: (n: number, done: number) => `тренировок: ${n}, пройдено: ${done}`,
    solved: (n: number) => `задач решено: ${n}`,
    never: 'ещё не тренировался',
  },
  kk: {
    tab: 'Оқушылар',
    title: 'Оқушылардың аккаунттары',
    lead: 'Аттарды жазыңыз — әр жолға біреуден. Логин мен қарапайым құпиясөз өзі жасалады. Құпиясөз тек қазір көрінеді: карточкаларды басып шығарыңыз немесе көшіріп алыңыз.',
    names: 'Оқушылардың аттары',
    placeholder: 'Аружан Бекова\nТимур Ахметов',
    create: 'Аккаунттарды жасау',
    creating: 'Жасап жатырмыз…',
    made: 'Жаңа кірулер — оқушыларға таратыңыз',
    print: 'Карточкаларды басып шығару',
    login: 'Логин',
    password: 'Құпиясөз',
    site: 'Сайт',
    list: 'Сынып оқушылары',
    empty: 'Сыныпта әлі оқушы жоқ.',
    reset: 'Жаңа құпиясөз',
    resetting: '…',
    newPassword: (name: string, login: string, password: string) => `${name}: логин ${login}, жаңа құпиясөз ${password}`,
    error: 'Болмады. Аттарды тексеріңіз: тек әріптер, сансыз.',
    report: '30 күндегі жаттығулар',
    reportLead: 'Тақырыптарды кім өз бетінше қайталады: басталған жаттығулар, шығарылған есептер және тақырыптар.',
    drills: (n: number, done: number) => `жаттығу: ${n}, аяқталды: ${done}`,
    solved: (n: number) => `шығарылған есеп: ${n}`,
    never: 'әлі жаттықпаған',
  },
}

function printCards(lang: Lang, made: StudentCredentials[]) {
  const copy = ROSTER_COPY[lang]
  const site = `${window.location.origin}${window.location.pathname}`
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  const doc = win.document
  doc.title = copy.made
  const style = doc.createElement('style')
  style.textContent = 'body{font-family:system-ui,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}div{border:2px dashed #555;border-radius:12px;padding:12px;break-inside:avoid}b{font-size:18px}p{margin:6px 0;font-size:15px}code{font-size:18px;font-weight:700}'
  doc.head.append(style)
  for (const s of made) {
    const card = doc.createElement('div')
    const name = doc.createElement('b')
    name.textContent = s.displayName
    card.append(name)
    for (const [label, value] of [[copy.site, site], [copy.login, s.login], [copy.password, s.password]]) {
      const line = doc.createElement('p')
      line.append(`${label}: `)
      const code = doc.createElement('code')
      code.textContent = value
      line.append(code)
      card.append(line)
    }
    doc.body.append(card)
  }
  win.print()
}

export function RosterCard({ classId, lang, students }: { classId: number; lang: Lang; students: StudentRow[] }) {
  const copy = ROSTER_COPY[lang]
  const id = useId()
  const [names, setNames] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [made, setMade] = useState<StudentCredentials[]>([])
  const [roster, setRoster] = useState(() => students.map((s) => ({ id: s.id, displayName: s.displayName, login: s.login })))
  const [resetting, setResetting] = useState<number | null>(null)
  const [reset, setReset] = useState<StudentCredentials | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    const list = names.split('\n').map((n) => n.trim()).filter(Boolean)
    if (!list.length || busy) return
    setBusy(true)
    setError(false)
    try {
      const result = await accounts.createStudents(classId, list)
      setMade((prev) => [...prev, ...result])
      setRoster((prev) => [...prev, ...result.map(({ id, displayName, login }) => ({ id, displayName, login }))])
      setNames('')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function newPassword(studentId: number) {
    setResetting(studentId)
    try {
      setReset(await accounts.resetStudentPassword(classId, studentId))
    } catch {
      setError(true)
    } finally {
      setResetting(null)
    }
  }

  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🧑‍🎓</span>{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      <form onSubmit={create} className="mt-3 flex flex-col gap-2">
        <label htmlFor={`${id}-names`} className="text-sm font-black text-ink/80">{copy.names}</label>
        <textarea id={`${id}-names`} value={names} onChange={(e) => setNames(e.target.value)} rows={4} placeholder={copy.placeholder}
          className="w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink outline-none focus-visible:ring-4 focus-visible:ring-sun" />
        <button type="submit" disabled={busy || !names.trim()} className={`${PRIMARY} self-start`}>{busy ? copy.creating : copy.create}</button>
        {error && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}
      </form>

      {made.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-ink bg-sun/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black text-ink">{copy.made}</h3>
            <button type="button" onClick={() => printCards(lang, made)} className={SECONDARY}>🖨️ {copy.print}</button>
          </div>
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="text-ink/70"><th className="py-1">✓</th><th>{copy.login}</th><th>{copy.password}</th></tr></thead>
            <tbody>
              {made.map((s) => (
                <tr key={s.id} className="border-t border-ink/20 font-bold">
                  <td className="py-1.5 pr-2">{s.displayName}</td>
                  <td className="pr-2 font-mono">{s.login}</td>
                  <td className="font-mono">{s.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-5 font-black text-ink">{copy.list}</h3>
      {reset && <p role="status" className="mt-2 rounded-xl bg-emerald-100 p-2.5 font-bold text-emerald-900">🔑 {copy.newPassword(reset.displayName, reset.login, reset.password)}</p>}
      {roster.length === 0 ? <p className="mt-1 font-semibold text-ink/75">{copy.empty}</p> : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {roster.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink/20 px-3 py-1.5">
              <span className="min-w-0 flex-1 font-bold text-ink">{s.displayName} <span className="font-mono text-sm text-ink/65">{s.login}</span></span>
              <button type="button" onClick={() => newPassword(s.id)} disabled={resetting !== null}
                className="min-h-9 rounded-lg border-2 border-ink bg-white px-2.5 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {resetting === s.id ? copy.resetting : `🔑 ${copy.reset}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Class page: who practised on their own over the last 30 days. */
export function PracticeReportCard({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = ROSTER_COPY[lang]
  const topics = CLASSROOM_COPY[lang].board.topics
  const id = useId()
  const [report, setReport] = useState<PracticeReport | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    accounts.practiceReport(classId, ctrl.signal).then(setReport, (err) => { if (!isAbortError(err)) setReport(null) })
    return () => ctrl.abort()
  }, [classId])
  if (!report) return null
  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🎯</span>{copy.report}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.reportLead}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {report.students.map((s) => (
          <li key={s.id} className="rounded-xl border-2 border-ink/20 px-3 py-2">
            <p className="font-black text-ink">{s.displayName}</p>
            {s.drills === 0 ? <p className="text-sm font-semibold text-ink/60">{copy.never}</p> : (
              <p className="text-sm font-semibold text-ink/80">
                {copy.drills(s.drills, s.finished)} · {copy.solved(s.solved)}
                {Object.keys(s.topics).length > 0 && ` · ${Object.entries(s.topics).map(([t, n]) => `${topics[t as keyof typeof topics] ?? t}: ${n}`).join(', ')}`}
                {s.lastAt && ` · ${new Date(s.lastAt).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU')}`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
