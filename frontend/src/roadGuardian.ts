import { useRef, useState } from 'react'
import { parseWholeNumber } from './api/localComics'
import type { CheckStatus, Lang } from './api/types'

// «Хранитель Дорог»: the friendly keeper of the fair's finish gates. The gates have three
// locks, each a motion problem shown as a hologram (chase → head-on → river). Every correct
// answer lights one lamp and opens one lock; three lamps open the gates.

export type RoadPhase = 'chase' | 'meeting' | 'river' | 'average'

interface PhaseText {
  tab: string
  prompt: string
  hint: string
  /** Short description of the phase picture for screen readers. */
  scene: string
}

export interface RoadRound {
  id: RoadPhase
  answer: number
  text: Record<Lang, PhaseText>
}

export const ROAD_ROUNDS: readonly RoadRound[] = [
  {
    id: 'chase',
    // (15 − 9) km/h closing speed; 18 km ÷ 6 km/h = 3 h.
    answer: 3,
    text: {
      ru: {
        tab: 'Вдогонку',
        prompt:
          'Первый замок показывает голограмму длинной трассы. Алдияр едет впереди со скоростью 9 км/ч, Аруна едет за ним со скоростью 15 км/ч. Сейчас между ними 18 км. Через сколько часов Аруна догонит Алдияра? Запиши ответ числом в часах.',
        hint: 'При движении вдогонку расстояние сокращается на разность скоростей: 15 − 9 = 6 км/ч. Раздели расстояние между друзьями на эту скорость сближения.',
        scene: 'Погоня: Аруна и Алдияр едут в одну сторону, между ними 18 км.',
      },
      kk: {
        tab: 'Қуып жету',
        prompt:
          'Бірінші құлып ұзын жолдың голограммасын көрсетеді. Алдияр алдында 9 км/сағ жылдамдықпен жүріп келеді, Аруна оның артынан 15 км/сағ жылдамдықпен жүреді. Қазір олардың арасы 18 км. Неше сағаттан кейін Аруна Алдиярды қуып жетеді? Жауапты сағатпен, санмен жаз.',
        hint: 'Қуып жеткенде арақашықтық жылдамдықтардың айырмасына қысқарады: 15 − 9 = 6 км/сағ. Достардың арасындағы қашықтықты осы жақындасу жылдамдығына бөл.',
        scene: 'Қуу: Аруна мен Алдияр бір бағытта жүреді, олардың арасы 18 км.',
      },
    },
  },
  {
    id: 'meeting',
    // Closing speed 12 + 18 = 30 km/h; 2 h before meeting they are 30 × 2 = 60 km apart.
    answer: 60,
    text: {
      ru: {
        tab: 'Навстречу',
        prompt:
          'Второй замок показывает мост через реку. Аруна и Алдияр едут к нему навстречу друг другу: скорость Аруны 12 км/ч, Алдияра — 18 км/ч. Какое расстояние будет между ними за 2 часа до встречи? Запиши ответ числом в километрах.',
        hint: 'При движении навстречу скорости складываются: 12 + 18 = 30 км/ч. За 2 часа до встречи между друзьями ровно столько, сколько они вместе проезжают за 2 часа. Начальное расстояние знать не нужно.',
        scene: 'Встреча: Аруна и Алдияр едут навстречу друг другу к мосту.',
      },
      kk: {
        tab: 'Қарсы қозғалыс',
        prompt:
          'Екінші құлып өзен үстіндегі көпірді көрсетеді. Аруна мен Алдияр оған қарай бір-біріне қарсы жүріп келеді: Арунаның жылдамдығы 12 км/сағ, Алдиярдікі — 18 км/сағ. Кездесуге 2 сағат қалғанда олардың арасы неше километр болады? Жауапты километрмен, санмен жаз.',
        hint: 'Қарсы қозғалғанда жылдамдықтар қосылады: 12 + 18 = 30 км/сағ. Кездесуге 2 сағат қалғанда достардың арасы екеуі бірге 2 сағатта жүретін жолға тең. Бастапқы қашықтықты білу қажет емес.',
        scene: 'Кездесу: Аруна мен Алдияр көпірге қарай бір-біріне қарсы жүреді.',
      },
    },
  },
  {
    id: 'river',
    // Upstream 20 − 4 = 16 km/h × 3 h = 48 km; downstream 20 + 4 = 24 km/h × 2 h = 48 km; 96 km.
    answer: 96,
    text: {
      ru: {
        tab: 'По течению',
        prompt:
          'Третий замок показывает реку и причал. Друзья плывут на моторной лодке: её собственная скорость — 20 км/ч, скорость течения — 4 км/ч. Сначала они 3 часа идут против течения, а потом 2 часа по течению. Какое расстояние проплывёт лодка за весь путь? Запиши ответ числом в километрах.',
        hint: 'Против течения скорость лодки 20 − 4 = 16 км/ч, по течению 20 + 4 = 24 км/ч. Найди путь на каждом участке (скорость × время) и сложи их.',
        scene: 'Река: течение 4 км/ч, лодка друзей сначала идёт против течения.',
      },
      kk: {
        tab: 'Ағыспен',
        prompt:
          'Үшінші құлып өзен мен айлақты көрсетеді. Достар моторлы қайықпен жүзіп келеді: оның меншікті жылдамдығы — 20 км/сағ, ағыстың жылдамдығы — 4 км/сағ. Алдымен олар 3 сағат ағысқа қарсы, сосын 2 сағат ағыспен жүзеді. Қайық бүкіл жолда неше километр жүзеді? Жауапты километрмен, санмен жаз.',
        hint: 'Ағысқа қарсы қайықтың жылдамдығы 20 − 4 = 16 км/сағ, ағыспен 20 + 4 = 24 км/сағ. Әр бөліктегі жолды тауып (жылдамдық × уақыт), оларды қос.',
        scene: 'Өзен: ағыс 4 км/сағ, достардың қайығы алдымен ағысқа қарсы жүзеді.',
      },
    },
  },
]

