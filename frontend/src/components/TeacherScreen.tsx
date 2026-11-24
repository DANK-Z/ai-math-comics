import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { accounts, API_MODE, classroomApi, isAbortError, type AssignmentReport, type ClassInfo, type Dashboard, type Grade, type HeatCell, type Lang, type Topic } from '../api'
import { useAccount } from '../account'
import { ACCOUNT_COPY, skillCopy } from '../accountCopy'
import { GUARDIAN_SETUP, GUARDIAN_TOPICS, guardianAssignmentHref, type GuardianTopic } from '../guardianAssignment'
import { GUIDE_COPY } from '../guideCopy'
import { STRINGS } from '../i18n'
import { comicHref, teacherClassHref, SECTION_HREFS } from '../route'
import { SCHOOL_FAIR_STOPS } from '../schoolFair'
import { BattleLauncher, ReviewBattleButton } from './ClassBattle'
import { LessonLauncher } from './LessonScreens'
import { HomeworkCard } from './HomeworkCards'
import { TeacherLeague } from './ClassLeague'
import { CurriculumCard } from './CurriculumCard'
import { PracticeReportCard, RosterCard } from './RosterCard'
import { CARD, errorKey, FieldError, INPUT, PRIMARY, SECONDARY } from './AuthScreen'
import { ClassAssignmentReports } from './ClassAssignments'
import { TeacherWorkshop } from './TeacherWorkshop'

// Teacher area: classes with join codes, and a class dashboard (ranking + error heatmap).

const CHOICE =
  'group relative flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-[3px] border-ink bg-white px-3 font-black text-ink shadow-[0_3px_0_var(--shadow-ink)] select-none hover:bg-sky has-checked:translate-y-[2px] has-checked:bg-sun has-checked:shadow-[0_1px_0_var(--shadow-ink)] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand'

function CopyCode({ code, lang, large = false }: { code: string; lang: Lang; large?: boolean }) {
  const c = ACCOUNT_COPY[lang].teacherArea
  const [copied, setCopied] = useState(false)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className={`rounded-lg border-2 border-ink bg-cream px-2 py-1 font-mono font-black tracking-wide break-all text-ink ${large ? 'text-2xl' : 'text-base'}`}>{code}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false))}
        className="min-h-9 rounded-lg border-2 border-ink bg-white px-2.5 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {copied ? c.copied : c.copy}
      </button>
    </span>
  )
}

