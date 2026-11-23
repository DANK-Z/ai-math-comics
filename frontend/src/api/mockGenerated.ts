import { parseEquationAnswer } from './answers'
import { fractionsEqual, parseFraction } from './fraction'
import type { BossRound, CastHeroId, CheckStatus, Comic, Difficulty, Grade, Lang, StoryOptions, Topic } from './types'

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
      title: 'Лимонад для друзей',
      setup: 'К ярмарке друзья приготовили лимонад.',
      question: 'Сколько лимонада получит каждый?',
      method: 'Разделим весь лимонад поровну!',
      reveal: 'У каждого теперь по 2/3 кувшина лимонада!',
      prompt: 'Два одинаковых кувшина лимонада разделили поровну между тремя друзьями. Какую долю кувшина получит каждый? Запиши ответ дробью.',
      hints: [
        'При равном делении общее количество делят на число получателей.',
        'Запиши число кувшинов в числителе, а число друзей — в знаменателе.',
      ],
    },
    kk: {
      answer: [2n, 3n],
      title: 'Достарға арналған лимонад',
      setup: 'Достар жәрмеңкеге лимонад дайындады.',
      question: 'Әрқайсымызға қанша лимонад тиеді?',
      method: 'Лимонадты тең бөлісейік!',
      reveal: 'Енді әркімде құмыраның 2/3 бөлігіндей лимонад бар!',
      prompt: 'Бірдей екі құмыра лимонадты үш дос тең бөлісті. Әр досқа бір құмыраның қандай бөлігі тиеді? Жауапты бөлшекпен жаз.',
      hints: [
        'Тең бөліскенде жалпы мөлшерді адам санына бөледі.',
        'Құмыра санын алымға, достар санын бөлімге жаз.',
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

// Equations mocks: the server's templates (find x, whole-number answers), three per key —
// the comic's own exercise and two boss rounds.
type EquationKind = 'add' | 'sub' | 'mul' | 'div' | 'mul_add' | 'mul_sub'
const EQUATIONS: Record<Key, [EquationKind, string, number][]> = {
  '5-basic': [['add', 'x + 17 = 42', 25], ['sub', 'x − 8 = 15', 23], ['add', 'x + 26 = 61', 35]],
  '5-intermediate': [['mul', '6 · x = 54', 9], ['div', 'x : 4 = 7', 28], ['mul', '7 · x = 84', 12]],
  '5-advanced': [['mul_add', '3 · x + 5 = 26', 7], ['mul_add', '4 · x + 9 = 41', 8], ['mul_add', '5 · x + 12 = 57', 9]],
  '6-basic': [['add', 'x + 48 = 135', 87], ['sub', 'x − 37 = 58', 95], ['add', 'x + 64 = 120', 56]],
  '6-intermediate': [['mul', '12 · x = 216', 18], ['div', 'x : 9 = 14', 126], ['mul', '15 · x = 345', 23]],
  '6-advanced': [['mul_sub', '7 · x − 15 = 62', 11], ['mul_add', '8 · x + 23 = 119', 12], ['mul_sub', '9 · x − 28 = 107', 15]],
}
const EQUATION_HINTS: Record<Lang, Record<EquationKind, [string, string]>> = {
  ru: {
    add: ['Здесь x — неизвестное слагаемое. Чтобы его найти, из суммы вычти известное слагаемое.', 'Вычисли разность и проверь себя: подставь найденное число вместо x в уравнение.'],
    sub: ['Здесь x — неизвестное уменьшаемое. Чтобы его найти, к разности прибавь вычитаемое.', 'Вычисли сумму и проверь себя: подставь найденное число вместо x в уравнение.'],
    mul: ['Здесь x — неизвестный множитель. Чтобы его найти, раздели произведение на известный множитель.', 'Вычисли частное и проверь себя: умножь найденное число на известный множитель.'],
    div: ['Здесь x — неизвестное делимое. Чтобы его найти, умножь частное на делитель.', 'Вычисли произведение и проверь себя: раздели найденное число на делитель.'],
    mul_add: ['Сначала найди произведение с x: вычти прибавленное число из правой части.', 'Теперь x — неизвестный множитель: раздели полученное число на множитель перед x.'],
    mul_sub: ['Сначала найди произведение с x: прибавь вычтенное число к правой части.', 'Теперь x — неизвестный множитель: раздели полученное число на множитель перед x.'],
  },
  kk: {
    add: ['Мұнда x — белгісіз қосылғыш. Оны табу үшін қосындыдан белгілі қосылғышты азайт.', 'Айырманы есептеп, өзіңді тексер: табылған санды теңдеудегі x орнына қой.'],
    sub: ['Мұнда x — белгісіз азайғыш. Оны табу үшін айырмаға азайтқышты қос.', 'Қосындыны есептеп, өзіңді тексер: табылған санды теңдеудегі x орнына қой.'],
    mul: ['Мұнда x — белгісіз көбейткіш. Оны табу үшін көбейтіндіні белгілі көбейткішке бөл.', 'Бөліндіні есептеп, өзіңді тексер: табылған санды белгілі көбейткішке көбейт.'],
    div: ['Мұнда x — белгісіз бөлінгіш. Оны табу үшін бөліндіні бөлгішке көбейт.', 'Көбейтіндіні есептеп, өзіңді тексер: табылған санды бөлгішке бөл.'],
    mul_add: ['Алдымен x бар көбейтіндіні тап: қосылған санды оң жақтан азайт.', 'Енді x — белгісіз көбейткіш: шыққан санды x алдындағы көбейткішке бөл.'],
    mul_sub: ['Алдымен x бар көбейтіндіні тап: азайтылған санды оң жаққа қос.', 'Енді x — белгісіз көбейткіш: шыққан санды x алдындағы көбейткішке бөл.'],
  },
}
const equationPrompt = (equation: string, lang: Lang) =>
  lang === 'ru'
    ? `Реши уравнение-загадку: ${equation}. Чему равен x? Запиши ответ целым числом.`
    : `Теңдеу-жұмбақты шеш: ${equation}. x неге тең? Жауабыңды бүтін санмен жаз.`
const EQUATION_STORY: Record<Lang, { title: string; lines: [string, string][] }> = {
  ru: {
    title: 'Сундук Магистра Иксов',
    lines: [
      ['Пифик', 'Привет! Я Пифик. Сегодня разгадываем уравнения!'],
      ['Аруна', 'Смотрите, сундук запечатан волшебным замком!'],
      ['Алдияр', 'На замке загадка с иксом. Как его открыть?'],
      ['Пифик', ''],
      ['Аруна', 'Замок рассыпался искрами — икс найден!'],
      ['Алдияр', 'Магистр Иксов больше не страшен!'],
    ],
  },
  kk: {
    title: 'Икстер Магистрінің сандығы',
    lines: [
      ['Пифик', 'Сәлем! Мен Пификпін. Бүгін теңдеулер шешеміз!'],
      ['Аруна', 'Қараңдар, сандық сиқырлы құлыппен жабылған!'],
      ['Алдияр', 'Құлыпта икс бар жұмбақ. Оны қалай ашамыз?'],
      ['Пифик', ''],
      ['Аруна', 'Құлып ұшқынға айналды — икс табылды!'],
      ['Алдияр', 'Икстер Магистрі енді қорқынышты емес!'],
    ],
  },
}

const IMG = `${import.meta.env.BASE_URL}mock-images/`
const PANEL_ART = ['pifik', 'aruna', 'aldiyar', 'pifik-close', 'aruna-close', 'aldiyar-close'] as const

// IDs encode everything the mock needs, so it stays stateless across reloads.
// `gen-` is a fractions comic, `geq-` an equations comic.
const COMIC_RE = /^(gen|geq)-(5|6)-(basic|intermediate|advanced)-([a-z0-9]+)$/

export function generatedComicId(grade: Grade, difficulty: Difficulty, seed: string, topic: Topic = 'fractions') {
  return `${topic === 'equations' ? 'geq' : 'gen'}-${grade}-${difficulty}-${seed}`
}

function parseComicId(comicId: string): { key: Key; topic: Topic } | null {
  const m = COMIC_RE.exec(comicId)
  return m ? { key: `${m[2]}-${m[3]}` as Key, topic: m[1] === 'geq' ? 'equations' : 'fractions' } : null
}

/** Boss rounds 2 and 3 for a fractions comic: the other difficulties of the same grade. */
function fractionRoundKeys(key: Key): Key[] {
  const grade = key.split('-')[0]
  const all = (['basic', 'intermediate', 'advanced'] as const).map((d) => `${grade}-${d}` as Key)
  return [key, ...all.filter((k) => k !== key)]
}

export function buildGeneratedComic(comicId: string, lang: Lang): Comic | null {
  const parsed = parseComicId(comicId)
  if (!parsed) return null
  const { key, topic } = parsed
  const exerciseId = `ex-${comicId}`
  const roundId = (i: number) => (i === 0 ? exerciseId : `${exerciseId}-r${i + 1}`)
  let title: string
  let lines: [string, string][]
  let rounds: BossRound[]
  if (topic === 'equations') {
    title = EQUATION_STORY[lang].title
    lines = EQUATION_STORY[lang].lines.map(([who, text], i) => [who, i === 3 ? YOUR_TURN[lang] : text])
    rounds = EQUATIONS[key].map(([, equation], i) => ({ exerciseId: roundId(i), prompt: equationPrompt(equation, lang), answerFormat: 'whole-number' }))
  } else {
    const p = PROBLEMS[key][lang]
    title = p.title
    lines = [
      ['Пифик', INTRO[lang]],
      ['Аруна', p.setup],
      ['Алдияр', p.question],
      ['Пифик', YOUR_TURN[lang]],
      ['Аруна', p.method],
      ['Алдияр', p.reveal],
    ]
    rounds = fractionRoundKeys(key).map((k, i) => ({ exerciseId: roundId(i), prompt: PROBLEMS[k][lang].prompt }))
  }
  return {
    id: comicId,
    lang,
    title,
    panels: lines.map(([speaker, text], i) => ({
      id: i + 1,
      speaker,
      text,
      emotion: (['happy', 'surprised', 'confused', 'neutral', 'neutral', 'happy'] as const)[i],
      imageKey: `${comicId}-${i + 1}`,
      imageUrl: `${IMG}${PANEL_ART[i]}.jpg`,
    })),
    exercise: { id: exerciseId, panelId: 4, prompt: rounds[0].prompt, ...(rounds[0].answerFormat ? { answerFormat: rounds[0].answerFormat } : {}) },
    boss: {
      kind: topic === 'equations' ? 'x-master' : 'fraction-slime', maxHp: 90, rounds,
      character: lang === 'ru'
        ? { name: 'Медная Сова', introduction: 'Покажи, как решают такие задачи!', farewell: 'Ты справился! Продолжай путь.' }
        : { name: 'Мыс Үкі', introduction: 'Осындай есептерді қалай шешетініңді көрсет!', farewell: 'Шеше алдың! Жолыңды жалғастыр.' },
    },
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
  const m = /^ex-(.+?)(?:-r([23]))?$/.exec(exerciseId)
  const parsed = m ? parseComicId(m[1]) : null
  if (!m || !parsed) return null
  const { key, topic } = parsed
  const index = m[2] ? Number(m[2]) - 1 : 0
  if (topic === 'equations') {
    const [kind, , answer] = EQUATIONS[key][index]
    return {
      check: (value: string): CheckStatus => {
        const given = parseEquationAnswer(value)
        if (!given) return 'invalid'
        return fractionsEqual(given, { num: BigInt(answer), den: 1n }) ? 'correct' : 'incorrect'
      },
      hints: (lang: Lang) => EQUATION_HINTS[lang][kind],
      feedback: (lang: Lang, status: CheckStatus) =>
        status === 'invalid'
          ? lang === 'ru'
            ? 'Запиши значение x числом: например 12, 12,0 или x = 12.'
            : 'x мәнін санмен жаз: мысалы 12, 12,0 немесе x = 12.'
          : FEEDBACK[lang][status](`x = ${answer}`),
    }
  }
  const problem = PROBLEMS[fractionRoundKeys(key)[index]]
  const [num, den] = problem.ru.answer
  return {
    check: (value: string): CheckStatus => {
      const parsedAnswer = parseFraction(value)
      if (!parsedAnswer) return 'invalid'
      return fractionsEqual(parsedAnswer, { num, den }) ? 'correct' : 'incorrect'
    },
    hints: (lang: Lang) => problem[lang].hints,
    feedback: (lang: Lang, status: CheckStatus) => FEEDBACK[lang][status](den === 1n ? `${num}` : `${num}/${den}`),
  }
}
