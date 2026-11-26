import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { accounts, LOCAL_COMICS, type ChartBar, type Lang, type LessonBoard, type PodiumRow, type StudentLesson } from '../api'
import { buildLocalComic, type LocalComicDef } from '../api/localComics'
import { useAccount } from '../account'
import { CURRICULUM, CURRICULUM_COPY } from '../curriculum'
import { joinHref, lessonBoardHref, SECTION_HREFS, teacherClassHref } from '../route'
import { CARD, PRIMARY, SECONDARY } from './AuthScreen'
import { usePolled } from '../usePolled'
import { chapterTitle } from './CurriculumCard'
import { PanelArt } from './PanelArt'
import { Lobby } from './Lobby'
import { QrCode } from './QrCode'
import { RichText } from './RichText'

// Lesson on the board: the teacher shows a bundled chapter on the projector and turns the
// panels; on the exercise panel every student answers from a phone, the board counts answers
// (and shows who is still thinking), then reveals the answers as a chart with the chapter's
// hints. After the walkthrough the class can try once more and see how it grew. A mini-quiz of a
// few exercises of other chapters can follow, with points for speed and a podium whose stars go
// to the class league. Projector mode: full screen, larger text, arrows or a clicker.

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
    timer: 'Таймер',
    noTimer: 'Без таймера',
    seconds: (n: number) => `${n} сек`,
    timerHint: 'С таймером результат откроется сам, когда время выйдет или ответят все.',
    left: (n: number) => `Осталось ${n} сек`,
    qrTitle: 'Отвечайте с телефона',
    join: (code: string) => `Без регистрации: сканируйте и напишите имя. Код класса: ${code}`,
    answered: (n: number, total: number) => `Ответили: ${n} из ${total}`,
    waiting: 'Ещё думают:',
    reveal: 'Показать результат',
    correct: (n: number, total: number) => `Верно ответили ${n} из ${total}`,
    rightAnswer: (a: number) => `Правильный ответ: ${a}`,
    chart: 'Ответы класса',
    bar: (text: string, n: number, right: boolean) => `${text}: ${n} — ${right ? 'верный ответ' : 'ошибка'}`,
    slips: 'Частые ошибки',
    slip: (text: string, n: number) => `«${text}» — ${n}`,
    retry: 'Разобрали — ещё попытка',
    retryHint: 'Объясните ошибку и дайте классу ответить снова: доска покажет рост.',
    secondTry: 'Вторая попытка',
    growth: 'Было → стало',
    growthLine: (a: number, b: number) => `${a}% → ${b}%`,
    growthDelta: (d: number) => (d > 0 ? `+${d}% после разбора` : d < 0 ? `${d}% — стоит разобрать ещё раз` : 'без изменений'),
    quiz: 'Мини-викторина',
    quizHint: (n: number) => `${n} быстрых задачи из других глав. Очки за верный и быстрый ответ, тройка лучших получает звёзды в лигу класса.`,
    quizStart: '🏁 Начать викторину',
    question: (n: number, total: number) => `Вопрос ${n} из ${total}`,
    nextQuestion: 'Следующий вопрос',
    toPodium: '🏆 Пьедестал',
    podium: 'Пьедестал',
    points: (n: number) => `${n} очк.`,
    starsWon: (n: number) => `+${n} ★ в лигу`,
    noPodium: 'В этот раз никто не набрал очков.',
    toEnding: 'Дальше — к финалу',
    finish: 'Завершить урок',
    back: 'К классу',
    locked: 'Финал откроется после показа результата.',
    projector: 'Проектор',
    projectorOff: 'Выйти из полноэкранного режима',
    keys: 'Клавиши: → или пробел — дальше, ← — назад, F — весь экран. Кликер тоже работает.',
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
    timer: 'Таймер',
    noTimer: 'Таймерсіз',
    seconds: (n: number) => `${n} сек`,
    timerHint: 'Таймер болса, уақыт біткенде немесе бәрі жауап бергенде нәтиже өзі ашылады.',
    left: (n: number) => `${n} сек қалды`,
    qrTitle: 'Телефоннан жауап беріңдер',
    join: (code: string) => `Тіркеусіз: сканерлеп, атыңды жаз. Сынып коды: ${code}`,
    answered: (n: number, total: number) => `Жауап берді: ${total}-ден ${n}`,
    waiting: 'Әлі ойланып жатыр:',
    reveal: 'Нәтижені көрсету',
    correct: (n: number, total: number) => `${total}-ден ${n} оқушы дұрыс жауап берді`,
    rightAnswer: (a: number) => `Дұрыс жауап: ${a}`,
    chart: 'Сыныптың жауаптары',
    bar: (text: string, n: number, right: boolean) => `${text}: ${n} — ${right ? 'дұрыс жауап' : 'қате'}`,
    slips: 'Жиі кездесетін қателер',
    slip: (text: string, n: number) => `«${text}» — ${n}`,
    retry: 'Талдадық — тағы бір әрекет',
    retryHint: 'Қатені түсіндіріп, сыныпқа қайта жауап беруге мүмкіндік беріңіз: тақта өсуді көрсетеді.',
    secondTry: 'Екінші әрекет',
    growth: 'Бұрын → қазір',
    growthLine: (a: number, b: number) => `${a}% → ${b}%`,
    growthDelta: (d: number) => (d > 0 ? `талдаудан кейін +${d}%` : d < 0 ? `${d}% — тағы бір рет талдаған жөн` : 'өзгеріссіз'),
    quiz: 'Мини-викторина',
    quizHint: (n: number) => `Басқа тараулардан ${n} жылдам есеп. Дұрыс әрі жылдам жауапқа ұпай, үздік үштік сынып лигасына жұлдыз алады.`,
    quizStart: '🏁 Викторинаны бастау',
    question: (n: number, total: number) => `${total} сұрақтың ${n}-і`,
    nextQuestion: 'Келесі сұрақ',
    toPodium: '🏆 Тұғыр',
    podium: 'Тұғыр',
    points: (n: number) => `${n} ұпай`,
    starsWon: (n: number) => `лигаға +${n} ★`,
    noPodium: 'Бұл жолы ешкім ұпай жинамады.',
    toEnding: 'Әрі қарай — финалға',
    finish: 'Сабақты аяқтау',
    back: 'Сыныпқа',
    locked: 'Финал нәтиже көрсетілгеннен кейін ашылады.',
    projector: 'Проектор',
    projectorOff: 'Толық экраннан шығу',
    keys: 'Пернелер: → немесе бос орын — әрі қарай, ← — артқа, F — толық экран. Кликер де жұмыс істейді.',
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
    secondTry: 'Вторая попытка: учитель разобрал задачу — ответь ещё раз.',
    question: (n: number, total: number) => `Викторина: вопрос ${n} из ${total}`,
    left: (n: number) => `⏱ ${n} сек`,
    answer: 'Твой ответ',
    send: 'Отправить',
    sending: 'Отправляем…',
    sent: (a: string) => `Ответ «${a}» принят. Его можно изменить, пока учитель не покажет результат.`,
    right: 'Верно! Ты решил задачу.',
    wrong: 'Пока неверно. Посмотри на доску — учитель разберёт ошибку.',
    noAnswer: 'Ты не успел ответить. Посмотри разбор на доске.',
    points: (n: number) => `Твои очки в викторине: ${n}`,
    place: (n: number, stars: number) => `${['🥇', '🥈', '🥉'][n - 1] ?? '🏅'} Ты на ${n}-м месте! +${stars} ★ в лигу класса`,
    finished: 'Викторина окончена — смотри пьедестал на доске.',
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
    secondTry: 'Екінші әрекет: мұғалім есепті талдады — қайта жауап бер.',
    question: (n: number, total: number) => `Викторина: ${total} сұрақтың ${n}-і`,
    left: (n: number) => `⏱ ${n} сек`,
    answer: 'Жауабың',
    send: 'Жіберу',
    sending: 'Жіберіп жатырмыз…',
    sent: (a: string) => `«${a}» жауабы қабылданды. Мұғалім нәтижені көрсеткенше оны өзгертуге болады.`,
    right: 'Дұрыс! Сен есепті шығардың.',
    wrong: 'Әзірге дұрыс емес. Тақтаға қара — мұғалім қатені талдайды.',
    noAnswer: 'Жауап беріп үлгермедің. Тақтадағы талдауды қара.',
    points: (n: number) => `Викторинадағы ұпайың: ${n}`,
    place: (n: number, stars: number) => `${['🥇', '🥈', '🥉'][n - 1] ?? '🏅'} Сен ${n}-орындасың! Сынып лигасына +${stars} ★`,
    finished: 'Викторина аяқталды — тақтадағы тұғырды қара.',
    invalid: 'Жауапты бүтін санмен жаз, мысалы 12.',
    late: 'Жауаптар енді қабылданбайды.',
    error: 'Байланыс жоқ. Қайта көр.',
    home: 'Басты бетке',
  },
}