/** Class card summary: how the newest assignment went (live API only). */
function LatestAssignment({ classId, lang }: { classId: number; lang: Lang }) {
  const g = GUIDE_COPY[lang].teacher
  const [latest, setLatest] = useState<AssignmentReport | null | undefined>(undefined)
  useEffect(() => {
    const api = classroomApi
    if (!api) return
    const ctrl = new AbortController()
    api.assignmentReports(classId, lang, ctrl.signal).then((items) => setLatest(items[0] ?? null), (err) => {
      if (!isAbortError(err)) setLatest(undefined)
    })
    return () => ctrl.abort()
  }, [classId, lang])
  if (latest === undefined) return null
  if (latest === null) return <p className="text-sm font-semibold text-ink/75">{g.noAssignments}</p>
  const done = latest.students.filter((s) => s.completed).length
  const hinted = latest.students.filter((s) => s.hints.length > 0).length
  return (
    <div className="rounded-xl border-2 border-ink/60 bg-white p-2">
      <p className="text-xs font-black tracking-wide text-brand-dark uppercase">{g.latest}</p>
      <p className="font-black break-words text-ink">{latest.title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
        <li className="rounded-lg border-2 border-emerald-700 bg-emerald-100 px-2 py-0.5">{g.solved(done, latest.students.length)}</li>
        <li className="rounded-lg border-2 border-amber-600 bg-amber-100 px-2 py-0.5">{g.hints(hinted)}</li>
      </ul>
    </div>
  )
}

const ASSIGNMENT = {
  ru: { title: 'Задание по комиксу', chapter: 'Глава для класса', link: 'Ссылка для учеников', copy: 'Скопировать ссылку', copied: 'Ссылка скопирована.', manual: 'Скопируй выделенную ссылку.' },
  kk: { title: 'Комикс бойынша тапсырма', chapter: 'Сыныпқа арналған тарау', link: 'Оқушыларға арналған сілтеме', copy: 'Сілтемені көшіру', copied: 'Сілтеме көшірілді.', manual: 'Белгіленген сілтемені көшір.' },
}

function ChapterAssignment({ lang }: { lang: Lang }) {
  const copy = ASSIGNMENT[lang]
  const t = STRINGS[lang]
  const titleId = useId()
  const linkInput = useRef<HTMLInputElement>(null)
  const [chapter, setChapter] = useState(SCHOOL_FAIR_STOPS[0].comicId)
  const [status, setStatus] = useState<'copied' | 'manual' | null>(null)
  const link = new URL(comicHref(chapter), window.location.href).href

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setStatus('copied')
    } catch {
      linkInput.current?.focus()
      linkInput.current?.select()
      setStatus('manual')
    }
  }

  return (
    <section className={CARD} aria-labelledby={titleId}>
      <h2 id={titleId} className="text-xl font-black">{copy.title}</h2>
      <div className="mt-3 grid gap-3">
        <label className="grid min-w-0 gap-1 text-sm font-black">
          {copy.chapter}
          <select className={INPUT} value={chapter} onChange={(event) => {
            setChapter(event.target.value)
            setStatus(null)
          }}>
            {SCHOOL_FAIR_STOPS.map(({ comicId, number, location }) => (
              <option key={comicId} value={comicId}>{t.chapterLabel(number)} · {t.fairRoute.locations[location]}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-black">
          {copy.link}
          <input ref={linkInput} className={INPUT} type="url" readOnly value={link} />
        </label>
        <button type="button" onClick={copyLink} className={`${PRIMARY} w-fit`}>{copy.copy}</button>
        {status && <p role="status" className="text-sm font-bold">{copy[status]}</p>}
      </div>
    </section>
  )
}

function GuardianAssignmentForm({ lang }: { lang: Lang }) {
  const copy = GUARDIAN_SETUP[lang]
  const id = useId()
  const [selected, setSelected] = useState<GuardianTopic[]>([...GUARDIAN_TOPICS])
  const [variant, setVariant] = useState(0)
  const [boosts, setBoosts] = useState(true)
  const [status, setStatus] = useState<'copied' | 'manual' | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const topics = GUARDIAN_TOPICS.filter((topic) => selected.includes(topic))
  const link = topics.length ? new URL(guardianAssignmentHref({ topics, variant, boosts }), window.location.href).href : ''

  async function copyAssignment() {
    try {
      await navigator.clipboard.writeText(link)
      setStatus('copied')
    } catch {
      linkRef.current?.focus()
      linkRef.current?.select()
      setStatus('manual')
    }
  }

  return (
    <section className={CARD} aria-labelledby={id}>
      <h2 id={id} className="text-xl font-black">{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold">{copy.lead}</p>
      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="font-bold">{copy.topics}</legend>
        {GUARDIAN_TOPICS.map((topic) => (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink px-3 font-bold has-checked:bg-sun" key={topic}>
            <input type="checkbox" checked={selected.includes(topic)} onChange={(event) => {
              setStatus(null)
              setSelected((items) => event.target.checked ? [...items, topic] : items.filter((item) => item !== topic))
            }} />{copy.topicNames[topic]}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 grid gap-2">
        <label className="grid gap-1 font-bold">
          {copy.preset}
          <select className={INPUT} value={variant} onChange={(event) => { setVariant(Number(event.target.value)); setStatus(null) }}>
            {copy.numbers.map((label, index) => <option key={index} value={index}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 font-bold">
          <input type="checkbox" checked={boosts} onChange={(event) => { setBoosts(event.target.checked); setStatus(null) }} />{copy.boosts}
        </label>
        <label className="grid gap-1 font-bold">{copy.link}<input ref={linkRef} className={INPUT} readOnly value={link} /></label>
        <button type="button" disabled={!link} onClick={copyAssignment} className={`${PRIMARY} w-fit`}>{copy.copy}</button>
        {status && <p role="status" className="text-sm font-bold">{copy[status]}</p>}
      </div>
    </section>
  )
}

function NewClassForm({ lang, onCreated }: { lang: Lang; onCreated: (c: ClassInfo) => void }) {
  const c = ACCOUNT_COPY[lang]
  const id = useId()
  const [grade, setGrade] = useState<Grade>(5)
  const [letter, setLetter] = useState('А')
  const [school, setSchool] = useState('KOKSH')
  const [error, setError] = useState<{ field: 'letter' | 'school' | null; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const l = letter.trim().toUpperCase()
    const s = school.trim().toUpperCase()
    if (!/^[A-ZА-ЯЁӘҒҚҢӨҰҮІ]$/.test(l)) {
      setError({ field: 'letter', message: c.teacherArea.letterHint })
      document.getElementById(`${id}-letter`)?.focus()
      return
    }
    if (!/^[A-Z]{2,8}$/.test(s)) {
      setError({ field: 'school', message: c.teacherArea.schoolHint })
      document.getElementById(`${id}-school`)?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      onCreated(await accounts.createClass({ grade, letter: l, school: s }))
    } catch (err) {
      setError({ field: null, message: c.errors[errorKey(err)] ?? c.errors.network })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <fieldset>
        <legend className="mb-1 text-sm font-black text-ink/80">{c.teacherArea.grade}</legend>
        <div className="grid grid-cols-2 gap-2">
          {([5, 6] as const).map((g) => (
            <label key={g} className={CHOICE}>
              <input type="radio" name={`${id}-grade`} className="sr-only" checked={grade === g} onChange={() => setGrade(g)} />
              {g}
              <span aria-hidden className="absolute -top-2 -right-2 hidden size-6 place-items-center rounded-full border-2 border-ink bg-white text-xs group-has-checked:grid">✓</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 min-[420px]:grid-cols-[6rem_minmax(0,1fr)]">
        <div>
          <label htmlFor={`${id}-letter`} className="mb-1 block text-sm font-black text-ink/80">{c.teacherArea.letter}</label>
          <input id={`${id}-letter`} value={letter} maxLength={1} onChange={(e) => setLetter(e.target.value)} aria-invalid={error?.field === 'letter' || undefined} aria-describedby={error?.field === 'letter' ? `${id}-error` : undefined} className={`${INPUT} text-center text-xl uppercase`} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-school`} className="mb-1 block text-sm font-black text-ink/80">{c.teacherArea.school}</label>
          <input id={`${id}-school`} value={school} maxLength={8} onChange={(e) => setSchool(e.target.value)} aria-invalid={error?.field === 'school' || undefined} aria-describedby={`${id}-school-hint${error?.field === 'school' ? ` ${id}-error` : ''}`} className={`${INPUT} font-mono uppercase`} />
          <p id={`${id}-school-hint`} className="mt-1 text-sm font-semibold text-ink/70">{c.teacherArea.schoolHint}</p>
        </div>
      </div>
      <FieldError id={`${id}-error`} message={error?.message} />
      <button type="submit" disabled={busy} className={PRIMARY}>{busy ? c.working : c.teacherArea.create}</button>
    </form>
  )
}

export function TeacherHome({ lang }: { lang: Lang }) {
  const c = ACCOUNT_COPY[lang]
  const { user, logOut } = useAccount()
  const id = useId()
  const [classes, setClasses] = useState<ClassInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    accounts.listClasses().then(setClasses, (err) => setError(c.errors[errorKey(err)] ?? c.errors.network))
  }, [c])
  useEffect(load, [load])

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD} aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id={`${id}-title`} className="text-2xl font-black text-ink sm:text-3xl">{c.teacherArea.title}</h1>
            <p className="mt-1 font-semibold text-ink/80">{user?.displayName} · {user?.email}</p>
          </div>
          <button type="button" onClick={logOut} className={SECONDARY}>{c.signOut}</button>
        </div>
        <p className="mt-3 font-semibold text-ink/85">{c.teacherArea.lead}</p>
        {API_MODE === 'mock' && <p className="mt-2 rounded-lg bg-sun/40 px-2 py-1 text-sm font-bold text-ink">{c.teacherArea.demo}</p>}
      </section>

      {user && <TeacherWorkshop key={user.id} lang={lang} classes={classes ?? []} teacherId={user.id} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={CARD} aria-labelledby={`${id}-classes`}>
          <h2 id={`${id}-classes`} className="text-xl font-black text-ink">{c.teacherArea.classes}</h2>
          {error && <p role="alert" className="mt-2 font-bold text-rose-700">{error}</p>}
          {classes?.length === 0 && <p className="mt-2 font-semibold text-ink/80">{c.teacherArea.noClasses}</p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {classes?.map((cl) => (
              <li key={cl.id} className="flex flex-col gap-2 rounded-2xl border-[3px] border-ink bg-sky/60 p-3">
                <p className="text-2xl font-black text-ink">{cl.name}</p>
                <p className="text-sm font-bold text-ink/80">{c.teacherArea.students(cl.students ?? 0)}</p>
                {cl.students ? (
                  <>
                    <CopyCode code={cl.code} lang={lang} />
                    <LatestAssignment classId={cl.id} lang={lang} />
                  </>
                ) : (
                  // Nobody has joined yet: the code is the one thing the teacher needs.
                  <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-ink/50 bg-white/80 p-2">
                    <p className="text-sm font-bold text-ink">{GUIDE_COPY[lang].teacher.waiting}</p>
                    <CopyCode code={cl.code} lang={lang} large />
                    <p className="text-xs font-semibold text-ink/70">{GUIDE_COPY[lang].teacher.shareCode}</p>
                  </div>
                )}
                <a href={teacherClassHref(cl.id)} className={`${PRIMARY} mt-1`}>{c.teacherArea.open} <span aria-hidden>→</span></a>
              </li>
            ))}
          </ul>
        </section>
        <section className={CARD} aria-labelledby={`${id}-new`}>
          <h2 id={`${id}-new`} className="mb-3 text-xl font-black text-ink">{c.teacherArea.newClass}</h2>
          <NewClassForm lang={lang} onCreated={(cl) => setClasses((list) => [...(list ?? []), cl])} />
        </section>
      </div>
    </div>
  )
}

const HEAT = (rate: number) => (rate >= 0.6 ? 'bg-rose-200 border-rose-700' : rate >= 0.3 ? 'bg-amber-100 border-amber-600' : 'bg-emerald-100 border-emerald-700')
const CLASS_SECTIONS = ['overview', 'roster', 'assignments', 'games'] as const
const CLASS_DASHBOARD = {
  ru: {
    overview: 'Аналитика', roster: 'Ученики', assignments: 'Задания', games: 'Бои и лига',
    section: 'Разделы класса', students: 'Учеников в классе', finished: 'Победили хотя бы одного босса',
    empty: 'Статистика появится после первых проверенных ответов учеников.',
    first: 'С чего начать повторение',
  },
  kk: {
    overview: 'Талдау', roster: 'Оқушылар', assignments: 'Тапсырмалар', games: 'Шайқас пен лига',
    section: 'Сынып бөлімдері', students: 'Сыныптағы оқушылар', finished: 'Кемінде бір боссты жеңді',
    empty: 'Оқушылардың алғашқы жауаптары тексерілген соң статистика шығады.',
    first: 'Қайталауды неден бастау керек',
  },
}

function HeatmapCell({ cell, lang }: { cell: HeatCell; lang: Lang }) {
  const d = ACCOUNT_COPY[lang].dashboard
  const skill = skillCopy(lang, cell.skill)
  return (
    <div className={`grid min-w-0 gap-1 rounded-xl border-2 p-3 ${HEAT(cell.mistakeRate)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {skill && <p className="break-words text-sm leading-tight font-black text-ink">{skill.name}</p>}
          <p className="text-xs font-bold text-ink/75">{d.round(cell.round)}</p>
        </div>
        <p className="shrink-0 text-lg leading-tight font-black text-ink">{Math.round(cell.mistakeRate * 100)}%</p>
      </div>
      <p className="text-xs font-semibold text-ink/80">{d.mistakes(cell.studentsWithMistakes, cell.students)}</p>
      {cell.invalidAnswers > 0 && <p className="text-xs font-semibold text-ink/80">{d.invalid(cell.invalidAnswers)}</p>}
      {cell.commonWrong.length > 0 && (
        <p className="text-xs font-semibold text-ink/80">
          {d.wrong} {cell.commonWrong.map((w) => <code key={w} className="mr-1 rounded bg-white/70 px-1 font-mono break-all">{w}</code>)}
        </p>
      )}
    </div>
  )
}

export function ClassDashboard({ lang, classId }: { lang: Lang; classId: number }) {
  const c = ACCOUNT_COPY[lang]
  const d = c.dashboard
  const copy = CLASS_DASHBOARD[lang]
  const id = useId()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<(typeof CLASS_SECTIONS)[number]>('overview')

  useEffect(() => {
    const ctrl = new AbortController()
    accounts.dashboard(classId, ctrl.signal).then((dashboard) => {
      setData(dashboard)
      setError(null)
    }, (err) => {
      if (!isAbortError(err)) setError(c.errors[errorKey(err)] ?? c.errors.network)
    })
    return () => ctrl.abort()
  }, [classId, c])

  const back = <a href={SECTION_HREFS.teacher} className={SECONDARY}>{c.teacherArea.back}</a>
  if (error) return <div className="flex flex-col items-start gap-3"><p role="alert" className="font-bold text-rose-700">{error}</p>{back}</div>
  if (!data) return <p className="py-10 text-center font-bold">{c.working}</p>

  const topics = [...new Set(data.heatmap.map((h) => h.topic))].sort() as Topic[]
  const rec = data.recommendation
  const recSkill = rec && skillCopy(lang, rec.skill)
  const finished = data.students.filter((student) => student.bossesBeaten > 0).length
  // Mistakes exist but too few students answered for a class-wide recommendation.
  const fewAnswers = !rec && data.heatmap.some((h) => h.mistakeRate >= 0.5 && h.students < 2)

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD} aria-labelledby={`${id}-title`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id={`${id}-title`} className="text-3xl font-black text-ink">{data.schoolClass.name}</h1>
            <p className="mt-1 text-sm font-bold text-ink/80">{c.teacherArea.code}</p>
            <CopyCode code={data.schoolClass.code} lang={lang} />
          </div>
          {back}
        </div>
        {API_MODE === 'mock' && <p className="mt-3 rounded-lg bg-sun/40 px-2 py-1 text-sm font-bold text-ink">{c.teacherArea.demo}</p>}
      </section>

      <nav aria-label={copy.section} className="flex flex-wrap gap-2">
        {CLASS_SECTIONS.map((item) => (
          <button key={item} type="button" id={`${id}-button-${item}`} aria-pressed={section === item}
            aria-controls={`${id}-${item}`} onClick={() => setSection(item)}
            className={`min-h-11 rounded-xl border-2 border-ink px-3 py-1.5 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${section === item ? 'bg-sun' : 'bg-white hover:bg-sky'}`}>
            {section === item && <span aria-hidden="true">✓ </span>}{copy[item]}
          </button>
        ))}
      </nav>

      <section id={`${id}-roster`} aria-labelledby={`${id}-button-roster`} hidden={section !== 'roster'}>
        <div className="grid gap-4">
          <RosterCard classId={classId} lang={lang} students={data.students} />
          <PracticeReportCard classId={classId} lang={lang} />
        </div>
      </section>
      <section id={`${id}-assignments`} aria-labelledby={`${id}-button-assignments`} hidden={section !== 'assignments'}>
        <div className="grid gap-4">
          <HomeworkCard classId={classId} lang={lang} />
          <ClassAssignmentReports classId={classId} lang={lang} />
          <ChapterAssignment lang={lang} />
          <GuardianAssignmentForm lang={lang} />
          <CurriculumCard lang={lang} />
        </div>
      </section>
      <section id={`${id}-games`} aria-labelledby={`${id}-button-games`} hidden={section !== 'games'}>
        <div className="grid gap-4">
          <LessonLauncher classId={classId} lang={lang} />
          <BattleLauncher classId={classId} lang={lang} />
          <TeacherLeague classId={classId} lang={lang} />
        </div>
      </section>

      <section id={`${id}-overview`} aria-labelledby={`${id}-button-overview`} hidden={section !== 'overview'}>
      <div className="grid gap-4">
        <dl className="grid grid-cols-2 gap-3">
          {[[copy.students, data.students.length], [copy.finished, finished]].map(([label, count]) => (
            <div key={label} className="min-w-0 rounded-2xl border-2 border-ink bg-white p-3">
              <dt className="break-words text-sm font-bold text-ink/80">{label}</dt>
              <dd className="text-2xl font-black text-ink">{count}</dd>
            </div>
          ))}
        </dl>
        {data.heatmap.length > 0 && (rec || fewAnswers) && (
          <section className={`${CARD} ${rec ? 'border-rose-700 bg-rose-50' : 'bg-cream'}`} aria-labelledby={`${id}-review`}>
            <h2 id={`${id}-review`} className="text-lg font-black text-ink">{copy.first}</h2>
            <p className="mt-1 font-semibold text-ink">
              {rec && recSkill ? d.recommendation(Math.round(rec.mistakeRate * 100), rec.round, recSkill.name, recSkill.review) : d.fewAnswers}
            </p>
            {rec && <ReviewBattleButton classId={classId} lang={lang} topic={rec.topic} />}
          </section>
        )}

        <section className={CARD} aria-labelledby={`${id}-heat`}>
          <h2 id={`${id}-heat`} className="text-xl font-black text-ink">{d.heatmap}</h2>
          <p className="mt-1 text-sm font-semibold text-ink/75">{d.heatmapLead}</p>
          {topics.length === 0 ? <p className="mt-3 font-semibold text-ink/80">{copy.empty}</p> : <ul className="mt-2 flex flex-wrap gap-2 text-xs font-bold" aria-hidden>
            <li className="rounded-lg border-2 border-emerald-700 bg-emerald-100 px-2 py-0.5">{d.legend.low}</li>
            <li className="rounded-lg border-2 border-amber-600 bg-amber-100 px-2 py-0.5">{d.legend.mid}</li>
            <li className="rounded-lg border-2 border-rose-700 bg-rose-200 px-2 py-0.5">{d.legend.high}</li>
          </ul>}
          <div className="mt-3 flex flex-col gap-4">
            {topics.map((topic) => (
              <div key={topic}>
                <h3 className="mb-2 font-black text-ink">{c.topics[topic]}</h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {data.heatmap.filter((cell) => cell.topic === topic).map((cell) => (
                    <HeatmapCell key={`${cell.round}-${cell.skill ?? 'general'}`} lang={lang} cell={cell} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={CARD} aria-labelledby={`${id}-rank`}>
          <h2 id={`${id}-rank`} className="text-xl font-black text-ink">{d.ranking}</h2>
          {data.students.length === 0 ? (
            <p className="mt-2 font-semibold text-ink/80">{d.empty}</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {data.students.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border-2 border-ink/70 bg-white p-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
                  <span className={`grid size-9 place-items-center rounded-lg border-2 border-ink font-black ${i === 0 ? 'bg-sun' : 'bg-sky'}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-black text-ink">{s.displayName}</p>
                    <p className="truncate font-mono text-xs text-ink/70">{s.login}</p>
                  </div>
                  <dl className="col-span-2 flex flex-wrap gap-1.5 text-xs font-bold sm:col-span-1 sm:justify-end">
                    <div className="rounded-lg border-2 border-ink/60 bg-sun/50 px-2 py-0.5"><dt className="sr-only">{d.columns.stars}</dt><dd><span aria-hidden>★ </span>{s.stars}</dd></div>
                    <div className="rounded-lg border-2 border-ink/60 bg-white px-2 py-0.5"><dt className="inline">{d.columns.coins}: </dt><dd className="inline">{s.coins}</dd></div>
                    <div className="rounded-lg border-2 border-ink/60 bg-white px-2 py-0.5"><dt className="inline">{d.columns.bosses}: </dt><dd className="inline">{s.bossesBeaten}</dd></div>
                    <div className={`rounded-lg border-2 border-ink/60 px-2 py-0.5 ${s.misses > 3 ? 'bg-rose-100' : 'bg-white'}`}><dt className="inline">{d.columns.misses}: </dt><dd className="inline">{s.misses}</dd></div>
                    <div className="rounded-lg border-2 border-ink/60 bg-white px-2 py-0.5"><dt className="inline">{d.columns.combo}: </dt><dd className="inline">{s.bestCombo}</dd></div>
                    {Object.entries(s.topics).map(([topic, t]) => (
                      <div key={topic} className="rounded-lg border-2 border-ink/60 bg-emerald-50 px-2 py-0.5">
                        <dt className="inline">{c.topics[topic as Topic] ?? topic}: </dt>
                        <dd className="inline"><span className="text-amber-600">{'★'.repeat(t.bestStars)}</span><span className="text-ink/25">{'★'.repeat(3 - t.bestStars)}</span></dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      </section>
    </div>
  )
}