export const MOTION_ROUNDS: readonly RoadRound[] = [
  ...ROAD_ROUNDS,
  {
    id: 'average',
    answer: (12 * 2 + 24) / (2 + 1),
    text: {
      ru: {
        tab: 'Средняя скорость',
        prompt: 'Команда ехала 2 часа со скоростью 12 км/ч. За следующий час она проехала ещё 24 км. Какова средняя скорость за всю поездку? Запиши число в километрах в час.',
        hint: 'Найди путь на первом участке. Сложи оба расстояния и раздели весь путь на всё время поездки.',
        scene: 'У маршрута два участка. Первый занял 2 часа, второй — 1 час.',
      },
      kk: {
        tab: 'Орташа жылдамдық',
        prompt: 'Топ 12 км/сағ жылдамдықпен 2 сағат жүрді. Келесі сағатта тағы 24 км жүрді. Бүкіл сапардағы орташа жылдамдық қандай? Жауапты км/сағ бірлігімен, санмен жаз.',
        hint: 'Алғашқы бөлікте жүрілген жолды тап. Екі қашықтықты қосып, бүкіл жолды сапардың толық уақытына бөл.',
        scene: 'Бағыт екі бөліктен тұрады. Алғашқысы 2 сағат, екіншісі 1 сағат алды.',
      },
    },
  },
]

const STORAGE_KEY = 'amc.motion.roadGuardian'

interface RoadRun {
  cleared: number
  won: boolean
}

function readRun(): RoadRun {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (data && typeof data === 'object' && 'cleared' in data && 'won' in data) {
      const { cleared, won } = data
      if (typeof cleared === 'number' && Number.isInteger(cleared) && cleared >= 0 && cleared <= ROAD_ROUNDS.length && typeof won === 'boolean') {
        return { cleared, won: won || cleared === ROAD_ROUNDS.length }
      }
    }
  } catch {
    // An invalid or inaccessible save starts a fresh fight.
  }
  return { cleared: 0, won: false }
}

