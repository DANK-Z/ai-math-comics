import { useEffect, useState } from 'react'
import { classroomApi, isAbortError, type AssignmentReport, type ClassAssignment, type Lang } from '../api'
import { useAccount } from '../account'
import { ASSIGNMENT_COPY } from '../assignmentCopy'
import { comicHref } from '../route'

const CARD = 'min-w-0 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--color-ink)] sm:p-4'
const BADGE = 'w-fit rounded-lg border-2 border-ink px-2 py-1 font-bold'

function formattedDate(date: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date))
}

export function StudentAssignments({ lang }: { lang: Lang }) {
  const copy = ASSIGNMENT_COPY[lang]
  const { user } = useAccount()
  const studentClass = user?.role === 'student' ? user.schoolClass?.id : undefined
  const studentId = user?.id
  const [result, setResult] = useState<{ classId: number; studentId: number; lang: Lang; items: ClassAssignment[] } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const api = classroomApi
    if (!api || !studentClass || !studentId) return
    let inFlight: AbortController | null = null
    const refresh = () => {
      if (document.hidden || inFlight) return
      const ctrl = new AbortController()
      inFlight = ctrl
      api.assignments(lang, ctrl.signal).then((items) => {
        setResult({ classId: studentClass, studentId, lang, items })
        setError(false)
      }).catch((err) => {
        if (!isAbortError(err)) setError(true)
      }).finally(() => { inFlight = null })
    }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      inFlight?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [studentClass, lang, studentId])

  if (!classroomApi || !studentClass) return null
  const items = result?.classId === studentClass && result.studentId === studentId && result.lang === lang ? result.items : []
  return (
    <div aria-live="polite" className={items.length || error ? 'grid gap-3' : undefined}>
      {error && <p className="font-bold text-rose-800">{copy.error}</p>}
      {items.map((item) => (
        <a key={item.id} className={CARD + ' flex flex-wrap items-center gap-x-4 gap-y-2 bg-sun/40 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand'} href={comicHref(item.id)}>
          <span aria-hidden="true" className="text-2xl">🌟</span>
          <span className="min-w-0 flex-1 break-words">
            <span className="block text-sm font-black text-brand-dark">{copy.secret}</span>
            <span className="block text-lg font-black">{item.title}</span>
            {item.dueDate && <time dateTime={item.dueDate} className="text-sm font-semibold">{copy.dueShort} · {formattedDate(item.dueDate, lang)}</time>}
          </span>
          {item.completed && <span className={BADGE + ' bg-emerald-100'}>✓ {copy.completed}</span>}
          <span aria-hidden="true">→</span>
        </a>
      ))}
    </div>
  )
}

export function ClassAssignmentReports({ lang, classId }: { lang: Lang; classId: number }) {
  const copy = ASSIGNMENT_COPY[lang]
  const [reports, setReports] = useState<AssignmentReport[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    const api = classroomApi
    if (!api) return
    let inFlight: AbortController | null = null
    const refresh = () => {
      if (document.hidden || inFlight) return
      const ctrl = new AbortController()
      inFlight = ctrl
      api.assignmentReports(classId, lang, ctrl.signal).then((items) => {
        setReports(items)
        setError(false)
      }).catch((err) => {
        if (!isAbortError(err)) setError(true)
      }).finally(() => { inFlight = null })
    }
    refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => { inFlight?.abort(); window.clearInterval(interval) }
  }, [classId, lang])
  if (error) return <p role="alert">{copy.error}</p>
  if (!reports.length) return null
  return (
    <section className={CARD} aria-label={copy.report}>
      <h2 className="text-xl font-black">{copy.report}</h2>
      <div className="mt-3 grid gap-4">
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border-2 border-ink p-3">
            <h3 className="break-words text-lg font-black">{report.title}</h3>
            {report.dueDate && <time dateTime={report.dueDate} className="text-sm">{copy.dueShort} · {formattedDate(report.dueDate, lang)}</time>}
            {!report.students.length && <p>{copy.noStudents}</p>}
            <ul className="mt-2 grid gap-2">
              {report.students.map((student) => (
                <li key={student.id} className="grid gap-1 rounded-xl border-2 border-ink/20 p-2 sm:grid-cols-[1fr_auto]">
                  <span className="break-words font-bold">{student.name}</span>
                  <span className={BADGE + (!student.completed ? ' bg-white' : student.hints.length ? ' bg-sun/50' : ' bg-emerald-100')}>
                    {student.completed ? (student.hints.length ? copy.withHints : copy.independent) : copy.pending}
                  </span>
                  {!!student.hints.length && <span className="text-sm">{student.hints.map((step) => copy.hints[step - 1]).join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
