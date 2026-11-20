import type { CheckStatus, Difficulty, Lang, Topic } from './api'
import type { CharacterId } from './characters'

// UI chrome strings. Comic content, feedback and hints come from the API.
export interface UiStrings {
  langName: string
  langShort: string
  langLabel: string
  loading: string
  loadError: string
  retry: string
  prev: string
  next: string
  panelOf: (n: number, total: number) => string
  preparedArtwork: string
  goToPanel: (n: number) => string
  locked: string
  restart: string
  exerciseTitle: string
  answerLabel: string
  answerPlaceholder: string
  check: string
  checking: string
  checkError: string
  status: Record<CheckStatus, string>
  pifikName: string
  askHint: string
  nextHint: string
  hintLoading: string
  hintError: string
  noMoreHints: string
  hintN: (n: number) => string
  mockBadge: string
  tagline: string
  castTitle: string
  cast: Record<CharacterId, { name: string; role: string; about: string }>
  unlocked: string
  comicPage: string
  // Generate flow
  createTitle: string
  createLead: string
  gradeLabel: string
  gradeOption: (n: number) => string
  topicLabel: string
  topics: Record<Topic, string>
  comicLangLabel: string
  difficultyLabel: string
  difficulties: Record<Difficulty, string>
  generate: string
  submitting: string
  jobQueued: string
  jobRunning: string
  jobWaitNote: string
  jobSteps: [string, string, string]
  jobElapsed: (s: number) => string
  stopWaiting: string
  pollPaused: string
  resumeChecking: string
  jobReady: string
  jobFailedTitle: string
  jobErrors: { generation_failed: string; api: string; lost: string; unknown: string }
  errorDetails: string
  tryAgain: string
  changeParams: string
  demoBadge: string
  demoTitle: string
  demoLead: string
  demoTeaser: string
  readComic: string
  backHome: string
  imageError: string
}

