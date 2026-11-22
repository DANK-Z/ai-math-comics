import type { CastHeroId, CheckStatus, Comic, Difficulty, Grade, Lang, StoryOptions } from './types'

// Contract-matching stand-ins for comics produced by POST /api/comic-jobs.
// One fraction problem per grade × difficulty, in both languages, so the
// reader's language switch works on mock comics too.

interface Problem {
  /** Exact answer as num/den (integers use den 1). */
  answer: [bigint, bigint]
  title: string
  setup: string // Аруна
  question: string // Алдияр
  method: string // Аруна, after solving
  reveal: string // Алдияр, after solving
  prompt: string
  hints: [string, string]
}

type Key = `${Grade}-${Difficulty}`

const PROBLEMS: Record<Key, Record<Lang, Problem>> = {
  '5-basic': {
    ru: {
      answer: [2n, 3n],
      title: 'Два пирога на троих',
      setup: 'Бабушка испекла два одинаковых пирога.',
      question: 'Нас трое. Сколько пирога достанется каждому?',
      method: 'Разрежем каждый пирог на 3 равные части!',
      reveal: 'Каждому по 2 кусочка, то есть 2/3 пирога!',
      prompt: 'Два одинаковых пирога разделили поровну между тремя друзьями. Какую часть пирога получит каждый? Запиши ответ дробью.',
      hints: [
        'Деление можно записать дробью: сколько пирогов делим / на сколько друзей.',
        'Разрежь каждый пирог на 3 части. Сколько всего кусочков и сколько достанется одному?',
      ],
    },
    kk: {
      answer: [2n, 3n],
      title: 'Үшеуге екі бәліш',
      setup: 'Әжем екі бірдей бәліш пісірді.',
      question: 'Біз үшеуміз. Әрқайсымызға бәліштің қанша бөлігі тиеді?',
      method: 'Әр бәлішті 3 тең бөлікке кесейік!',
      reveal: 'Әрқайсымызға 2 тілімнен, яғни бәліштің 2/3 бөлігі!',
      prompt: 'Екі бірдей бәлішті үш досқа тең бөлді. Әр дос бәліштің қандай бөлігін алады? Жауапты бөлшекпен жаз.',
      hints: [
        'Бөлуді бөлшекпен жазуға болады: неше бәліш бөлінеді / неше досқа.',
        'Әр бәлішті 3 бөлікке кес. Барлығы неше тілім және біреуіне нешеуі тиеді?',
      ],
    },
  },
  '5-intermediate': {
    ru: {
      answer: [5n, 8n],
      title: 'Пять пицц для класса',
      setup: 'На классный праздник принесли пять одинаковых пицц.',
      question: 'А нас восемь! Как разделить поровну?',
      method: 'Разрежем каждую пиццу на 8 кусочков — всего 40.',
      reveal: 'Каждому по 5 кусочков — это 5/8 пиццы!',
      prompt: 'Пять одинаковых пицц разделили поровну между восемью друзьями. Какую часть пиццы получит каждый? Запиши ответ дробью.',
      hints: [
        'Сколько пицц делим и на сколько человек? Запиши это дробью.',
        'Если разрезать каждую пиццу на 8 частей, сколько всего получится кусочков? Раздели их на восьмерых.',
      ],
    },
    kk: {
      answer: [5n, 8n],
      title: 'Сыныпқа бес пицца',
      setup: 'Сынып мерекесіне бес бірдей пицца әкелді.',
      question: 'Ал біз сегізбіз! Қалай тең бөлеміз?',
      method: 'Әр пиццаны 8 тілімге кесейік — барлығы 40 тілім.',
      reveal: 'Әрқайсымызға 5 тілімнен — бұл пиццаның 5/8 бөлігі!',
      prompt: 'Бес бірдей пиццаны сегіз досқа тең бөлді. Әр дос пиццаның қандай бөлігін алады? Жауапты бөлшекпен жаз.',
      hints: [
        'Неше пицца бөлінеді және неше адамға? Мұны бөлшекпен жаз.',
        'Әр пиццаны 8 бөлікке кессең, барлығы неше тілім шығады? Оларды сегіз адамға бөл.',
      ],
    },
  },
  '5-advanced': {
    ru: {
      answer: [7n, 8n],
      title: 'Сколько пиццы съели?',
      setup: 'Я съела 3/8 пиццы, а Алдияр — 1/2.',
      question: 'Какую часть пиццы мы съели вместе?',
      method: 'Приведём к знаменателю 8: 1/2 = 4/8.',
      reveal: '3/8 + 4/8 = 7/8 пиццы. Остался один кусочек!',
      prompt: 'Аруна съела 3/8 пиццы, а Алдияр — 1/2 этой же пиццы. Какую часть пиццы они съели вместе? Запиши ответ дробью.',
      hints: [
        'Чтобы сложить дроби, им нужен одинаковый знаменатель.',
        'Сколько восьмых долей в половине? Потом сложи числители.',
      ],
    },
    kk: {
      answer: [7n, 8n],
      title: 'Қанша пицца жедік?',
      setup: 'Мен пиццаның 3/8 бөлігін жедім, ал Алдияр — 1/2 бөлігін.',
      question: 'Екеуміз бірге пиццаның қандай бөлігін жедік?',
      method: 'Бөлімді 8-ге келтірейік: 1/2 = 4/8.',
      reveal: '3/8 + 4/8 = 7/8 пицца. Бір тілім қалды!',
      prompt: 'Аруна пиццаның 3/8 бөлігін, ал Алдияр сол пиццаның 1/2 бөлігін жеді. Екеуі бірге пиццаның қандай бөлігін жеді? Жауапты бөлшекпен жаз.',
      hints: [
        'Бөлшектерді қосу үшін олардың бөлімдері бірдей болуы керек.',
        'Жартыда неше сегізінші үлес бар? Содан кейін алымдарын қос.',
      ],
    },
  },
  '6-basic': {
    ru: {
      answer: [1n, 2n],
      title: 'Часть от части',
      setup: 'От пиццы осталось 3/4.',
      question: 'Я съем 2/3 остатка. Это сколько всей пиццы?',
      method: 'Найти часть от числа — значит умножить: 2/3 · 3/4.',
      reveal: '2/3 · 3/4 = 6/12 = 1/2. Ровно половина пиццы!',
      prompt: 'От пиццы осталось 3/4. Алдияр съел 2/3 остатка. Какую часть всей пиццы он съел? Запиши ответ дробью.',
      hints: [
        'Чтобы найти часть от дроби, дроби нужно перемножить.',
        'Умножь числители и знаменатели, а потом сократи дробь.',
      ],
    },
    kk: {
      answer: [1n, 2n],
      title: 'Бөліктің бөлігі',
      setup: 'Пиццаның 3/4 бөлігі қалды.',
      question: 'Мен қалғанының 2/3 бөлігін жеймін. Бұл бүкіл пиццаның қанша бөлігі?',
      method: 'Санның бөлігін табу үшін көбейтеміз: 2/3 · 3/4.',
      reveal: '2/3 · 3/4 = 6/12 = 1/2. Дәл жарты пицца!',
      prompt: 'Пиццаның 3/4 бөлігі қалды. Алдияр қалғанының 2/3 бөлігін жеді. Ол бүкіл пиццаның қандай бөлігін жеді? Жауапты бөлшекпен жаз.',
      hints: [
        'Бөлшектің бөлігін табу үшін бөлшектерді көбейту керек.',
        'Алымдарын және бөлімдерін көбейтіп, бөлшекті қысқарт.',
      ],
    },
  },
  '6-intermediate': {
    ru: {
      answer: [7n, 20n],
      title: 'Сок для друзей',
      setup: 'В бутылке было 3/5 литра сока.',
      question: 'Я налил в стакан 1/4 литра. Сколько осталось?',
      method: 'Общий знаменатель 20: 3/5 = 12/20, 1/4 = 5/20.',
      reveal: '12/20 − 5/20 = 7/20 литра сока осталось!',
      prompt: 'В бутылке было 3/5 литра сока. Алдияр налил в стакан 1/4 литра. Сколько литров сока осталось в бутылке? Запиши ответ дробью.',
      hints: [
        'Чтобы вычесть дроби, приведи их к общему знаменателю.',
        'Наименьший общий знаменатель для 5 и 4 — это 20.',
      ],
    },
    kk: {
      answer: [7n, 20n],
      title: 'Достарға шырын',
      setup: 'Бөтелкеде 3/5 литр шырын бар еді.',
      question: 'Мен стақанға 1/4 литр құйдым. Қанша қалды?',
      method: 'Ортақ бөлім 20: 3/5 = 12/20, 1/4 = 5/20.',
      reveal: '12/20 − 5/20 = 7/20 литр шырын қалды!',
      prompt: 'Бөтелкеде 3/5 литр шырын бар еді. Алдияр стақанға 1/4 литр құйды. Бөтелкеде неше литр шырын қалды? Жауапты бөлшекпен жаз.',
      hints: [
        'Бөлшектерді азайту үшін оларды ортақ бөлімге келтір.',
        '5 пен 4-тің ең кіші ортақ бөлімі — 20.',
      ],
    },
  },
  '6-advanced': {
    ru: {
      answer: [4n, 1n],
      title: 'Сколько порций?',
      setup: 'У нас 3/2 пиццы — полторы.',
      question: 'Если порция — 3/8 пиццы, сколько порций выйдет?',
      method: 'Разделим: 3/2 : 3/8 = 3/2 · 8/3.',
      reveal: '3/2 · 8/3 = 24/6 = 4. Хватит на четыре порции!',
      prompt: 'Есть 3/2 пиццы. Одна порция — это 3/8 пиццы. Сколько порций получится? Запиши ответ числом или дробью.',
      hints: [
        'Чтобы узнать, сколько раз 3/8 помещается в 3/2, нужно разделить.',
        'Деление на дробь — это умножение на обратную дробь.',
      ],
    },
    kk: {
      answer: [4n, 1n],
      title: 'Неше үлес?',
      setup: 'Бізде 3/2 пицца бар — бір жарым.',
      question: 'Бір үлес пиццаның 3/8 бөлігі болса, неше үлес шығады?',
      method: 'Бөлеміз: 3/2 : 3/8 = 3/2 · 8/3.',
      reveal: '3/2 · 8/3 = 24/6 = 4. Төрт үлеске жетеді!',
      prompt: '3/2 пицца бар. Бір үлес — пиццаның 3/8 бөлігі. Неше үлес шығады? Жауапты санмен немесе бөлшекпен жаз.',
      hints: [
        '3/8 бөлігі 3/2 ішінде неше рет сыятынын білу үшін бөлу керек.',
        'Бөлшекке бөлу — кері бөлшекке көбейту.',
      ],
    },
  },
}