export function checkRoadAnswer(round: RoadRound, answer: string): CheckStatus {
  const value = parseWholeNumber(answer)
  return value === null ? 'invalid' : value === round.answer ? 'correct' : 'incorrect'
}

/** Progress is kept in this browser, like the School Fair Guardian. */
export function useRoadGuardian() {
  const [run, setRun] = useState(readRun)
  const current = useRef(run)

  function update(next: RoadRun) {
    current.current = next
    setRun(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Play continues in memory when storage is unavailable.
    }
  }

  function submit(roundIndex: number, answer: string): CheckStatus | null {
    // Ignore late events from a phase that is already cleared.
    if (roundIndex !== current.current.cleared) return null
    const round = ROAD_ROUNDS[roundIndex]
    if (!round) return null
    const result = checkRoadAnswer(round, answer)
    if (result === 'correct') {
      const cleared = roundIndex + 1
      update({ cleared, won: current.current.won || cleared === ROAD_ROUNDS.length })
    }
    return result
  }

  function replay() {
    if (current.current.cleared === ROAD_ROUNDS.length) update({ cleared: 0, won: true })
  }

  return { run, submit, replay }
}

/** UI copy for the boss screen and its navigation entry. */
export const ROAD_COPY: Record<
  Lang,
  {
    title: string
    subtitle: string
    intro: string
    you: string
    navDetail: (opened: number, total: number, won: boolean) => string
    phase: (n: number, total: number) => string
    status: { cleared: string; active: string; upcoming: string }
    placeholder: string
    current: string
    wrong: string
    invalid: string
    victory: string
    victoryText: string
    replay: string
  }
> = {
  ru: {
    title: 'Хранитель Дорог',
    subtitle: 'Три замка финишных ворот · задачи на движение',
    intro: 'Хранитель Дорог стережёт финишные ворота ярмарки. На воротах три замка, и каждый показывает голограмму маршрута. Реши задачу — загорится фонарь, и замок откроется.',
    you: 'Ты',
    navDetail: (opened, total, won) => (won ? 'Ворота открыты' : `Замков открыто: ${opened} из ${total}`),
    phase: (n, total) => `Замок ${n} из ${total}`,
    status: { cleared: 'открыт', active: 'сейчас', upcoming: 'закрыт' },
    placeholder: 'например, 5',
    current: 'течение 4 км/ч',
    wrong: 'Пока не так. Перечитай условие и попробуй ещё раз.',
    invalid: 'Введи только число, без единиц измерения.',
    victory: 'Ворота открыты!',
    victoryText: 'Все три фонаря горят. Хранитель Дорог доволен: погоня, встреча и река пройдены, тема «Скорость» сдана! За воротами ждёт ярмарка.',
    replay: 'Пройти замки снова',
  },
  kk: {
    title: 'Жолдар Сақшысы',
    subtitle: 'Мәре қақпасының үш құлпы · қозғалысқа есептер',
    intro: 'Жолдар Сақшысы жәрмеңкенің мәре қақпасын күзетеді. Қақпада үш құлып бар, әрқайсысы бағыттың голограммасын көрсетеді. Есепті шеш — шам жанып, құлып ашылады.',
    you: 'Сен',
    navDetail: (opened, total, won) => (won ? 'Қақпа ашық' : `Ашылған құлыптар: ${opened} / ${total}`),
    phase: (n, total) => `${n}-құлып / ${total}`,
    status: { cleared: 'ашық', active: 'қазір', upcoming: 'жабық' },
    placeholder: 'мысалы, 5',
    current: 'ағыс 4 км/сағ',
    wrong: 'Әзірге дұрыс емес. Шартты қайта оқып, тағы байқап көр.',
    invalid: 'Өлшем бірлігінсіз, тек санды жаз.',
    victory: 'Қақпа ашық!',
    victoryText: 'Үш шам да жанып тұр. Жолдар Сақшысы риза: қуып жету, кездесу және өзен өтілді, «Жылдамдық» тақырыбы тапсырылды! Қақпаның арғы жағында жәрмеңке күтіп тұр.',
    replay: 'Құлыптарды қайта өту',
  },
}
