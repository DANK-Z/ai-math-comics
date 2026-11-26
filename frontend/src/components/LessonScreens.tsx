import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { accounts, LOCAL_COMICS, type ChartBar, type Lang, type LessonBoard, type PodiumRow, type QuizTask, type StudentLesson } from '../api'
import { giveDrill } from './LessonReports'
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
    planTitle: 'Готовый план урока',
    planLead: 'Выберите тему — система соберёт урок: глава, ответы с телефонов, разбор и вторая попытка, финал, мини-викторина и домашка тем, кто ошибся. Ведите его одной кнопкой «Следующий шаг».',
    planTopic: 'Тема',
    planLaunch: 'Собрать урок',
    planStages: ['Комикс', 'Ответы', 'Разбор', 'Финал', 'Викторина', 'Домашка'],
    planNext: 'Следующий шаг',
    planActions: {
      panel: 'следующий кадр',
      collect: 'собрать ответы',
      reveal: 'показать результат',
      retry: 'вторая попытка',
      ending: 'финал главы',
      quiz: 'мини-викторина',
      question: 'следующий вопрос',
      podium: 'пьедестал',
      homework: 'задать домашку и завершить',
    },
    planDone: (n: number) => (n ? `Урок завершён. Тренировка задана ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ученику' : 'ученикам'}, кто ошибся.` : 'Урок завершён. Все, кто ответил, решили верно — домашка не нужна.'),
    ownTitle: 'Свои задачи',
    ownLead: 'До трёх задач с ответом — целым числом. Сохраняются на этом устройстве для следующих уроков.',
    ownText: 'Условие задачи',
    ownAnswer: 'Ответ',
    ownAdd: 'Добавить',
    ownRemove: 'Убрать задачу',
    ownInvalid: 'Напишите условие (от 3 символов) и ответ целым числом.',
    ownTask: 'Задача учителя',
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
    planTitle: 'Дайын сабақ жоспары',
    planLead: 'Тақырыпты таңдаңыз — жүйе сабақты өзі құрады: тарау, телефоннан жауаптар, талдау және екінші әрекет, финал, мини-викторина және қателескендерге үй жұмысы. Оны бір ғана «Келесі қадам» батырмасымен жүргізіңіз.',
    planTopic: 'Тақырып',
    planLaunch: 'Сабақты құру',
    planStages: ['Комикс', 'Жауаптар', 'Талдау', 'Финал', 'Викторина', 'Үй жұмысы'],
    planNext: 'Келесі қадам',
    planActions: {
      panel: 'келесі кадр',
      collect: 'жауаптарды жинау',
      reveal: 'нәтижені көрсету',
      retry: 'екінші әрекет',
      ending: 'тараудың финалы',
      quiz: 'мини-викторина',
      question: 'келесі сұрақ',
      podium: 'тұғыр',
      homework: 'үй жұмысын беріп, аяқтау',
    },
    planDone: (n: number) => (n ? `Сабақ аяқталды. Қателескен ${n} оқушыға жаттығу берілді.` : 'Сабақ аяқталды. Жауап бергендердің бәрі дұрыс шешті — үй жұмысы керек емес.'),
    ownTitle: 'Өз есептеріңіз',
    ownLead: 'Жауабы бүтін сан болатын үш есепке дейін. Келесі сабақтар үшін осы құрылғыда сақталады.',
    ownText: 'Есептің шарты',
    ownAnswer: 'Жауабы',
    ownAdd: 'Қосу',
    ownRemove: 'Есепті алып тастау',
    ownInvalid: 'Шартын (3 таңбадан) және жауабын бүтін санмен жазыңыз.',
    ownTask: 'Мұғалімнің есебі',
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
const SMALL = 'inline-flex min-h-10 items-center rounded-xl border-[3px] border-ink px-3 text-sm font-black text-ink focus-visible:outline-3 focus-visible:outline-brand disabled:opacity-40'

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

