import { useRef, useState } from 'react'
import { fractionsEqual, parseFraction } from './api/fraction'
import { parseWholeNumber } from './api/localComics'
import type { CheckStatus, Lang } from './api/types'

type LocalizedRound = Record<Lang, { title: string; prompt: string; hint: string }>
type Round = { id: string; text: LocalizedRound } & (
  | { kind: 'fraction'; answer: { num: bigint; den: bigint } }
  | { kind: 'whole-number'; answer: number }
)

export const GUARDIAN_ROUNDS: readonly Round[] = [
  {
    id: 'pizzas',
    kind: 'fraction',
    answer: { num: 2n, den: 3n },
    text: {
      ru: {
        title: 'Дроби',
        prompt: 'Две одинаковые пиццы делят поровну между тремя друзьями. Какую часть одной пиццы получит каждый? Запиши ответ дробью.',
        hint: 'Раздели каждую пиццу на три равные части. Подумай, сколько таких частей получит каждый друг от всех пицц.',
      },
      kk: {
        title: 'Бөлшектер',
        prompt: 'Екі бірдей пиццаны үш дос тең бөліседі. Әр досқа бір пиццаның қандай бөлігі тиеді? Жауабыңды бөлшекпен жаз.',
        hint: 'Әр пиццаны үш тең бөлікке бөл. Барлық пиццадан әр досқа осындай неше бөлік тиетінін ойла.',
      },
    },
  },
  {
    id: 'prize',
    kind: 'whole-number',
    answer: 6000,
    text: {
      ru: {
        title: 'Проценты',
        prompt: 'Приз стоил 8 000 тенге. Сколько он стоит после скидки 25%? Запиши цену числом в тенге.',
        hint: 'Скидка 25% — это четверть исходной цены. Найди эту четверть и вычти её из цены приза.',
      },
      kk: {
        title: 'Пайыздар',
        prompt: 'Жүлденің бағасы 8 000 теңге еді. 25% жеңілдіктен кейін ол қанша тұрады? Бағаны теңгемен, санмен жаз.',
        hint: '25% жеңілдік — бастапқы бағаның төрттен бірі. Сол бөлікті тауып, оны жүлденің бағасынан шегер.',
      },
    },
  },
  {
    id: 'map',
    kind: 'whole-number',
    answer: 80,
    text: {
      ru: {
        title: 'Масштаб',
        prompt: 'На карте между двумя стойками 4 см. Каждый сантиметр обозначает 20 м. Сколько метров между стойками? Запиши только число.',
        hint: 'Каждому сантиметру на карте соответствует одинаковое число метров. Умножь расстояние на карте на число метров в одном сантиметре.',
      },
      kk: {
        title: 'Масштаб',
        prompt: 'Картада екі дүңгіршектің арасы 4 см. Әр сантиметр 20 метрді білдіреді. Дүңгіршектердің арасы неше метр? Тек санды жаз.',
        hint: 'Картадағы әр сантиметрге бірдей метр саны сәйкес келеді. Картадағы арақашықтықты бір сантиметрге сәйкес келетін метр санына көбейт.',
      },
    },
  },
]

export const DAMAGE_PER_ROUND = 30
export const GUARDIAN_MAX_HP = GUARDIAN_ROUNDS.length * DAMAGE_PER_ROUND
const STORAGE_KEY = 'amc.schoolFair.guardian'

interface GuardianRun {
  cleared: number
  won: boolean
}

function readRun(): GuardianRun {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (data && typeof data === 'object' && 'cleared' in data && 'won' in data) {
      const { cleared, won } = data
      if (
        typeof cleared === 'number' && Number.isInteger(cleared) &&
        cleared >= 0 && cleared <= GUARDIAN_ROUNDS.length && typeof won === 'boolean'
      ) {
        return { cleared, won: won || cleared === GUARDIAN_ROUNDS.length }
      }
    }
  } catch {
    // An invalid or inaccessible save starts a fresh run.
  }
  return { cleared: 0, won: false }
}

function checkRound(round: Round, answer: string): CheckStatus {
  if (round.kind === 'fraction') {
    const parsed = parseFraction(answer)
    return parsed === null ? 'invalid' : fractionsEqual(parsed, round.answer) ? 'correct' : 'incorrect'
  }
  const parsed = parseWholeNumber(answer)
  return parsed === null ? 'invalid' : parsed === round.answer ? 'correct' : 'incorrect'
}

export function useGuardianChallenge() {
  const [run, setRun] = useState(readRun)
  const current = useRef(run)

  function update(next: GuardianRun) {
    current.current = next
    setRun(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Play continues in memory when storage is unavailable.
    }
  }

  function submit(roundIndex: number, answer: string): CheckStatus | null {
    // Reject events from the previous round, even before React renders the new one.
    if (roundIndex !== current.current.cleared) return null
    const round = GUARDIAN_ROUNDS[roundIndex]
    if (!round) return null
    const result = checkRound(round, answer)
    if (result === 'correct') {
      const cleared = roundIndex + 1
      update({ cleared, won: current.current.won || cleared === GUARDIAN_ROUNDS.length })
    }
    return result
  }

  function replay() {
    if (current.current.cleared === GUARDIAN_ROUNDS.length) update({ cleared: 0, won: true })
  }

  return { run, submit, replay }
}