export const STRINGS: Record<Lang, UiStrings> = {
  ru: {
    langName: 'Русский',
    preparedArtwork: 'История создана ИИ · готовые иллюстрации',
    langShort: 'РУС',
    langLabel: 'Язык',
    loading: 'Загружаем комикс…',
    loadError: 'Не удалось загрузить комикс.',
    retry: 'Повторить',
    prev: 'Назад',
    next: 'Далее',
    panelOf: (n, t) => `Кадр ${n} из ${t}`,
    goToPanel: (n) => `Перейти к кадру ${n}`,
    locked: 'Реши задание, чтобы читать дальше',
    restart: 'Читать сначала',
    exerciseTitle: 'Задание',
    answerLabel: 'Твой ответ',
    answerPlaceholder: 'например, 1/2',
    check: 'Проверить',
    checking: 'Проверяем…',
    checkError: 'Не удалось проверить ответ. Попробуй ещё раз.',
    status: { correct: 'Верно!', incorrect: 'Не совсем', invalid: 'Проверь запись' },
    pifikName: 'Пифик',
    askHint: 'Попросить подсказку',
    nextHint: 'Ещё подсказка',
    hintLoading: 'Пифик думает…',
    hintError: 'Пифик не смог ответить. Попробуй ещё раз.',
    noMoreHints: 'Подсказки закончились — у тебя получится!',
    hintN: (n) => `Подсказка ${n}`,
    mockBadge: 'демо-данные',
    tagline: 'Математика в комиксах с AI',
    castTitle: 'Герои',
    cast: {
      aldiyar: { name: 'Алдияр', role: 'главный герой', about: 'Любознательный, любит решать задачи.' },
      aruna: { name: 'Аруна', role: 'подруга', about: 'Внимательная и креативная, помогает разобраться.' },
      pifik: { name: 'Пифик', role: 'AI-помощник', about: 'Объясняет правила и даёт подсказки.' },
    },
    unlocked: 'Кадры 5–6 открыты! Читай дальше →',
    comicPage: 'Комикс',
    createTitle: 'Создай свой комикс',
    createLead: 'Выбери класс и сложность — Пифик нарисует новую историю с задачей.',
    gradeLabel: 'Класс',
    gradeOption: (n) => `${n} класс`,
    topicLabel: 'Тема',
    topics: { fractions: 'Дроби' },
    comicLangLabel: 'Язык комикса',
    difficultyLabel: 'Сложность',
    difficulties: { basic: 'Базовая', intermediate: 'Средняя', advanced: 'Продвинутая' },
    generate: 'Создать комикс',
    submitting: 'Отправляем…',
    jobQueued: 'Задание в очереди…',
    jobRunning: 'Пифик рисует комикс…',
    jobWaitNote: 'Обычно это занимает меньше минуты.',
    jobSteps: ['Задание принято', 'Рисуем кадры', 'Готово'],
    jobElapsed: (s) => `${s} с`,
    stopWaiting: 'Приостановить проверку',
    pollPaused: 'Проверка приостановлена. Комикс может ещё создаваться.',
    resumeChecking: 'Проверить статус',
    jobReady: 'Готово! Открываем комикс…',
    jobFailedTitle: 'Не удалось создать комикс',
    jobErrors: {
      generation_failed: 'Генерация не удалась. Попробуй ещё раз.',
      api: 'Сервер не ответил как ожидалось. Проверь подключение и попробуй снова.',
      lost: 'Задание не найдено на сервере.',
      unknown: 'Что-то пошло не так при создании комикса.',
    },
    errorDetails: 'Подробности',
    tryAgain: 'Попробовать снова',
    changeParams: 'Изменить параметры',
    demoBadge: 'Демо',
    demoTitle: 'Пицца для всех',
    demoLead: 'Готовый комикс: три пиццы на четверых друзей.',
    demoTeaser: 'Как разделить три пиццы на четверых?',
    readComic: 'Читать комикс',
    backHome: 'Все комиксы',
    imageError: 'Картинка не загрузилась',
  },
  kk: {
    langName: 'Қазақша',
    preparedArtwork: 'Оқиғаны ЖИ құрастырды · дайын иллюстрациялар',
    langShort: 'ҚАЗ',
    langLabel: 'Тіл',
    loading: 'Комикс жүктелуде…',
    loadError: 'Комиксті жүктеу мүмкін болмады.',
    retry: 'Қайталау',
    prev: 'Артқа',
    next: 'Әрі қарай',
    panelOf: (n, t) => `Кадр ${n} / ${t}`,
    goToPanel: (n) => `${n}-кадрға өту`,
    locked: 'Әрі қарай оқу үшін тапсырманы шеш',
    restart: 'Басынан оқу',
    exerciseTitle: 'Тапсырма',
    answerLabel: 'Сенің жауабың',
    answerPlaceholder: 'мысалы, 1/2',
    check: 'Тексеру',
    checking: 'Тексерілуде…',
    checkError: 'Жауапты тексеру мүмкін болмады. Қайтадан байқап көр.',
    status: { correct: 'Дұрыс!', incorrect: 'Әзірге емес', invalid: 'Жазылуын тексер' },
    pifikName: 'Пифик',
    askHint: 'Кеңес сұрау',
    nextHint: 'Тағы бір кеңес',
    hintLoading: 'Пифик ойланып жатыр…',
    hintError: 'Пифик жауап бере алмады. Қайтадан байқап көр.',
    noMoreHints: 'Кеңестер бітті — сенің қолыңнан келеді!',
    hintN: (n) => `${n}-кеңес`,
    mockBadge: 'демо деректер',
    tagline: 'AI көмегімен комикстегі математика',
    castTitle: 'Кейіпкерлер',
    cast: {
      aldiyar: { name: 'Алдияр', role: 'басты кейіпкер', about: 'Білуге құмар, есеп шығарғанды жақсы көреді.' },
      aruna: { name: 'Аруна', role: 'құрбысы', about: 'Зейінді әрі шығармашыл, түсінуге көмектеседі.' },
      pifik: { name: 'Пифик', role: 'AI-көмекші', about: 'Ережелерді түсіндіреді, кеңес береді.' },
    },
    unlocked: '5–6 кадрлар ашылды! Әрі қарай оқы →',
    comicPage: 'Комикс',
    createTitle: 'Өз комиксіңді жаса',
    createLead: 'Сынып пен күрделілікті таңда — Пифик есебі бар жаңа оқиға салады.',
    gradeLabel: 'Сынып',
    gradeOption: (n) => `${n}-сынып`,
    topicLabel: 'Тақырып',
    topics: { fractions: 'Бөлшектер' },
    comicLangLabel: 'Комикс тілі',
    difficultyLabel: 'Күрделілігі',
    difficulties: { basic: 'Базалық', intermediate: 'Орташа', advanced: 'Күрделі' },
    generate: 'Комикс жасау',
    submitting: 'Жіберілуде…',
    jobQueued: 'Тапсырма кезекте…',
    jobRunning: 'Пифик комикс салып жатыр…',
    jobWaitNote: 'Әдетте бұл бір минуттан аз уақыт алады.',
    jobSteps: ['Тапсырма қабылданды', 'Кадрлар салынуда', 'Дайын'],
    jobElapsed: (s) => `${s} с`,
    stopWaiting: 'Тексеруді кідірту',
    pollPaused: 'Тексеру кідіртілді. Комикс әлі жасалып жатуы мүмкін.',
    resumeChecking: 'Күйін тексеру',
    jobReady: 'Дайын! Комикс ашылуда…',
    jobFailedTitle: 'Комикс жасау мүмкін болмады',
    jobErrors: {
      generation_failed: 'Генерация сәтсіз аяқталды. Қайтадан байқап көр.',
      api: 'Сервер күткендей жауап бермеді. Байланысты тексеріп, қайтадан байқап көр.',
      lost: 'Тапсырма серверде табылмады.',
      unknown: 'Комикс жасау кезінде бірдеңе дұрыс болмады.',
    },
    errorDetails: 'Толығырақ',
    tryAgain: 'Қайтадан байқау',
    changeParams: 'Параметрлерді өзгерту',
    demoBadge: 'Демо',
    demoTitle: 'Барлығына пицца',
    demoLead: 'Дайын комикс: төрт досқа үш пицца.',
    demoTeaser: 'Үш пиццаны төртеуге қалай бөлеміз?',
    readComic: 'Комиксті оқу',
    backHome: 'Барлық комикстер',
    imageError: 'Сурет жүктелмеді',
  },
}
