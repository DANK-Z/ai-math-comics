import { useRef, useState } from 'react'
import { parseWholeNumber } from './api/localComics'
import type { CheckStatus, Lang } from './api/types'

// «Хранитель Дорог»: a three-phase boss for motion problems. Each correct answer deals
// 30 damage and moves the fight to the next phase (chase → head-on → river).

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
          'Хранитель Дорог пытается сбежать! Ты бежишь со скоростью 15 км/ч, а он удаляется от тебя со скоростью 9 км/ч. Сейчас между вами 18 км. Через сколько часов ты догонишь Хранителя? Запиши ответ числом в часах.',
        hint: 'При движении вдогонку расстояние сокращается на разность скоростей: 15 − 9 = 6 км/ч. Раздели расстояние между вами на эту скорость сближения.',
        scene: 'Погоня: ты и Хранитель движетесь в одну сторону, между вами 18 км.',
      },
      kk: {
        tab: 'Қуып жету',
        prompt:
          'Жолдар Сақшысы қашып кетпек! Сен 15 км/сағ жылдамдықпен жүгіресің, ал ол сенен 9 км/сағ жылдамдықпен алыстап барады. Қазір араларыңда 18 км. Неше сағаттан кейін Сақшыны қуып жетесің? Жауапты сағатпен, санмен жаз.',
        hint: 'Қуып жеткенде арақашықтық жылдамдықтардың айырмасына қысқарады: 15 − 9 = 6 км/сағ. Араларыңдағы қашықтықты осы жақындасу жылдамдығына бөл.',
        scene: 'Қуу: сен және Сақшы бір бағытта қозғаласыңдар, араларыңда 18 км.',
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
          'Хранитель Дорог разворачивается и идёт на таран! Вы движетесь навстречу друг другу: твоя скорость 12 км/ч, его — 18 км/ч. Какое расстояние будет между вами за 2 часа до встречи? Запиши ответ числом в километрах.',
        hint: 'При движении навстречу скорости складываются: 12 + 18 = 30 км/ч. За 2 часа до встречи между вами ровно столько, сколько вы вместе проезжаете за 2 часа. Начальное расстояние знать не нужно.',
        scene: 'Противостояние: ты и Хранитель мчитесь навстречу друг другу.',
      },
      kk: {
        tab: 'Қарсы қозғалыс',
        prompt:
          'Жолдар Сақшысы бұрылып, саған қарай ұмтылды! Сендер бір-біріңе қарама-қарсы қозғаласыңдар: сенің жылдамдығың 12 км/сағ, оныкі — 18 км/сағ. Кездесуге 2 сағат қалғанда араларыңда неше километр болады? Жауапты километрмен, санмен жаз.',
        hint: 'Қарсы қозғалғанда жылдамдықтар қосылады: 12 + 18 = 30 км/сағ. Кездесуге 2 сағат қалғанда араларыңдағы қашықтық екеуің бірге 2 сағатта жүретін жолға тең. Бастапқы қашықтықты білу қажет емес.',
        scene: 'Бетпе-бет: сен және Сақшы бір-біріңе қарай жылдам келе жатырсыңдар.',
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
          'Финал! Хранитель Дорог прыгает в моторную лодку и уплывает вверх по реке. Скорость течения — 4 км/ч, собственная скорость твоей лодки — 20 км/ч. Ты гонишься за ним 3 часа против течения, а когда он разворачивается, ещё 2 часа плывёшь за ним по течению. Какое расстояние ты проплывёшь за весь заплыв? Запиши ответ числом в километрах.',
        hint: 'Против течения скорость лодки 20 − 4 = 16 км/ч, по течению 20 + 4 = 24 км/ч. Найди путь на каждом участке (скорость × время) и сложи их.',
        scene: 'Штормовая река: течение 4 км/ч, лодки сначала идут против течения.',
      },
      kk: {
        tab: 'Ағыспен',
        prompt:
          'Финал! Жолдар Сақшысы моторлы қайыққа секіріп, өзеннің жоғарғы ағысына қарай жүзіп кетті. Өзен ағысының жылдамдығы — 4 км/сағ, сенің қайығыңның меншікті жылдамдығы — 20 км/сағ. Сен оны 3 сағат ағысқа қарсы қуасың, ал ол бұрылғанда тағы 2 сағат ағыспен жүзесің. Бүкіл жүзуде неше километр жол жүресің? Жауапты километрмен, санмен жаз.',
        hint: 'Ағысқа қарсы қайықтың жылдамдығы 20 − 4 = 16 км/сағ, ағыспен 20 + 4 = 24 км/сағ. Әр бөліктегі жолды тауып (жылдамдық × уақыт), оларды қос.',
        scene: 'Дауылды өзен: ағыс 4 км/сағ, қайықтар алдымен ағысқа қарсы жүзеді.',
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

export const ROAD_DAMAGE = 30
export const ROAD_MAX_HP = ROAD_ROUNDS.length * ROAD_DAMAGE
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
    hp: (hp: number, max: number) => string
    navDetail: (hp: number, max: number, won: boolean) => string
    phase: (n: number, total: number) => string
    status: { cleared: string; active: string; upcoming: string }
    collision: string
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
    subtitle: 'Экзамен на дорогах · задачи на движение',
    intro: 'Три фазы — три вида движения. Каждый верный ответ снимает 30 HP, и Хранитель меняет тактику.',
    you: 'Ты',
    hp: (hp, max) => `Здоровье Хранителя: ${hp} / ${max} HP`,
    navDetail: (hp, max, won) => (won ? 'Побеждён' : `${hp} / ${max} HP`),
    phase: (n, total) => `Фаза ${n} из ${total}`,
    status: { cleared: 'пройдена', active: 'сейчас', upcoming: 'впереди' },
    collision: 'Опасность столкновения!',
    placeholder: 'например, 5',
    current: 'течение 4 км/ч',
    wrong: 'Пока не так. Перечитай условие и попробуй ещё раз.',
    invalid: 'Введи только число, без единиц измерения.',
    victory: 'Победа! Хранитель Дорог повержен',
    victoryText: 'Ты прошёл все три фазы: вдогонку, навстречу и по реке. Тема «Скорость» сдана!',
    replay: 'Сразиться снова',
  },
  kk: {
    title: 'Жолдар Сақшысы',
    subtitle: 'Жол емтиханы · қозғалысқа есептер',
    intro: 'Үш кезең — қозғалыстың үш түрі. Әр дұрыс жауап 30 HP алады, ал Сақшы тактикасын өзгертеді.',
    you: 'Сен',
    hp: (hp, max) => `Сақшының денсаулығы: ${hp} / ${max} HP`,
    navDetail: (hp, max, won) => (won ? 'Жеңілді' : `${hp} / ${max} HP`),
    phase: (n, total) => `${n}-кезең / ${total}`,
    status: { cleared: 'өтілді', active: 'қазір', upcoming: 'алда' },
    collision: 'Соқтығысу қаупі!',
    placeholder: 'мысалы, 5',
    current: 'ағыс 4 км/сағ',
    wrong: 'Әзірге дұрыс емес. Шартты қайта оқып, тағы байқап көр.',
    invalid: 'Өлшем бірлігінсіз, тек санды жаз.',
    victory: 'Жеңіс! Жолдар Сақшысы жеңілді',
    victoryText: 'Сен үш кезеңнің бәрінен өттің: қуып жету, қарсы қозғалыс және өзен. «Жылдамдық» тақырыбы тапсырылды!',
    replay: 'Қайта шайқасу',
  },
}