const INTRO: Record<Lang, string> = {
  ru: 'Привет! Я Пифик. Решаем дроби вместе!',
  kk: 'Сәлем! Мен Пификпін. Бөлшектерді бірге шығарайық!',
}
const YOUR_TURN: Record<Lang, string> = {
  ru: 'Ваша очередь! Решите задачу и запишите ответ.',
  kk: 'Енді сенің кезегің! Есепті шығарып, жауабын жаз.',
}

const FEEDBACK: Record<Lang, Record<CheckStatus, (answer: string) => string>> = {
  ru: {
    correct: (a) => `Верно! Ответ: ${a}.`,
    incorrect: () => 'Пока не так. Попробуй ещё раз или попроси подсказку у Пифика.',
    invalid: () => 'Не получается прочитать ответ. Запиши число или дробь a/b — знаменатель не может быть нулём.',
  },
  kk: {
    correct: (a) => `Дұрыс! Жауабы: ${a}.`,
    incorrect: () => 'Әзірге дұрыс емес. Тағы байқап көр немесе Пификтен кеңес сұра.',
    invalid: () => 'Жауапты оқу мүмкін болмады. Санды немесе a/b бөлшегін жаз — бөлім нөлге тең болмауы керек.',
  },
}

const IMG = `${import.meta.env.BASE_URL}mock-images/`
const PANEL_ART = ['pifik', 'aruna', 'aldiyar', 'pifik-close', 'aruna-close', 'aldiyar-close'] as const