/** The course sections the bundled chapters cover, in course order (the plan's topics). */
function planSections(lang: Lang) {
  const seen = new Map<string, { key: string; label: string }>()
  for (const d of lessonChapters()) {
    const goal = CURRICULUM[d.id]
    if (!seen.has(goal.section.ru)) seen.set(goal.section.ru, { key: goal.section.ru, label: `${goal.section[lang]} · ${CURRICULUM_COPY[lang].grade(goal.grade)}` })
  }
  return [...seen.values()]
}

const PLAN_KEY = 'amc.lessonPlans'
const USED_KEY = 'amc.planUsed'
const OWN_KEY = 'amc.ownQuiz'

function readList<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeList(key: string, value: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(-30)))
  } catch {
    // Private mode: the plan still works until the page is reloaded.
  }
}

/** The plan's chapter: the first chapter of the section this device has not used in a plan yet. */
function planChapter(section: string) {
  const inSection = lessonChapters().filter((d) => CURRICULUM[d.id].section.ru === section)
  const used = readList<string>(USED_KEY)
  return inSection.find((d) => !used.includes(d.id)) ?? inSection[0]
}

type OwnTask = { text: string; answer: number }

/** The quiz: chapters of the same section first, then the teacher's own problems (3–5 in all). */
function quizTasksFor(comicId: string, own: OwnTask[]): QuizTask[] {
  const chapters = quizFor(comicId).slice(0, Math.max(0, 5 - own.length))
  return [...chapters, ...own].slice(0, 5)
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
  const sections = planSections(lang)
  const [section, setSection] = useState(sections[0]?.key ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function launch(chosen = comicId, plan = false) {
    const def = chapterDef(chosen)
    if (!def) return
    setBusy(true)
    setError(false)
    try {
      const board = await accounts.startLesson(classId, { comicId: chosen, answer: def.answer })
      if (plan) {
        writeList(PLAN_KEY, [...readList<string>(PLAN_KEY), board.id])
        writeList(USED_KEY, [...readList<string>(USED_KEY).filter((id) => id !== chosen), chosen])
      }
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
      <button type="button" onClick={() => launch()} disabled={busy || !comicId} className={`${PRIMARY} mt-3`}>
        <span aria-hidden>📽️ </span>{copy.launch}
      </button>
      <div className="mt-4 rounded-xl border-[3px] border-dashed border-ink/50 bg-sun/15 p-3">
        <h3 className="flex items-center gap-2 font-black text-ink"><span aria-hidden>⚡</span>{copy.planTitle}</h3>
        <p className="mt-0.5 text-sm font-semibold text-ink/80">{copy.planLead}</p>
        <label htmlFor={`${id}-section`} className="mt-2 block text-sm font-black text-ink/80">{copy.planTopic}</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <select id={`${id}-section`} value={section} onChange={(e) => setSection(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-3 font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun">
            {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button type="button" disabled={busy || !section} onClick={() => { const d = planChapter(section); if (d) void launch(d.id, true) }} className={PRIMARY}>
            ⚡ {copy.planLaunch}
          </button>
        </div>
      </div>
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
  const plan = useMemo(() => readList<string>(PLAN_KEY).includes(lessonId), [lessonId])
  const [timer, setTimer] = useState(plan ? 60 : 0)
  const [projector, setProjector] = useState(false)
  const [own, setOwn] = useState<OwnTask[]>(() => readList<OwnTask>(OWN_KEY).slice(0, 3))
  const [planDone, setPlanDone] = useState<number | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const def = board ? chapterDef(board.comicId) : undefined
  const comic = useMemo(() => (def ? buildLocalComic(def, lang) : null), [def, lang])
  const step = board?.step ?? 0
  const quiz = board?.quiz ?? []
  const quizDef = step && quiz[step - 1] ? chapterDef(quiz[step - 1]) : undefined
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
  const inQuiz = step > 0
  const ownText = inQuiz ? board.stepText ?? null : null
  const shown = quizComic && quizDef ? quizComic.panels[quizDef.exercisePanelId - 1] : comic.panels[Math.min(board.panel, total - 1)]
  const onExercise = !inQuiz && board.panel === exerciseIndex
  const lessonUrl = `${window.location.origin}${window.location.pathname}${joinHref(board.classCode, 'lesson')}`
  const hints = (inQuiz ? quizDef?.text[lang].commonMistakes : def.text[lang].commonMistakes) ?? {}
  const attempt = board.attempt ?? 1
  const quizTasks = quizTasksFor(board.comicId, own)
  const prompt = ownText ?? (inQuiz && quizComic ? quizComic.exercise.prompt : comic.exercise.prompt)

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

  type PlanAction = keyof typeof copy.planActions
  /** The plan's next step, from where the lesson is now (null: nothing left). */
  function planAction(): PlanAction | null {
    const b = board!
    if (b.phase === 'closed' || planDone != null) return null
    if (b.phase === 'answering') return 'reveal'
    if (b.phase === 'podium') return 'homework'
    if (inQuiz) return b.phase === 'reveal' ? (step < quiz.length ? 'question' : 'podium') : null
    if (b.phase === 'reading') return b.panel < exerciseIndex ? 'panel' : 'collect'
    if (attempt === 1) return 'retry'
    if (b.panel < total - 1) return 'ending'
    return quizTasks.length >= 3 ? 'quiz' : 'homework'
  }

  async function finishPlan() {
    setBusy(true)
    try {
      const report = (await accounts.lessonReports(board!.classId)).find((r) => r.id === lessonId)
      const given = report ? await giveDrill(board!.classId, report) : 0
      setValue(await accounts.updateLesson(lessonId, { phase: 'closed' }))
      setPlanDone(given)
    } finally {
      setBusy(false)
    }
  }

  function planNext() {
    const action = planAction()
    if (busy || !action) return
    if (action === 'panel') return void update({ panel: board!.panel + 1 })
    if (action === 'collect') return void collect()
    if (action === 'reveal') return void update({ phase: 'reveal' })
    if (action === 'retry') return void update({ retry: true, timer })
    if (action === 'ending') return void update({ panel: total - 1 })
    if (action === 'quiz') return void run(() => accounts.startQuiz(lessonId, quizTasks))
    if (action === 'question' || action === 'podium') return void nextQuestion()
    void finishPlan()
  }

  function forward() {
    if (plan) return planNext()
    if (busy || board!.phase === 'podium' || board!.phase === 'closed') return
    if (board!.phase === 'answering') return void update({ phase: 'reveal' })
    if (inQuiz) return void (board!.phase === 'reveal' && nextQuestion())
    if (onExercise && board!.phase === 'reading') return void collect()
    if (board!.panel < maxPanel) void update({ panel: board!.panel + 1 })
  }

  /** Where the plan is: comic, answers, walkthrough, ending, quiz, homework. */
  function planStage() {
    if (planDone != null || board!.phase === 'closed' || board!.phase === 'podium') return 5
    if (inQuiz) return 4
    if (board!.phase === 'reading' && board!.panel < exerciseIndex) return 0
    if (attempt === 1) return 1
    return board!.panel >= total - 1 ? 3 : 2
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
              <OwnTasks own={own} lang={lang} onChange={(next) => { setOwn(next); writeList(OWN_KEY, next) }} />
              {!plan && <button type="button" disabled={busy} onClick={() => run(() => accounts.startQuiz(lessonId, quizTasks))} className={`${PRIMARY} mt-2 w-full`}>{copy.quizStart}</button>}
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
    <fieldset className="mt-2" title={copy.timerHint}>
      <legend className="text-sm font-black text-ink/80">⏱ {copy.timer}</legend>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {TIMERS.map((t) => (
          <label key={t} className="cursor-pointer rounded-lg border-2 border-ink bg-white px-1 py-1 text-center text-xs font-black text-ink has-checked:bg-sun has-focus-visible:outline-3 has-focus-visible:outline-brand">
            <input type="radio" name={`${lessonId}-timer`} className="sr-only" checked={timer === t} onChange={() => setTimer(t)} />
            {t ? copy.seconds(t) : copy.noTimer}
          </label>
        ))}
      </div>
      <p className="sr-only">{copy.timerHint}</p>
    </fieldset>
  )

  return (
    <div ref={frame} className={`flex flex-col gap-3 ${projector ? 'lesson-projector overflow-auto bg-paper p-4' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-black text-ink sm:text-2xl">{comic.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-ink/70">
            {board.className} · {board.phase === 'podium' ? copy.podium : inQuiz ? copy.question(step, quiz.length) : copy.panel(board.panel + 1, total)}
            {attempt === 2 && !step && <span className="ml-2 rounded-md bg-ink px-1.5 py-0.5 text-sm text-white">{copy.secondTry}</span>}
          </p>
          <button type="button" onClick={toggleProjector} aria-pressed={projector} title={copy.keys}
            className="min-h-10 rounded-xl border-[3px] border-ink bg-white px-3 text-sm font-black text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-brand">
            <span aria-hidden>⛶ </span>{projector ? copy.projectorOff : copy.projector}
          </button>
          {!inQuiz && board.phase !== 'podium' && !plan && (
            <>
              <button type="button" disabled={busy || board.panel === 0} onClick={() => update({ panel: board.panel - 1 })} className={`${SMALL} bg-white hover:bg-sky`}>← {copy.prev}</button>
              <button type="button" disabled={busy || board.panel >= maxPanel} onClick={() => update({ panel: board.panel + 1 })} className={`${SMALL} bg-sun`}>{copy.next} →</button>
            </>
          )}
          <button type="button" disabled={busy} onClick={async () => { await update({ phase: 'closed' }); window.location.hash = teacherClassHref(board.classId) }} className={`${SMALL} bg-white hover:bg-rose-50`}>{copy.finish}</button>
          <a href={teacherClassHref(board.classId)} className={`${SMALL} bg-white hover:bg-sky`}>{copy.back}</a>
        </div>
      </div>

      {plan && (
        <PlanBar lang={lang} stage={planStage()} action={planAction()} busy={busy} onNext={planNext} />
      )}
      {planDone != null && (
        <section className={`${CARD} flex flex-wrap items-center gap-3`} role="status">
          <p className="min-w-0 flex-1 text-lg font-black text-emerald-800">✓ {copy.planDone(planDone)}</p>
          <a href={teacherClassHref(board.classId)} className={PRIMARY}>{copy.back} →</a>
        </section>
      )}
      {planDone != null ? null : board.phase === 'podium' ? (
        <section className={`${CARD} flex flex-col items-center gap-4`} aria-live="polite">
          <h2 className="text-3xl font-black text-ink">🏆 {copy.podium}</h2>
          <Podium rows={board.podium ?? []} lang={lang} />
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {ownText ? (
            <section className="flex min-h-64 flex-col justify-center gap-3 rounded-2xl border-[5px] border-ink bg-sun/30 p-6">
              <p className="text-sm font-black text-brand-dark">✏️ {copy.ownTask} · {copy.question(step, quiz.length)}</p>
              <p className="text-3xl leading-snug font-black text-ink sm:text-4xl">{ownText}</p>
            </section>
          ) : (
            <figure className="mx-auto w-full overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100" style={{ maxWidth: `calc((100vh - ${plan ? 13 : 9.5}rem) * 16 / 9)` }} aria-label={`${shown.speaker}: ${shown.text}`}>
              <PanelArt imageKey={shown.imageKey} imageUrl={shown.imageUrl} lang={lang} speaker={shown.speaker} text={shown.text}
                imageAspect={shown.imageAspect} placeholder={shown.placeholder} priority />
            </figure>
          )}
          <aside className="flex flex-col gap-3">
            {(onExercise || inQuiz) && (
              <section className={CARD}>
                {inQuiz && <p className="mb-1 text-sm font-black text-brand-dark">🏆 {copy.quiz} · {quizDef ? chapterTitle(quizDef.id, lang) : copy.ownTask}</p>}
                {!ownText && <p className="text-lg leading-snug font-extrabold text-ink"><RichText text={prompt} /></p>}
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
      {!projector && <p className="text-xs font-semibold text-ink/60">⌨️ {copy.keys}</p>}
    </div>
  )
}

/** The plan's stages and its one button (also the arrow keys and the clicker). */
function PlanBar({ lang, stage, action, busy, onNext }: { lang: Lang; stage: number; action: keyof (typeof LESSON_COPY)['ru']['planActions'] | null; busy: boolean; onNext: () => void }) {
  const copy = LESSON_COPY[lang]
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_3px_0_var(--shadow-ink)] sm:flex-row sm:items-center" aria-label={copy.planTitle}>
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {copy.planStages.map((name, i) => (
          <li key={name} aria-current={i === stage ? 'step' : undefined}
            className={`rounded-full border-2 px-2.5 py-0.5 text-sm font-black ${i === stage ? 'border-ink bg-sun text-ink' : i < stage ? 'border-emerald-600 bg-emerald-100 text-emerald-900' : 'border-ink/30 text-ink/60'}`}>
            {i < stage ? '✓ ' : `${i + 1}. `}{name}
          </li>
        ))}
      </ol>
      {action && (
        <button type="button" disabled={busy} onClick={onNext} className={`${PRIMARY} shrink-0`}>
          ⚡ {copy.planNext}: {copy.planActions[action]} →
        </button>
      )}
    </section>
  )
}

/** The teacher's own quiz problems (up to three, kept on this device). */
function OwnTasks({ own, lang, onChange }: { own: OwnTask[]; lang: Lang; onChange: (next: OwnTask[]) => void }) {
  const copy = LESSON_COPY[lang]
  const id = useId()
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [invalid, setInvalid] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const value = answer.trim()
    if (text.trim().length < 3 || !/^\d{1,7}$/.test(value)) return setInvalid(true)
    setInvalid(false)
    onChange([...own, { text: text.trim().slice(0, 300), answer: Number(value) }].slice(0, 3))
    setText('')
    setAnswer('')
  }

  return (
    <details className="mt-2" open={own.length > 0}>
      <summary className="cursor-pointer text-sm font-black text-ink">✏️ {copy.ownTitle} ({own.length}/3)</summary>
      <p className="mt-1 text-xs font-semibold text-ink/70">{copy.ownLead}</p>
      {own.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {own.map((t, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-sky-50 px-2 py-1 text-sm font-semibold text-ink">
              <span className="min-w-0 flex-1">{t.text} <span className="font-black">= {t.answer}</span></span>
              <button type="button" onClick={() => onChange(own.filter((_, j) => j !== i))} aria-label={copy.ownRemove} title={copy.ownRemove}
                className="grid size-6 shrink-0 place-items-center rounded-full font-black hover:bg-ink hover:text-white">×</button>
            </li>
          ))}
        </ul>
      )}
      {own.length < 3 && (
        <form onSubmit={add} className="mt-2 flex flex-col gap-1.5">
          <label htmlFor={`${id}-text`} className="sr-only">{copy.ownText}</label>
          <textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} placeholder={copy.ownText}
            className="w-full rounded-lg border-2 border-ink bg-white px-2 py-1 text-sm font-semibold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
          <div className="flex gap-1.5">
            <label htmlFor={`${id}-answer`} className="sr-only">{copy.ownAnswer}</label>
            <input id={`${id}-answer`} value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode="numeric" placeholder={copy.ownAnswer}
              className="min-h-10 w-24 min-w-0 rounded-lg border-2 border-ink bg-white px-2 font-mono font-bold text-ink focus-visible:ring-4 focus-visible:ring-sun" />
            <button type="submit" className={`${SECONDARY} min-h-10 flex-1 text-sm`}>＋ {copy.ownAdd}</button>
          </div>
          {invalid && <p role="alert" className="text-xs font-bold text-rose-700">{copy.ownInvalid}</p>}
        </form>
      )}
    </details>
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
  const prompt = lesson.stepText ?? (quizComic ? quizComic.exercise.prompt : comic.exercise.prompt)
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
      ) : lesson.stepText ? null : (
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
