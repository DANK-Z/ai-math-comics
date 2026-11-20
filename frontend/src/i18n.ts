import type { CheckStatus, Difficulty, Lang, Topic } from './api'
import type { CharacterId } from './characters'
import type { SchoolFairCollectible, SchoolFairLocation } from './schoolFair'

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
  wholeNumberPlaceholder: string
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
  catalogTitle: string
  schoolFairTitle: string
  chapterLabel: (n: number) => string
  seasonProgress: (completed: number, total: number) => string
  chapterCompleted: string
  backpack: {
    title: string
    progress: (earned: number, total: number) => string
    empty: string
    reward: (item: string) => string
    items: Record<SchoolFairCollectible, { name: string; story: string }>
  }
  fairRoute: {
    title: string
    suggested: string
    guardianUnlocked: string
    locations: Record<SchoolFairLocation, string>
  }
  guardian: {
    title: string
    name: string
    intro: string
    locked: string
    remaining: (count: number) => string
    hp: (current: number, max: number) => string
    round: (current: number, total: number) => string
    cleared: string
    active: string
    upcoming: string
    wrong: string
    invalidFraction: string
    invalidNumber: string
    victory: string
    victoryText: string
    replay: string
    wonBadge: string
  }
  nextChapter: string
  backToCatalog: string
  /** One-line explanation of the interactive format, shown under the catalog heading. */
  catalogLead: string
  catalogTopics: { fractions: string; percentages: string; scale: string; equations: string; proportions: string; perimeter: string }
  pizzaHook: string
  createOwn: string
  hideForm: string
  /** Generation copy when the backend runs COMIC_ART_MODE=prepared (no new images are drawn). */
  prepared: { createLead: string; jobRunning: string; jobSteps: [string, string, string] }
  demoTitle: string
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
    wholeNumberPlaceholder: 'например, 1 500',
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
    unlocked: 'Читай дальше →',
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
    catalogTitle: 'Каталог комиксов',
    schoolFairTitle: 'Операция: школьная ярмарка',
    chapterLabel: (n) => `Глава ${n}`,
    seasonProgress: (completed, total) => `Пройдено: ${completed} из ${total} глав`,
    chapterCompleted: 'Пройдено',
    backpack: {
      title: 'Рюкзак',
      progress: (earned, total) => `Предметы: ${earned} из ${total}`,
      empty: 'Реши задачу в любой главе, чтобы получить первый предмет.',
      reward: (item) => `В рюкзаке новый предмет — «${item}»!`,
      items: {
        'pizza-token': { name: 'Жетон с пиццей', story: 'На память о том, как друзья поделили пиццу в столовой.' },
        'yellow-backpack': { name: 'Жёлтый рюкзак', story: 'Купили со скидкой в школьном магазине. Внутри нашлась карта ярмарки.' },
        'clue-envelope': { name: 'Конверт с подсказкой', story: 'Нашли в школьном дворе. Подсказка привела друзей в библиотеку.' },
        'prize-book': { name: 'Книга-приз', story: 'Из библиотечных коробок друзья собрали призы для ярмарки.' },
        'lemonade-recipe': { name: 'Рецепт лимонада', story: 'По нему друзья приготовили напиток для гостей ярмарки.' },
        'festival-garland': { name: 'Праздничная гирлянда', story: 'Ею украсили края финишного стенда перед открытием ярмарки.' },
      },
    },
    fairRoute: {
      title: 'Маршрут ярмарки',
      suggested: 'Следующая остановка',
      guardianUnlocked: 'Испытание открыто',
      locations: {
        cafeteria: 'Столовая',
        store: 'Школьный магазин',
        schoolyard: 'Школьный двор',
        library: 'Библиотека',
        lemonade: 'Лимонадный киоск',
        finish: 'Финиш ярмарки',
      },
    },
    guardian: {
      title: 'Финальное испытание',
      name: 'Страж ярмарки',
      intro: 'Пифик стал Стражем ярмарки. Реши три задачи: каждый верный ответ снимает 30 HP в его испытании.',
      locked: 'Испытание откроется после прохождения всех глав.',
      remaining: (count) => `Осталось пройти глав: ${count}`,
      hp: (current, max) => `${current} / ${max} HP`,
      round: (current, total) => `Раунд ${current} из ${total}`,
      cleared: 'Пройден',
      active: 'Текущий',
      upcoming: 'Впереди',
      wrong: 'Попробуй ещё раз. HP Стража не изменилось.',
      invalidFraction: 'Запиши ответ дробью, например 1/2.',
      invalidNumber: 'Введи целое число без единиц измерения.',
      victory: 'Испытание пройдено!',
      victoryText: 'Страж поздравляет тебя: ты решил все задачи ярмарки.',
      replay: 'Пройти заново',
      wonBadge: 'Испытание пройдено',
    },
    nextChapter: 'Следующая глава',
    backToCatalog: 'Вернуться в каталог',
    catalogLead: 'Реши задачу, чтобы открыть финал истории.',
    catalogTopics: {
      fractions: 'Дроби',
      percentages: 'Проценты',
      scale: 'Масштаб',
      equations: 'Уравнения',
      proportions: 'Пропорции',
      perimeter: 'Периметр',
    },
    pizzaHook: 'Три пиццы, четверо друзей. Как поделить поровну?',
    createOwn: 'Создать свой комикс',
    hideForm: 'Свернуть',
    prepared: {
      createLead: 'Выбери класс и сложность — Пифик придумает историю и задачу на дроби с готовыми иллюстрациями.',
      jobRunning: 'Пифик сочиняет историю…',
      jobSteps: ['Задание принято', 'Пишем историю', 'Готово'],
    },
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
    wholeNumberPlaceholder: 'мысалы, 1 500',
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
    unlocked: 'Әрі қарай оқы →',
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
    catalogTitle: 'Комикстер каталогы',
    schoolFairTitle: 'Операция: мектеп жәрмеңкесі',
    chapterLabel: (n) => `${n}-тарау`,
    seasonProgress: (completed, total) => `Аяқталған тараулар: ${completed} / ${total}`,
    chapterCompleted: 'Аяқталды',
    backpack: {
      title: 'Сөмке',
      progress: (earned, total) => `Жиналған заттар: ${earned} / ${total}`,
      empty: 'Алғашқы затты алу үшін кез келген тараудағы есепті шығар.',
      reward: (item) => `Сөмкеге «${item}» қосылды!`,
      items: {
        'pizza-token': { name: 'Пицца бейнеленген жетон', story: 'Достардың асханада пиццаны бөліскен сәтінен естелік.' },
        'yellow-backpack': { name: 'Сары сөмке', story: 'Мектеп дүкенінен жеңілдікпен алды. Ішінен жәрмеңке картасы табылды.' },
        'clue-envelope': { name: 'Кеңес салынған конверт', story: 'Мектеп ауласынан табылды. Кеңес достарды кітапханаға жетеледі.' },
        'prize-book': { name: 'Сыйлық кітап', story: 'Достар кітапханадағы қораптардан жәрмеңкеге сыйлық жинады.' },
        'lemonade-recipe': { name: 'Лимонад рецепті', story: 'Достар осы рецептпен жәрмеңке қонақтарына сусын дайындады.' },
        'festival-garland': { name: 'Мерекелік гирлянда', story: 'Жәрмеңке ашыларда достар оны мәре стендінің шеттеріне ілді.' },
      },
    },
    fairRoute: {
      title: 'Жәрмеңке бағыты',
      suggested: 'Келесі аялдама',
      guardianUnlocked: 'Сынақ ашық',
      locations: {
        cafeteria: 'Асхана',
        store: 'Мектеп дүкені',
        schoolyard: 'Мектеп ауласы',
        library: 'Кітапхана',
        lemonade: 'Лимонад дүңгіршегі',
        finish: 'Жәрмеңке мәресі',
      },
    },
    guardian: {
      title: 'Соңғы сынақ',
      name: 'Жәрмеңке сақшысы',
      intro: 'Пифик жәрмеңке сақшысы болды. Үш есепті шығар: әр дұрыс жауап сынақтағы HP көрсеткішін 30-ға азайтады.',
      locked: 'Сынақ барлық тараудан өткен соң ашылады.',
      remaining: (count) => `Әлі ${count} тарау қалды`,
      hp: (current, max) => `${current} / ${max} HP`,
      round: (current, total) => `${total} раундтың ${current}-раунды`,
      cleared: 'Аяқталды',
      active: 'Ағымдағы',
      upcoming: 'Алда',
      wrong: 'Қайта байқап көр. Сақшының HP көрсеткіші өзгерген жоқ.',
      invalidFraction: 'Жауабыңды бөлшекпен жаз, мысалы 1/2.',
      invalidNumber: 'Өлшем бірлігінсіз бүтін сан енгіз.',
      victory: 'Сынақтан өттің!',
      victoryText: 'Сақшы сені құттықтайды: жәрмеңкедегі барлық есепті шығардың.',
      replay: 'Қайта өту',
      wonBadge: 'Сынақ аяқталды',
    },
    nextChapter: 'Келесі тарау',
    backToCatalog: 'Каталогқа оралу',
    catalogLead: 'Оқиғаның соңын ашу үшін есепті шеш.',
    catalogTopics: {
      fractions: 'Бөлшектер',
      percentages: 'Пайыздар',
      scale: 'Масштаб',
      equations: 'Теңдеулер',
      proportions: 'Пропорциялар',
      perimeter: 'Периметр',
    },
    pizzaHook: 'Үш пицца, төрт дос. Қалай тең бөлеміз?',
    createOwn: 'Өз комиксіңді жасау',
    hideForm: 'Жасыру',
    prepared: {
      createLead: 'Сынып пен күрделілікті таңда — Пифик дайын иллюстрациялармен оқиға мен бөлшектерге есеп құрастырады.',
      jobRunning: 'Пифик оқиға құрастырып жатыр…',
      jobSteps: ['Тапсырма қабылданды', 'Оқиға жазылуда', 'Дайын'],
    },
    readComic: 'Комиксті оқу',
    backHome: 'Барлық комикстер',
    imageError: 'Сурет жүктелмеді',
  },
}