const TIMERS = [0, 30, 60, 90] as const

export const chapterDef = (comicId: string): LocalComicDef | undefined => LOCAL_COMICS.find((d) => d.id === comicId)

/** Chapters a lesson can use: bundled, with a whole-number exercise, ordered by the course. */
function lessonChapters() {
  return LOCAL_COMICS.filter((d) => CURRICULUM[d.id])
}

/** Four quiz questions: other chapters of the same section first, then of the same grade. */
export function quizFor(comicId: string) {
  const goal = CURRICULUM[comicId]
  const others = lessonChapters().filter((d) => d.id !== comicId)
  const same = others.filter((d) => CURRICULUM[d.id].section.ru === goal?.section.ru)
  const grade = others.filter((d) => !same.includes(d) && CURRICULUM[d.id].grade === goal?.grade)
  const rest = others.filter((d) => !same.includes(d) && !grade.includes(d))
  return [...same, ...grade, ...rest].slice(0, 4).map((d) => ({ comicId: d.id, answer: d.answer }))
}

const percent = (n: number | null | undefined, total: number | null | undefined) => (total ? Math.round(((n ?? 0) / total) * 100) : 0)

/** Seconds left, counted down locally between polls (the server sends a fresh value each poll). */
function useCountdown(secondsLeft: number | null | undefined, key: string) {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    setDeadline(secondsLeft == null ? null : Date.now() + secondsLeft * 1000)
  }, [secondsLeft, key])
  useEffect(() => {
    if (deadline == null) return
    const timer = window.setInterval(() => setTick((t) => t + 1), 500)
    return () => window.clearInterval(timer)
  }, [deadline])
  return deadline == null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
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

