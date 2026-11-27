import { Fragment, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { accounts, isAbortError, type ClassSummary, type HomeworkItem, type Lang, type PracticeReport, type PupilStat, type StudentCredentials, type StudentRow } from '../api'
import { CARD, PRIMARY } from './AuthScreen'
import { pct, topicRows } from './ClassAnalytics'
import { dayMonth } from '../dates'
import { printCards, ROSTER_COPY } from './RosterCard'
import { StudentCardDialog } from './StudentCardDialog'

// Class page, «Ученики»: everyone in one list with what matters about them this week
// (activity, accuracy, homework, own drills), a search and quick filters, and per-student
// actions: the card, a new password (shown once, with a printable login card), removal from
// the class. New accounts are added in a side panel.

const COPY = {
  ru: {
    title: (n: number) => `Ученики класса · ${n}`,
    search: 'Найти ученика',
    filters: { all: 'Все', help: 'Нужна помощь', idle: 'Не заходили', homework: 'Должны домашку' },
    cols: { name: 'Ученик', week: 'За неделю', homework: 'Домашка', drills: 'Сами тренировались', actions: 'Действия' },
    idle: 'не заходил',
    lastSeen: (d: string) => `был ${d}`,
    accuracy: (p: number, n: number) => `${p}% · ${n} отв.`,
    noAnswers: 'нет ответов',
    hw: (done: number, total: number) => `${done} из ${total}`,
    hwNone: '—',
    drills: (n: number, solved: number) => (n ? `${n} трен. · ${solved} задач` : '—'),
    card: 'Карточка',
    password: 'Пароль',
    remove: 'Убрать',
    removeConfirm: (name: string) => `Убрать «${name}» из класса? Он потеряет доступ к урокам, батлам и заданиям класса. Аккаунт останется.`,
    newPassword: 'Новый пароль — виден только сейчас',
    printOne: '🖨️ Карточка входа',
    copy: 'Скопировать',
    copied: '✓',
    nobody: 'Никого не нашли.',
    add: '➕ Добавить учеников',
    error: 'Не получилось. Попробуйте ещё раз.',
  },
  kk: {
    title: (n: number) => `Сынып оқушылары · ${n}`,
    search: 'Оқушыны табу',
    filters: { all: 'Барлығы', help: 'Көмек керек', idle: 'Кірмегендер', homework: 'Үй жұмысы қалған' },
    cols: { name: 'Оқушы', week: 'Апта ішінде', homework: 'Үй жұмысы', drills: 'Өз бетінше жаттықты', actions: 'Әрекеттер' },
    idle: 'кірмеген',
    lastSeen: (d: string) => `${d} кірген`,
    accuracy: (p: number, n: number) => `${p}% · ${n} жауап`,
    noAnswers: 'жауап жоқ',
    hw: (done: number, total: number) => `${total}-ден ${done}`,
    hwNone: '—',
    drills: (n: number, solved: number) => (n ? `${n} жаттығу · ${solved} есеп` : '—'),
    card: 'Карточка',
    password: 'Құпиясөз',
    remove: 'Шығару',
    removeConfirm: (name: string) => `«${name}» сыныптан шығарылсын ба? Ол сабақтарға, шайқастарға және сынып тапсырмаларына кіре алмайды. Аккаунт сақталады.`,
    newPassword: 'Жаңа құпиясөз — тек қазір көрінеді',
    printOne: '🖨️ Кіру карточкасы',
    copy: 'Көшіру',
    copied: '✓',
    nobody: 'Ешкім табылмады.',
    add: '➕ Оқушыларды қосу',
    error: 'Болмады. Қайта көріңіз.',
  },
}

type Filter = keyof (typeof COPY)['ru']['filters']

interface Row {
  id: number
  displayName: string
  login: string
  pupil?: PupilStat
  hwDone: number
  hwTotal: number
  drills: number
  solved: number
}

const shortName = (name: string) => {
  const [first, second] = name.trim().split(/\s+/)
  return second ? `${first} ${second[0]}.` : first
}

/** A minimal stat line for a student the summary has not seen (the card still opens). */
const emptyPupil = (id: number, name: string): PupilStat => ({ id, name, answers: 0, correct: 0, solved: 0, chapters: 0, activeDays: 0, lastActive: null, lagging: true, topics: [], lessons: [] })

export function StudentsTab({ classId, lang, students }: { classId: number; lang: Lang; students: StudentRow[] }) {
  const copy = COPY[lang]
  const id = useId()
  const [roster, setRoster] = useState(() => students.map((s) => ({ id: s.id, displayName: s.displayName, login: s.login })))
  const [summary, setSummary] = useState<ClassSummary | null>(null)
  const [homework, setHomework] = useState<HomeworkItem[]>([])
  const [practice, setPractice] = useState<PracticeReport | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [card, setCard] = useState<PupilStat | null>(null)
  const [reset, setReset] = useState<StudentCredentials | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const quiet = (err: unknown) => { if (!isAbortError(err)) setError(true) }
    accounts.classSummary(classId, 7, ctrl.signal).then(setSummary, quiet)
    accounts.classHomework(classId, ctrl.signal).then(setHomework, quiet)
    accounts.practiceReport(classId, ctrl.signal).then(setPractice, quiet)
    return () => ctrl.abort()
  }, [classId])

  const rows: Row[] = useMemo(() => roster.map((s) => {
    const pupil = summary?.pupils.find((p) => p.id === s.id) ?? summary?.pupils.find((p) => p.name === shortName(s.displayName))
    const mine = homework.flatMap((h) => h.students.filter((st) => st.id === s.id))
    const drills = practice?.students.find((p) => p.id === s.id)
    return { ...s, pupil, hwDone: mine.filter((m) => m.done).length, hwTotal: mine.length, drills: drills?.drills ?? 0, solved: drills?.solved ?? 0 }
  }), [roster, summary, homework, practice])

  const needle = query.trim().toLowerCase()
  const counts: Record<Filter, number> = {
    all: rows.length,
    help: rows.filter((r) => r.pupil?.lagging).length,
    idle: rows.filter((r) => !r.pupil?.activeDays).length,
    homework: rows.filter((r) => r.hwDone < r.hwTotal).length,
  }
  const shown = rows
    .filter((r) => !needle || r.displayName.toLowerCase().includes(needle) || r.login.toLowerCase().includes(needle))
    .filter((r) => filter === 'all' || (filter === 'help' ? r.pupil?.lagging : filter === 'idle' ? !r.pupil?.activeDays : r.hwDone < r.hwTotal))
    .sort((a, b) => Number(!!b.pupil?.lagging) - Number(!!a.pupil?.lagging) || a.displayName.localeCompare(b.displayName))

  async function newPassword(row: Row) {
    setBusy(row.id)
    setError(false)
    try {
      setReset(await accounts.resetStudentPassword(classId, row.id))
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(copy.removeConfirm(row.displayName))) return
    setBusy(row.id)
    setError(false)
    try {
      // Demo classmates (negative ids) only disappear from this list.
      if (row.id > 0) await accounts.removeStudent(classId, row.id)
      setRoster((list) => list.filter((s) => s.id !== row.id))
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const rowsForCard = summary ? topicRows(summary, lang) : []
  const small = 'rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-50'

  const openCard = (r: (typeof shown)[number]) => setCard(r.pupil ?? emptyPupil(r.id, shortName(r.displayName)))
  const week = (p: (typeof shown)[number]['pupil']) => {
    const accuracy = p ? pct(p.correct, p.answers) : 0
    return (
      <>
        {!p?.activeDays ? <span className="font-bold text-orange-800">{copy.idle}</span> : (
          <span className="flex items-center gap-2">
            <span className="h-2 w-14 shrink-0 overflow-hidden rounded-full border border-ink/50 bg-white" aria-hidden>
              <span className={`block h-full ${accuracy >= 80 ? 'bg-[#16a36a]' : accuracy < 60 ? 'bg-[#fb9a3c]' : 'bg-[#f5c542]'}`} style={{ width: `${p.answers ? Math.max(6, accuracy) : 0}%` }} />
            </span>
            <span className="font-bold text-ink tabular-nums">{p.answers ? copy.accuracy(accuracy, p.answers) : copy.noAnswers}</span>
          </span>
        )}
        {p?.lastActive && <span className="block text-xs text-ink/55">{copy.lastSeen(dayMonth(new Date(p.lastActive), lang))}</span>}
      </>
    )
  }
  const actions = (r: (typeof shown)[number]) => (
    <span className="flex flex-wrap gap-1">
      <button type="button" className={small} onClick={() => openCard(r)}>📋 {copy.card}</button>
      <button type="button" className={small} disabled={busy !== null} onClick={() => newPassword(r)}>{busy === r.id ? '…' : `🔑 ${copy.password}`}</button>
      <button type="button" className={`${small} hover:bg-rose-50`} disabled={busy !== null} onClick={() => remove(r)}>✕ {copy.remove}</button>
    </span>
  )
  const resetNote = (r: (typeof shown)[number]) => reset?.id === r.id && (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 p-2.5 text-sm font-bold text-emerald-900">
      <span>🔑 {copy.newPassword}:</span>
      <span><code className="font-mono">{reset.login}</code> / <code className="font-mono text-base">{reset.password}</code></span>
      <span className="flex-1" />
      <button type="button" className={small} onClick={() => printCards(lang, [reset])}>{copy.printOne}</button>
      <button type="button" className={small} onClick={() => setReset(null)} aria-label="×">×</button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className={`${CARD} min-w-0`} aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🧑‍🎓</span>{copy.title(rows.length)}</h2>
          <span className="flex-1" />
          <label htmlFor={`${id}-search`} className="sr-only">{copy.search}</label>
          <input id={`${id}-search`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`🔍 ${copy.search}`}
            className="min-h-10 w-full rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-semibold text-ink focus-visible:ring-4 focus-visible:ring-sun sm:w-56" />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={copy.filters.all}>
          {(Object.keys(copy.filters) as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={`rounded-full border-2 px-3 py-0.5 text-sm font-black ${filter === f ? 'border-ink bg-sun text-ink' : 'border-ink/30 text-ink/80 hover:bg-sky'} ${f !== 'all' && counts[f] ? (f === 'help' ? 'text-orange-800' : '') : ''}`}>
              {copy.filters[f]} <span className="tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-2 font-bold text-rose-700">{copy.error}</p>}

        {shown.length === 0 ? <p className="mt-3 font-semibold text-ink/70">{copy.nobody}</p> : (
          <>
          {/* Phones: one card per student instead of a wide table. */}
          <ul className="mt-3 flex flex-col gap-2 md:hidden">
            {shown.map((r) => (
              <li key={r.id} className={`flex flex-col gap-1.5 rounded-xl border-2 border-ink/15 p-2.5 text-sm ${r.pupil?.lagging ? 'bg-orange-50' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => openCard(r)} className="text-left font-black text-brand-dark underline decoration-2 underline-offset-2">
                      {r.pupil?.lagging ? '⚠️ ' : ''}{r.displayName}
                    </button>
                    <span className="block font-mono text-xs text-ink/60">{r.login}</span>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-black tabular-nums ${r.hwDone < r.hwTotal ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {copy.cols.homework}: {r.hwTotal ? copy.hw(r.hwDone, r.hwTotal) : copy.hwNone}
                  </span>
                </div>
                <div>{week(r.pupil)}</div>
                {r.drills > 0 && <p className="text-xs text-ink/75">{copy.cols.drills}: {copy.drills(r.drills, r.solved)}</p>}
                {actions(r)}
                {resetNote(r)}
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-xs text-ink/70">
                  {[copy.cols.name, copy.cols.week, copy.cols.homework, copy.cols.drills, copy.cols.actions].map((h) => (
                    <th key={h} scope="col" className="px-2 py-1 font-black">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const p = r.pupil
                  const accuracy = p ? pct(p.correct, p.answers) : 0
                  return (
                    <Fragment key={r.id}>
                    <tr className={`border-b border-ink/15 ${p?.lagging ? 'bg-orange-50' : ''}`}>
                      <th scope="row" className="px-2 py-1.5 font-normal">
                        <button type="button" onClick={() => setCard(p ?? emptyPupil(r.id, shortName(r.displayName)))}
                          className="block text-left font-black text-brand-dark underline decoration-2 underline-offset-2 hover:text-ink focus-visible:outline-3 focus-visible:outline-brand">
                          {p?.lagging ? '⚠️ ' : ''}{r.displayName}
                        </button>
                        <span className="font-mono text-xs text-ink/60">{r.login}</span>
                      </th>
                      <td className="px-2 py-1.5">
                        {!p?.activeDays ? <span className="font-bold text-orange-800">{copy.idle}</span> : (
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-14 overflow-hidden rounded-full border border-ink/50 bg-white" aria-hidden>
                              <span className={`block h-full ${accuracy >= 80 ? 'bg-[#16a36a]' : accuracy < 60 ? 'bg-[#fb9a3c]' : 'bg-[#f5c542]'}`} style={{ width: `${p.answers ? Math.max(6, accuracy) : 0}%` }} />
                            </span>
                            <span className="font-bold text-ink tabular-nums">{p.answers ? copy.accuracy(accuracy, p.answers) : copy.noAnswers}</span>
                          </span>
                        )}
                        {p?.lastActive && <span className="block text-xs text-ink/55">{copy.lastSeen(dayMonth(new Date(p.lastActive), lang))}</span>}
                      </td>
                      <td className={`px-2 py-1.5 font-bold tabular-nums ${r.hwDone < r.hwTotal ? 'text-orange-800' : 'text-emerald-800'}`}>
                        {r.hwTotal ? copy.hw(r.hwDone, r.hwTotal) : copy.hwNone}
                      </td>
                      <td className="px-2 py-1.5 text-ink/80">{copy.drills(r.drills, r.solved)}</td>
                      <td className="px-2 py-1.5">
                        <span className="flex flex-wrap gap-1">
                          <button type="button" className={small} onClick={() => setCard(p ?? emptyPupil(r.id, shortName(r.displayName)))}>📋 {copy.card}</button>
                          <button type="button" className={small} disabled={busy !== null} onClick={() => newPassword(r)}>{busy === r.id ? '…' : `🔑 ${copy.password}`}</button>
                          <button type="button" className={`${small} hover:bg-rose-50`} disabled={busy !== null} onClick={() => remove(r)}>✕ {copy.remove}</button>
                        </span>
                      </td>
                    </tr>
                    {reset?.id === r.id && (
                      <tr>
                        <td colSpan={5} className="px-2 pb-2">
                          <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 p-2.5 text-sm font-bold text-emerald-900">
                            <span>🔑 {copy.newPassword}:</span>
                            <span><code className="font-mono">{reset.login}</code> / <code className="font-mono text-base">{reset.password}</code></span>
                            <span className="flex-1" />
                            <button type="button" className={small} onClick={() => printCards(lang, [reset])}>{copy.printOne}</button>
                            <button type="button" className={small} onClick={() => setReset(null)} aria-label="×">×</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <AddStudents classId={classId} lang={lang} onAdded={(made) => setRoster((list) => [...list, ...made.map(({ id, displayName, login }) => ({ id, displayName, login }))])} />

      {card && <StudentCardDialog classId={classId} pupil={card} days={7} rows={rowsForCard} lang={lang} onClose={() => setCard(null)} />}
    </div>
  )
}

/** Side panel: new accounts from a list of names, with printable login cards. */
function AddStudents({ classId, lang, onAdded }: { classId: number; lang: Lang; onAdded: (made: StudentCredentials[]) => void }) {
  const copy = ROSTER_COPY[lang]
  const id = useId()
  const [names, setNames] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [made, setMade] = useState<StudentCredentials[]>([])

  async function create(e: FormEvent) {
    e.preventDefault()
    const list = names.split('\n').map((n) => n.trim()).filter(Boolean)
    if (!list.length || busy) return
    setBusy(true)
    setError(false)
    try {
      const result = await accounts.createStudents(classId, list)
      setMade((prev) => [...prev, ...result])
      onAdded(result)
      setNames('')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-black text-ink">{COPY[lang].add}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      <form onSubmit={create} className="mt-2 flex flex-col gap-2">
        <label htmlFor={`${id}-names`} className="sr-only">{copy.names}</label>
        <textarea id={`${id}-names`} value={names} onChange={(e) => setNames(e.target.value)} rows={4} placeholder={copy.placeholder}
          className="w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink outline-none focus-visible:ring-4 focus-visible:ring-sun" />
        <button type="submit" disabled={busy || !names.trim()} className={`${PRIMARY} self-start`}>{busy ? copy.creating : copy.create}</button>
        {error && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}
      </form>
      {made.length > 0 && (
        <div className="mt-3 rounded-xl border-2 border-ink bg-sun/30 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-ink">{copy.made}</h3>
            <button type="button" onClick={() => printCards(lang, made)} className="rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-black text-ink hover:bg-sky">🖨️ {copy.print}</button>
          </div>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {made.map((s) => (
              <li key={s.id} className="font-bold text-ink">{s.displayName}: <code className="font-mono">{s.login}</code> / <code className="font-mono">{s.password}</code></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
