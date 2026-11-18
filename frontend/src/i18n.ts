import type { CheckStatus, Lang } from './api'
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
}

export const STRINGS: Record<Lang, UiStrings> = {
  ru: {
    langName: 'Русский',
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
  },
  kk: {
    langName: 'Қазақша',
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
  },
}