// IDs encode everything the mock needs, so it stays stateless across reloads.
const COMIC_RE = /^gen-(5|6)-(basic|intermediate|advanced)-([a-z0-9]+)$/

export function generatedComicId(grade: Grade, difficulty: Difficulty, seed: string) {
  return `gen-${grade}-${difficulty}-${seed}`
}

function parseComicId(comicId: string): Key | null {
  const m = COMIC_RE.exec(comicId)
  return m ? (`${m[1]}-${m[2]}` as Key) : null
}

export function buildGeneratedComic(comicId: string, lang: Lang): Comic | null {
  const key = parseComicId(comicId)
  if (!key) return null
  const p = PROBLEMS[key][lang]
  const lines: [string, string][] = [
    ['Пифик', INTRO[lang]],
    ['Аруна', p.setup],
    ['Алдияр', p.question],
    ['Пифик', YOUR_TURN[lang]],
    ['Аруна', p.method],
    ['Алдияр', p.reveal],
  ]
  return {
    id: comicId,
    lang,
    title: p.title,
    panels: lines.map(([speaker, text], i) => ({
      id: i + 1,
      speaker,
      text,
      imageKey: `${comicId}-${i + 1}`,
      imageUrl: `${IMG}${PANEL_ART[i]}.jpg`,
    })),
    exercise: { id: `ex-${comicId}`, panelId: 4, prompt: p.prompt },
  }
}

/** My Story in the mocks: student heroes speak panels 3 and 6 with placeholder art. */
export function applyMockStory(comic: Comic, story: StoryOptions): Comic {
  const names = story.customHeroes.map((h) => h.name)
  const cast: Record<string, CastHeroId> = { Аруна: 'aruna', Алдияр: 'aldiyar' }
  return {
    ...comic,
    panels: comic.panels.map((panel) => {
      const student = panel.id === 3 ? names[0] : panel.id === 6 ? names[1] ?? names[0] : undefined
      if (student) {
        return { ...panel, speaker: student, imageUrl: null, placeholder: { setting: story.setting } }
      }
      const hero = cast[panel.speaker]
      return hero && !story.heroes.includes(hero) ? { ...panel, speaker: 'Пифик', imageUrl: `${IMG}pifik.jpg` } : panel
    }),
  }
}

export function generatedExercise(exerciseId: string) {
  const key = exerciseId.startsWith('ex-') ? parseComicId(exerciseId.slice(3)) : null
  if (!key) return null
  return {
    answer: { num: PROBLEMS[key].ru.answer[0], den: PROBLEMS[key].ru.answer[1] },
    hints: (lang: Lang) => PROBLEMS[key][lang].hints,
    feedback: (lang: Lang, status: CheckStatus) => {
      const [n, d] = PROBLEMS[key][lang].answer
      return FEEDBACK[lang][status](d === 1n ? `${n}` : `${n}/${d}`)
    },
  }
}
