import { useCallback, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { accounts, LOCAL_COMICS, type Lang, type LessonBoard, type StudentLesson } from '../api'
import { buildLocalComic, type LocalComicDef } from '../api/localComics'
import { useAccount } from '../account'
import { CURRICULUM, CURRICULUM_COPY } from '../curriculum'
import { joinHref, lessonBoardHref, SECTION_HREFS, teacherClassHref } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { usePolled } from './ClassBattle'
import { chapterTitle } from './CurriculumCard'
import { PanelArt } from './PanelArt'
import { Lobby } from './Lobby'
import { QrCode } from './QrCode'
import { RichText } from './RichText'

// Lesson on the board: the teacher shows a bundled chapter on the projector and turns the
// panels; on the exercise panel every student answers from a phone, the board counts answers,
// then reveals how many were right and the most common slips (with the chapter's own hints).

export const LESSON_COPY = {
  ru: {
    start: 'Урок по комиксу',
    startLead: 'Выведите главу на проектор и листайте кадры. На кадре с задачей класс отвечает с телефонов, а доска покажет, сколько ответили верно.',
    chapter: 'Глава',
    launch: 'Открыть на доске',
    open: 'Вернуться к уроку',
    current: (title: string) => `Идёт урок: «${title}».`,
    panel: (n: number, total: number) => `Кадр ${n} из ${total}`,
    prev: 'Назад',
    next: 'Дальше',
    collect: 'Собрать ответы с телефонов',
    collectHint: 'Сначала обсудите задачу вместе, потом откройте ответы.',
    qrTitle: 'Отвечайте с телефона',
    join: (code: string) => `Без регистрации: сканируйте и напишите имя. Код класса: ${code}`,
    answered: (n: number, total: number) => `Ответили: ${n} из ${total}`,
    reveal: 'Показать результат',
    correct: (n: number, total: number) => `Верно ответили ${n} из ${total}`,
    rightAnswer: (a: number) => `Правильный ответ: ${a}`,
    slips: 'Частые ошибки',
    slip: (text: string, n: number) => `«${text}» — ${n}`,
    toEnding: 'Дальше — к финалу',
    finish: 'Завершить урок',
    back: 'К классу',
    locked: 'Финал откроется после показа результата.',
    error: 'Не удалось загрузить урок.',
  },
  kk: {
    start: 'Комикс бойынша сабақ',
    startLead: 'Тарауды проекторға шығарып, кадрларды ауыстырыңыз. Есеп кадрында сынып телефоннан жауап береді, ал тақта қаншасы дұрыс жауап бергенін көрсетеді.',
    chapter: 'Тарау',
    launch: 'Тақтада ашу',
    open: 'Сабаққа оралу',
    current: (title: string) => `Сабақ жүріп жатыр: «${title}».`,
    panel: (n: number, total: number) => `${total} кадрдың ${n}-і`,
    prev: 'Артқа',
    next: 'Әрі қарай',
    collect: 'Телефоннан жауаптарды жинау',
    collectHint: 'Алдымен есепті бірге талқылаңыз, содан кейін жауаптарды ашыңыз.',
    qrTitle: 'Телефоннан жауап беріңдер',
    join: (code: string) => `Тіркеусіз: сканерлеп, атыңды жаз. Сынып коды: ${code}`,
    answered: (n: number, total: number) => `Жауап берді: ${total}-ден ${n}`,
    reveal: 'Нәтижені көрсету',
    correct: (n: number, total: number) => `${total}-ден ${n} оқушы дұрыс жауап берді`,
    rightAnswer: (a: number) => `Дұрыс жауап: ${a}`,
    slips: 'Жиі кездесетін қателер',
    slip: (text: string, n: number) => `«${text}» — ${n}`,
    toEnding: 'Әрі қарай — финалға',
    finish: 'Сабақты аяқтау',
    back: 'Сыныпқа',
    locked: 'Финал нәтиже көрсетілгеннен кейін ашылады.',
    error: 'Сабақты жүктеу мүмкін болмады.',
  },
}

export const STUDENT_LESSON_COPY = {
  ru: {
    alertTitle: 'Идёт урок по комиксу',
    alertText: 'Учитель показывает главу на доске. Открой — ответ на задачу ты дашь отсюда.',
    join: 'Открыть',
    title: 'Урок по комиксу',
    none: 'Сейчас урока нет. Когда учитель откроет главу на доске, она появится здесь.',
    noClass: 'Вступи в класс по коду учителя, чтобы участвовать в уроках.',
    watch: (n: number, total: number) => `Смотри на доску: кадр ${n} из ${total}`,
    answer: 'Твой ответ',
    send: 'Отправить',
    sending: 'Отправляем…',
    sent: (a: string) => `Ответ «${a}» принят. Его можно изменить, пока учитель не покажет результат.`,
    right: 'Верно! Ты решил задачу.',
    wrong: 'Пока неверно. Посмотри на доску — учитель разберёт ошибку.',
    noAnswer: 'Ты не успел ответить. Посмотри разбор на доске.',
    invalid: 'Запиши ответ целым числом, например 12.',
    late: 'Ответы уже не принимаются.',
    error: 'Нет связи. Попробуй ещё раз.',
    home: 'На главную',
  },
  kk: {
    alertTitle: 'Комикс бойынша сабақ жүріп жатыр',
    alertText: 'Мұғалім тарауды тақтада көрсетіп тұр. Аш — есептің жауабын осы жерден бересің.',
    join: 'Ашу',
    title: 'Комикс бойынша сабақ',
    none: 'Қазір сабақ жоқ. Мұғалім тарауды тақтада ашқанда, ол осы жерде пайда болады.',
    noClass: 'Сабақтарға қатысу үшін мұғалімнің коды арқылы сыныпқа қосыл.',
    watch: (n: number, total: number) => `Тақтаға қара: ${total} кадрдың ${n}-і`,
    answer: 'Жауабың',
    send: 'Жіберу',
    sending: 'Жіберіп жатырмыз…',
    sent: (a: string) => `«${a}» жауабы қабылданды. Мұғалім нәтижені көрсеткенше оны өзгертуге болады.`,
    right: 'Дұрыс! Сен есепті шығардың.',
    wrong: 'Әзірге дұрыс емес. Тақтаға қара — мұғалім қатені талдайды.',
    noAnswer: 'Жауап беріп үлгермедің. Тақтадағы талдауды қара.',
    invalid: 'Жауапты бүтін санмен жаз, мысалы 12.',
    late: 'Жауаптар енді қабылданбайды.',
    error: 'Байланыс жоқ. Қайта көр.',
    home: 'Басты бетке',
  },
}

const chapterDef = (comicId: string): LocalComicDef | undefined => LOCAL_COMICS.find((d) => d.id === comicId)

/** Chapters a lesson can use: bundled, with a whole-number exercise, ordered by the course. */
function lessonChapters() {
  return LOCAL_COMICS.filter((d) => CURRICULUM[d.id])
}

/** Class page («Бои и лига»): pick a chapter and open it on the board. */
export function LessonLauncher({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = LESSON_COPY[lang]
  const id = useId()
  const chapters = lessonChapters()
  const [comicId, setComicId] = useState(chapters[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function launch() {
    const def = chapterDef(comicId)
    if (!def) return
    setBusy(true)
    setError(false)
    try {
      const board = await accounts.startLesson(classId, { comicId, answer: def.answer })
      window.location.hash = lessonBoardHref(board.id)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <section className={CARD} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📽️</span>{copy.start}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.startLead}</p>
      <label htmlFor={`${id}-chapter`} className="mt-3 block text-sm font-black text-ink/80">{copy.chapter}</label>
      <select id={`${id}-chapter`} value={comicId} onChange={(e) => setComicId(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border-[3px] border-ink bg-white px-3 font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun">
        {chapters.map((d) => {
          const goal = CURRICULUM[d.id]
          return <option key={d.id} value={d.id}>{chapterTitle(d.id, lang)} — {CURRICULUM_COPY[lang].grade(goal.grade)}, {goal.section[lang]}</option>
        })}
      </select>
      <button type="button" onClick={launch} disabled={busy || !comicId} className={`${PRIMARY} mt-3`}>
        <span aria-hidden>📽️ </span>{copy.launch}
      </button>
      {error && <p role="alert" className="mt-2 font-bold text-rose-700">{copy.error}</p>}
    </section>
  )
}

/** The board (#/teacher/lesson/{id}): one big panel, the answer counter, then the results. */
export function LessonBoardScreen({ lessonId, lang }: { lessonId: string; lang: Lang }) {
  const copy = LESSON_COPY[lang]
  const load = useCallback((signal: AbortSignal) => accounts.lessonBoard(lessonId, signal), [lessonId])
  const { value: board, setValue, failed } = usePolled<LessonBoard>(load, 2000)
  const [busy, setBusy] = useState(false)
  const def = board ? chapterDef(board.comicId) : undefined
  const comic = useMemo(() => (def ? buildLocalComic(def, lang) : null), [def, lang])

  if (!board) return failed ? <p role="alert" className="font-bold text-rose-700">{copy.error}</p> : null
  if (!def || !comic) return <p role="alert" className="font-bold text-rose-700">{copy.error}</p>

  const total = comic.panels.length
  const exerciseIndex = def.exercisePanelId - 1
  const revealed = board.phase === 'reveal' || board.phase === 'closed'
  const maxPanel = revealed ? total - 1 : exerciseIndex
  const panel = comic.panels[Math.min(board.panel, total - 1)]
  const onExercise = board.panel === exerciseIndex
  const lessonUrl = `${window.location.origin}${window.location.pathname}${joinHref(board.classCode, 'lesson')}`
  const mistakes = def.text[lang].commonMistakes ?? {}

  async function update(body: { panel?: number; phase?: LessonBoard['phase'] }) {
    setBusy(true)
    try {
      setValue(await accounts.updateLesson(lessonId, body))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{comic.title}</h1>
        <p className="font-black text-ink/70">{board.className} · {copy.panel(board.panel + 1, total)}</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <figure className="overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100" aria-label={`${panel.speaker}: ${panel.text}`}>
          <PanelArt imageKey={panel.imageKey} imageUrl={panel.imageUrl} lang={lang} speaker={panel.speaker} text={panel.text}
            imageAspect={panel.imageAspect} placeholder={panel.placeholder} priority />
        </figure>
        <aside className="flex flex-col gap-3">
          {onExercise && (
            <section className={CARD}>
              <p className="text-lg leading-snug font-extrabold text-ink"><RichText text={comic.exercise.prompt} /></p>
              {board.phase === 'reading' && (
                <>
                  <p className="mt-2 text-sm font-semibold text-ink/75">{copy.collectHint}</p>
                  <button type="button" disabled={busy} onClick={() => update({ phase: 'answering' })} className={`${PRIMARY} mt-3 w-full`}>📱 {copy.collect}</button>
                </>
              )}
            </section>
          )}
          {board.phase === 'answering' && (
            <section className="flex flex-col items-center gap-3 rounded-2xl border-[3px] border-ink bg-sun p-4 text-center text-ink">
              <p className="text-xl font-black">{copy.qrTitle}</p>
              <QrCode value={lessonUrl} label={copy.qrTitle} className="size-44 border-[3px] border-ink p-1" />
              <p className="text-sm font-bold">{copy.join(board.classCode)}</p>
              <p className="text-3xl font-black tabular-nums" aria-live="polite">{copy.answered(board.answered, board.students)}</p>
              <button type="button" disabled={busy} onClick={() => update({ phase: 'reveal' })} className={`${SECONDARY} w-full`}>{copy.reveal}</button>
            </section>
          )}
          {revealed && board.correct != null && (
            <section className={CARD} aria-live="polite">
              <p className="text-2xl font-black text-ink">{copy.correct(board.correct, board.answered)}</p>
              <div className="mt-2 h-5 overflow-hidden rounded-full border-[3px] border-ink bg-white">
                <div className="h-full bg-emerald-500" style={{ width: `${board.answered ? (board.correct / board.answered) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 font-black text-emerald-700">✓ {copy.rightAnswer(board.answer)}</p>
              {board.wrong.length > 0 && (
                <>
                  <h2 className="mt-3 font-black text-ink">{copy.slips}</h2>
                  <ul className="mt-1 flex flex-col gap-1.5">
                    {board.wrong.map((w) => (
                      <li key={w.text} className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-sm font-semibold text-ink">
                        <span className="font-black">{copy.slip(w.text, w.count)}</span>
                        {mistakes[Number(w.text)] && <span className="block text-ink/80">{mistakes[Number(w.text)]}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {board.panel < total - 1 && (
                <button type="button" disabled={busy} onClick={() => update({ panel: total - 1 })} className={`${PRIMARY} mt-3 w-full`}>{copy.toEnding} →</button>
              )}
            </section>
          )}
          {!revealed && board.panel >= exerciseIndex && <p className="text-sm font-bold text-ink/70">🔒 {copy.locked}</p>}
          <Lobby classId={board.classId} present={board.present} lang={lang} />
        </aside>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || board.panel === 0} onClick={() => update({ panel: board.panel - 1 })} className={SECONDARY}>← {copy.prev}</button>
        <button type="button" disabled={busy || board.panel >= maxPanel} onClick={() => update({ panel: board.panel + 1 })} className={PRIMARY}>{copy.next} →</button>
        <span className="flex-1" />
        <button type="button" disabled={busy} onClick={async () => { await update({ phase: 'closed' }); window.location.hash = teacherClassHref(board.classId) }} className={SECONDARY}>{copy.finish}</button>
        <a href={teacherClassHref(board.classId)} className={SECONDARY}>{copy.back}</a>
      </nav>
    </div>
  )
}

/** Home page: a card while the class has a lesson going. */
export function LessonAlert({ lang }: { lang: Lang }) {
  const copy = STUDENT_LESSON_COPY[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myLesson(signal), [])
  const { value: lesson } = usePolled(load, 20000, inClass)
  if (!inClass || !lesson) return null
  return (
    <a href={SECTION_HREFS.lesson} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#2a1f6b,#3366e0)] p-3 text-white shadow-[0_4px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
      <span aria-hidden className="text-3xl">📽️</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black leading-tight">{copy.alertTitle}</span>
        <span className="mt-0.5 block text-sm font-semibold text-white/90">{copy.alertText}</span>
      </span>
      <span className="shrink-0 rounded-xl border-2 border-ink bg-sun px-3 py-1.5 font-black text-ink">{copy.join} →</span>
    </a>
  )
}

/** The student's phone (#/lesson): follow the board, answer the exercise, see the result. */
export function StudentLessonScreen({ lang }: { lang: Lang }) {
  const copy = STUDENT_LESSON_COPY[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myLesson(signal), [])
  const { value: lesson, setValue, failed } = usePolled<StudentLesson | null>(load, 2500, inClass)
  const header = <h1 className="text-3xl font-black text-ink">{copy.title}</h1>
  if (!inClass) return <div className="flex max-w-2xl flex-col gap-4">{header}<p className={CARD}>{copy.noClass}</p></div>
  if (lesson === undefined) return <div className="flex max-w-2xl flex-col gap-4">{header}{failed && <p role="alert" className="font-bold text-rose-700">{copy.error}</p>}</div>
  if (lesson === null) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {header}
        <p className={`${CARD} font-bold`}>{copy.none}</p>
        <a href={SECTION_HREFS.map} className={`${SECONDARY} self-start`}>{copy.home}</a>
      </div>
    )
  }
  const def = chapterDef(lesson.comicId)
  if (!def) return <div className="flex max-w-2xl flex-col gap-4">{header}<p role="alert">{copy.error}</p></div>
  const comic = buildLocalComic(def, lang)
  const panel = comic.panels[Math.min(lesson.panel, comic.panels.length - 1)]
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {header}
      <p className="font-black text-brand-dark">{comic.title} · {copy.watch(lesson.panel + 1, comic.panels.length)}</p>
      <figure className="overflow-hidden rounded-2xl border-[4px] border-ink bg-sky-100" aria-label={`${panel.speaker}: ${panel.text}`}>
        <PanelArt imageKey={panel.imageKey} imageUrl={panel.imageUrl} lang={lang} speaker={panel.speaker} text={panel.text}
          imageAspect={panel.imageAspect} placeholder={panel.placeholder} animateDialogue={false} />
      </figure>
      {lesson.phase === 'answering' && <LessonAnswerForm key={lesson.id} lesson={lesson} prompt={comic.exercise.prompt} lang={lang} onSaved={setValue} />}
      {(lesson.phase === 'reveal' || lesson.phase === 'closed') && (
        <p className={`rounded-xl p-3 text-lg font-black ${lesson.correct ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-50 text-rose-700'}`} aria-live="polite">
          {lesson.correct ? `🎉 ${copy.right}` : lesson.myAnswer ? copy.wrong : copy.noAnswer}
        </p>
      )}
    </div>
  )
}

function LessonAnswerForm({ lesson, prompt, lang, onSaved }: { lesson: StudentLesson; prompt: string; lang: Lang; onSaved: (l: StudentLesson) => void }) {
  const copy = STUDENT_LESSON_COPY[lang]
  const [answer, setAnswer] = useState(lesson.myAnswer ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(lesson.myAnswer ? { ok: true, text: copy.sent(lesson.myAnswer) } : null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !answer.trim()) return
    setBusy(true)
    try {
      const saved = await accounts.answerLesson(lesson.id, answer)
      onSaved(saved)
      setMessage({ ok: true, text: copy.sent(saved.myAnswer ?? answer) })
    } catch (err) {
      const status = (err as { status?: number }).status
      setMessage({ ok: false, text: status === 422 ? copy.invalid : status === 409 ? copy.late : copy.error })
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <form onSubmit={submit} className={`${CARD} flex flex-col gap-3`}>
      <p className="text-lg leading-snug font-extrabold text-ink"><RichText text={prompt} /></p>
      <label htmlFor={`${id}-answer`} className="text-sm font-black text-ink/80">{copy.answer}</label>
      <div className="flex gap-2">
        <input ref={input} id={`${id}-answer`} value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode="numeric" autoComplete="off" autoFocus
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-mono text-2xl font-bold tabular-nums outline-none focus-visible:ring-4 focus-visible:ring-sun" />
        <button type="submit" disabled={busy || !answer.trim()} className={`${PRIMARY} shrink-0`}>{busy ? copy.sending : copy.send}</button>
      </div>
      {message && <p aria-live="polite" className={`font-bold ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{message.text}</p>}
    </form>
  )
}