/** Answers by value: the right one green, slips orange, each with the chapter's hint. */
function AnswerChart({ bars, hints, lang }: { bars: ChartBar[]; hints: Readonly<Partial<Record<number, string>>>; lang: Lang }) {
  const copy = LESSON_COPY[lang]
  const max = Math.max(1, ...bars.map((b) => b.count))
  return (
    <figure className="mt-3">
      <figcaption className="font-black text-ink">{copy.chart}</figcaption>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {bars.map((b) => (
          <li key={b.text} aria-label={copy.bar(b.text, b.count, b.correct)}>
            <div className="flex items-center gap-2">
              <span className={`w-14 shrink-0 truncate text-right font-mono text-lg font-black ${b.correct ? 'text-emerald-700' : 'text-orange-700'}`}>{b.correct ? '✓ ' : ''}{b.text}</span>
              <div className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg border-2 border-ink bg-white">
                <div className={`flex h-full items-center justify-end pr-1.5 text-sm font-black ${b.correct ? 'bg-[#16a36a] text-white' : 'bg-[#fb9a3c] text-[#1d2766]'}`}
                  style={{ width: `${Math.max(12, (b.count / max) * 100)}%` }}>{b.count}</div>
              </div>
            </div>
            {!b.correct && hints[Number(b.text)] && <p className="mt-0.5 ml-16 text-sm font-semibold text-ink/80">{hints[Number(b.text)]}</p>}
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Podium({ rows, lang }: { rows: PodiumRow[]; lang: Lang }) {
  const copy = LESSON_COPY[lang]
  if (!rows.length) return <p className="text-xl font-black text-ink">{copy.noPodium}</p>
  // Second, first, third, like a real podium.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean)
  const height = { 1: 'h-40', 2: 'h-28', 3: 'h-20' } as Record<number, string>
  // Fixed colours (not the theme's): the blocks stay gold, silver and bronze in the night theme too.
  const tone = { 1: 'bg-[#ffd84d]', 2: 'bg-[#d6e2f5]', 3: 'bg-[#f6c9a0]' } as Record<number, string>
  return (
    <ol className="flex items-end justify-center gap-3" aria-label={copy.podium}>
      {order.map((r) => (
        <li key={r.id} className="boss-enter flex w-32 flex-col items-center gap-1 text-center sm:w-40" style={{ order: r.place === 1 ? 0 : r.place === 2 ? -1 : 1 }}>
          <span aria-hidden className="text-4xl">{['🥇', '🥈', '🥉'][r.place - 1]}</span>
          <span className="w-full truncate text-xl font-black text-ink">{r.name}</span>
          <span className="text-sm font-bold text-ink/75">{copy.points(r.points)} · {copy.starsWon(r.stars)}</span>
          <span className={`flex w-full items-start justify-center rounded-t-xl border-[3px] border-b-0 border-ink pt-2 text-3xl font-black text-[#1d2766] ${height[r.place]} ${tone[r.place]}`}>{r.place}</span>
        </li>
      ))}
    </ol>
  )
}

/** The board (#/teacher/lesson/{id}): one big panel, the answer counter, then the results. */
export function LessonBoardScreen({ lessonId, lang }: { lessonId: string; lang: Lang }) {
  const copy = LESSON_COPY[lang]
  const load = useCallback((signal: AbortSignal) => accounts.lessonBoard(lessonId, signal), [lessonId])
  const { value: board, setValue, failed } = usePolled<LessonBoard>(load, 2000)
  const [busy, setBusy] = useState(false)
  const [timer, setTimer] = useState(0)
  const [projector, setProjector] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const def = board ? chapterDef(board.comicId) : undefined
  const comic = useMemo(() => (def ? buildLocalComic(def, lang) : null), [def, lang])
  const step = board?.step ?? 0
  const quiz = board?.quiz ?? []
  const quizDef = step ? chapterDef(quiz[step - 1]) : undefined
  const quizComic = useMemo(() => (quizDef ? buildLocalComic(quizDef, lang) : null), [quizDef, lang])
  const left = useCountdown(board?.secondsLeft, `${step}-${board?.attempt}-${board?.phase}`)

  useEffect(() => {
    const sync = () => setProjector(document.fullscreenElement === frame.current && !!frame.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Keyboard and clicker (they send arrows or PageUp/PageDown): forward does the next step.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  if (!board) return failed ? <p role="alert" className="font-bold text-rose-700">{copy.error}</p> : null
  if (!def || !comic) return <p role="alert" className="font-bold text-rose-700">{copy.error}</p>

  const total = comic.panels.length
  const exerciseIndex = def.exercisePanelId - 1
  const revealed = board.phase === 'reveal' || board.phase === 'podium' || board.phase === 'closed'
  const maxPanel = revealed ? total - 1 : exerciseIndex
  const inQuiz = step > 0 && !!quizComic && !!quizDef
  const shown = inQuiz ? quizComic.panels[quizDef.exercisePanelId - 1] : comic.panels[Math.min(board.panel, total - 1)]
  const onExercise = !inQuiz && board.panel === exerciseIndex
  const lessonUrl = `${window.location.origin}${window.location.pathname}${joinHref(board.classCode, 'lesson')}`
  const hints = (inQuiz ? quizDef.text[lang].commonMistakes : def.text[lang].commonMistakes) ?? {}
  const attempt = board.attempt ?? 1
  const quizTasks = quizFor(board.comicId)
  const prompt = inQuiz ? quizComic.exercise.prompt : comic.exercise.prompt

  async function update(body: Parameters<typeof accounts.updateLesson>[1]) {
    setBusy(true)
    try {
      setValue(await accounts.updateLesson(lessonId, body))
    } finally {
      setBusy(false)
    }
  }

  async function run(action: () => Promise<LessonBoard>) {
    setBusy(true)
    try {
      setValue(await action())
    } finally {
      setBusy(false)
    }
  }

  const collect = () => update({ phase: 'answering', timer })
  const nextQuestion = () => run(() => accounts.nextQuestion(lessonId))

  function forward() {
    if (busy || board!.phase === 'podium' || board!.phase === 'closed') return
    if (board!.phase === 'answering') return void update({ phase: 'reveal' })
    if (inQuiz) return void (board!.phase === 'reveal' && nextQuestion())
    if (onExercise && board!.phase === 'reading') return void collect()
    if (board!.panel < maxPanel) void update({ panel: board!.panel + 1 })
  }

  function toggleProjector() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.current?.requestFullscreen?.().catch(() => {})
  }

  keys.current = (e) => {
    const target = e.target as HTMLElement | null
    if (e.ctrlKey || e.metaKey || e.altKey || target?.closest('input, select, textarea, [contenteditable]')) return
    if (['ArrowRight', 'PageDown', ' '].includes(e.key) && !(e.key === ' ' && target?.closest('button, a'))) {
      e.preventDefault()
      forward()
    } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault()
      if (!inQuiz && !busy && board.panel > 0) void update({ panel: board.panel - 1 })
    } else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
      toggleProjector()
    }
  }

  const answering = (
    <section className="flex flex-col items-center gap-3 rounded-2xl border-[3px] border-ink bg-sun p-4 text-center text-ink">
      <p className="text-xl font-black">{copy.qrTitle}</p>
      <QrCode value={lessonUrl} label={copy.qrTitle} className="size-44 border-[3px] border-ink p-1" />
      <p className="text-sm font-bold">{copy.join(board.classCode)}</p>
      {left != null && (
        <p className={`rounded-full border-[3px] border-ink px-4 py-1 text-3xl font-black tabular-nums ${left <= 5 ? 'animate-pulse bg-rose-500 text-white' : 'bg-white'}`} role="timer">
          ⏱ {copy.left(left)}
        </p>
      )}
      <p className="text-3xl font-black tabular-nums" aria-live="polite">{copy.answered(board.answered, board.students)}</p>
      <div className="h-4 w-full overflow-hidden rounded-full border-[3px] border-ink bg-white" aria-hidden>
        <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${percent(board.answered, board.students)}%` }} />
      </div>
      {!!board.waiting?.length && (
        <p className="text-sm font-bold"><span className="font-black">{copy.waiting}</span> {board.waiting.slice(0, 12).join(', ')}{board.waiting.length > 12 ? ` +${board.waiting.length - 12}` : ''}</p>
      )}
      <button type="button" disabled={busy} onClick={() => update({ phase: 'reveal' })} className={`${SECONDARY} w-full`}>{copy.reveal}</button>
    </section>
  )

  const results = revealed && board.correct != null && board.phase !== 'podium' && (
    <section className={CARD} aria-live="polite">
      {attempt === 2 && !inQuiz && board.firstAnswered != null && (
        <div className="mb-3 rounded-xl border-[3px] border-ink bg-emerald-50 p-3">
          <p className="text-sm font-black text-ink/75">{copy.growth}</p>
          <p className="text-4xl font-black text-ink tabular-nums">{copy.growthLine(percent(board.firstCorrect, board.firstAnswered), percent(board.correct, board.answered))}</p>
          <p className="font-bold text-emerald-800">{copy.growthDelta(percent(board.correct, board.answered) - percent(board.firstCorrect, board.firstAnswered))}</p>
        </div>
      )}
      <p className="text-2xl font-black text-ink">{copy.correct(board.correct, board.answered)}</p>
      <p className="mt-1 font-black text-emerald-700">✓ {copy.rightAnswer(board.answer)}</p>
      {board.chart?.length ? <AnswerChart bars={board.chart} hints={hints} lang={lang} /> : board.wrong.length > 0 && (
        <>
          <h2 className="mt-3 font-black text-ink">{copy.slips}</h2>
          <ul className="mt-1 flex flex-col gap-1.5">
            {board.wrong.map((w) => (
              <li key={w.text} className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-sm font-semibold text-ink">
                <span className="font-black">{copy.slip(w.text, w.count)}</span>
                {hints[Number(w.text)] && <span className="block text-ink/80">{hints[Number(w.text)]}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {inQuiz ? (
        board.phase === 'reveal' && (
          <button type="button" disabled={busy} onClick={nextQuestion} className={`${PRIMARY} mt-3 w-full`}>
            {step < quiz.length ? `${copy.nextQuestion} →` : copy.toPodium}
          </button>
        )
      ) : (
        <>
          {attempt === 1 && board.phase === 'reveal' && (
            <div className="mt-3">
              <button type="button" disabled={busy} onClick={() => update({ retry: true, timer })} className={`${SECONDARY} w-full`}>🔁 {copy.retry}</button>
              <p className="mt-1 text-xs font-semibold text-ink/70">{copy.retryHint}</p>
            </div>
          )}
          {!quiz.length && board.phase === 'reveal' && quizTasks.length >= 3 && (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ink/50 p-3">
              <p className="font-black text-ink">🏆 {copy.quiz}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink/75">{copy.quizHint(quizTasks.length)}</p>
              <button type="button" disabled={busy} onClick={() => run(() => accounts.startQuiz(lessonId, quizTasks))} className={`${PRIMARY} mt-2 w-full`}>{copy.quizStart}</button>
            </div>
          )}
          {board.panel < total - 1 && (
            <button type="button" disabled={busy} onClick={() => update({ panel: total - 1 })} className={`${PRIMARY} mt-3 w-full`}>{copy.toEnding} →</button>
          )}
        </>
      )}
    </section>
  )

  const timerPicker = (
    <fieldset className="mt-3">
      <legend className="text-sm font-black text-ink/80">⏱ {copy.timer}</legend>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {TIMERS.map((t) => (
          <label key={t} className="cursor-pointer rounded-lg border-2 border-ink bg-white px-1 py-1.5 text-center text-sm font-black text-ink has-checked:bg-sun has-focus-visible:outline-3 has-focus-visible:outline-brand">
            <input type="radio" name={`${lessonId}-timer`} className="sr-only" checked={timer === t} onChange={() => setTimer(t)} />
            {t ? copy.seconds(t) : copy.noTimer}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs font-semibold text-ink/70">{copy.timerHint}</p>
    </fieldset>
  )

  return (
    <div ref={frame} className={`flex flex-col gap-4 ${projector ? 'lesson-projector overflow-auto bg-paper p-6' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">{comic.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-ink/70">
            {board.className} · {board.phase === 'podium' ? copy.podium : inQuiz ? copy.question(step, quiz.length) : copy.panel(board.panel + 1, total)}
            {attempt === 2 && !step && <span className="ml-2 rounded-md bg-ink px-1.5 py-0.5 text-sm text-white">{copy.secondTry}</span>}
          </p>
          <button type="button" onClick={toggleProjector} aria-pressed={projector} title={copy.keys}
            className="min-h-10 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand">
            <span aria-hidden>⛶ </span>{projector ? copy.projectorOff : copy.projector}
          </button>
        </div>
      </div>

      {board.phase === 'podium' ? (
        <section className={`${CARD} flex flex-col items-center gap-4`} aria-live="polite">
          <h2 className="text-3xl font-black text-ink">🏆 {copy.podium}</h2>
          <Podium rows={board.podium ?? []} lang={lang} />
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <figure className="overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100" aria-label={`${shown.speaker}: ${shown.text}`}>
            <PanelArt imageKey={shown.imageKey} imageUrl={shown.imageUrl} lang={lang} speaker={shown.speaker} text={shown.text}
              imageAspect={shown.imageAspect} placeholder={shown.placeholder} priority />
          </figure>
          <aside className="flex flex-col gap-3">
            {(onExercise || inQuiz) && (
              <section className={CARD}>
                {inQuiz && <p className="mb-1 text-sm font-black text-brand-dark">🏆 {copy.quiz} · {chapterTitle(quizDef.id, lang)}</p>}
                <p className="text-lg leading-snug font-extrabold text-ink"><RichText text={prompt} /></p>
                {board.phase === 'reading' && !inQuiz && (
                  <>
                    <p className="mt-2 text-sm font-semibold text-ink/75">{copy.collectHint}</p>
                    {timerPicker}
                    <button type="button" disabled={busy} onClick={collect} className={`${PRIMARY} mt-3 w-full`}>📱 {copy.collect}</button>
                  </>
                )}
              </section>
            )}
            {board.phase === 'answering' && answering}
            {results}
            {!revealed && !inQuiz && board.panel >= exerciseIndex && board.phase !== 'answering' && <p className="text-sm font-bold text-ink/70">🔒 {copy.locked}</p>}
            <Lobby classId={board.classId} present={board.present} answered={board.phase === 'answering' ? board.answeredIds : undefined} lang={lang} />
          </aside>
        </div>
      )}
      <nav className="flex flex-wrap items-center gap-2">
        {!inQuiz && board.phase !== 'podium' && (
          <>
            <button type="button" disabled={busy || board.panel === 0} onClick={() => update({ panel: board.panel - 1 })} className={SECONDARY}>← {copy.prev}</button>
            <button type="button" disabled={busy || board.panel >= maxPanel} onClick={() => update({ panel: board.panel + 1 })} className={PRIMARY}>{copy.next} →</button>
          </>
        )}
        <span className="flex-1" />
        <button type="button" disabled={busy} onClick={async () => { await update({ phase: 'closed' }); window.location.hash = teacherClassHref(board.classId) }} className={SECONDARY}>{copy.finish}</button>
        <a href={teacherClassHref(board.classId)} className={SECONDARY}>{copy.back}</a>
      </nav>
      <p className="text-xs font-semibold text-ink/60">⌨️ {copy.keys}</p>
    </div>
  )
}

/** The student's phone (#/lesson): follow the board, answer the exercise, see the result. */
export function StudentLessonScreen({ lang }: { lang: Lang }) {
  const copy = STUDENT_LESSON_COPY[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myLesson(signal), [])
  const { value: lesson, setValue, failed } = usePolled<StudentLesson | null>(load, 2500, inClass)
  const left = useCountdown(lesson?.secondsLeft, `${lesson?.step}-${lesson?.attempt}-${lesson?.phase}`)
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
  const quizDef = lesson.stepComicId ? chapterDef(lesson.stepComicId) : undefined
  const quizComic = quizDef ? buildLocalComic(quizDef, lang) : null
  const panel = quizComic && quizDef ? quizComic.panels[quizDef.exercisePanelId - 1] : comic.panels[Math.min(lesson.panel, comic.panels.length - 1)]
  const prompt = quizComic ? quizComic.exercise.prompt : comic.exercise.prompt
  const revealed = lesson.phase === 'reveal' || lesson.phase === 'closed'
  const step = lesson.step ?? 0
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {header}
      <p className="font-black text-brand-dark">
        {comic.title}{lesson.phase === 'podium' ? '' : ` · ${step ? copy.question(step, lesson.quizSize ?? step) : copy.watch(lesson.panel + 1, comic.panels.length)}`}
      </p>
      {lesson.phase === 'podium' ? (
        <p className="boss-enter rounded-2xl border-[3px] border-ink bg-sun p-4 text-center text-2xl font-black text-ink" aria-live="polite">
          {lesson.place ? copy.place(lesson.place, lesson.stars ?? 0) : copy.finished}
          {lesson.points ? <span className="mt-1 block text-base font-bold">{copy.points(lesson.points)}</span> : null}
        </p>
      ) : (
        <figure className="overflow-hidden rounded-2xl border-[4px] border-ink bg-sky-100" aria-label={`${panel.speaker}: ${panel.text}`}>
          <PanelArt imageKey={panel.imageKey} imageUrl={panel.imageUrl} lang={lang} speaker={panel.speaker} text={panel.text}
            imageAspect={panel.imageAspect} placeholder={panel.placeholder} animateDialogue={false} />
        </figure>
      )}
      {lesson.phase === 'answering' && (
        <>
          {(lesson.attempt ?? 1) === 2 && !step && <p className="rounded-xl bg-sky-100 p-3 font-black text-ink">🔁 {copy.secondTry}</p>}
          {left != null && <p role="timer" className={`self-start rounded-full border-[3px] border-ink px-3 py-0.5 text-xl font-black tabular-nums ${left <= 5 ? 'bg-rose-500 text-white' : 'bg-white text-ink'}`}>{copy.left(left)}</p>}
          <LessonAnswerForm key={`${lesson.id}-${step}-${lesson.attempt ?? 1}`} lesson={lesson} prompt={prompt} lang={lang} onSaved={setValue} />
        </>
      )}
      {revealed && (
        <p className={`rounded-xl p-3 text-lg font-black ${lesson.correct ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-50 text-rose-700'}`} aria-live="polite">
          {lesson.correct ? `🎉 ${copy.right}` : lesson.myAnswer ? copy.wrong : copy.noAnswer}
          {step > 0 && <span className="mt-1 block text-base text-ink">{copy.points(lesson.points ?? 0)}</span>}
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
