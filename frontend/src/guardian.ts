import { useRef, useState } from 'react'
import { fractionsEqual, parseFraction } from './api/fraction'
import { parseWholeNumber } from './api/localComics'
import type { CheckStatus, Lang } from './api/types'
import { guardianAssignmentHref, type GuardianAssignment, type GuardianBoost, type GuardianTopic } from './guardianAssignment'

type LocalizedRound = Record<Lang, { title: string; prompt: string; hint: string }>
export type GuardianRound = { id: GuardianTopic; text: LocalizedRound } & (
  | { kind: 'fraction'; answer: { num: bigint; den: bigint } }
  | { kind: 'whole-number'; answer: number }
)

const GUARDIAN_ROUNDS: readonly GuardianRound[] = [
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

const REPLAY_NUMBERS = [
  { pizzas: 3, friends: 4, price: 12000, discount: 20, length: 5, scale: 25 },
  { pizzas: 4, friends: 5, price: 10000, discount: 30, length: 7, scale: 30 },
] as const

function roundsFor(variant: number): readonly GuardianRound[] {
  if (variant === 0) return GUARDIAN_ROUNDS
  const { pizzas, friends, price, discount, length, scale } = REPLAY_NUMBERS[(variant - 1) % REPLAY_NUMBERS.length]
  const [fractions, percent, map] = GUARDIAN_ROUNDS
  const priceLabel = String(price).replace(/(?<=\d)(?=\d{3}$)/, ' ')
  return [
    {
      id: fractions.id,
      kind: 'fraction',
      answer: { num: BigInt(pizzas), den: BigInt(friends) },
      text: {
        ru: { title: fractions.text.ru.title, prompt: `Пицц: ${pizzas}. Друзей: ${friends}. Все пиццы одинаковые. Их делят поровну. Какую часть одной пиццы получит каждый? Запиши дробь.`, hint: 'Делимое запиши в числитель, а число друзей — в знаменатель.' },
        kk: { title: fractions.text.kk.title, prompt: `Пицца саны — ${pizzas}, достар саны — ${friends}. Бірдей пиццаларды достар тең бөліседі. Әр досқа бір пиццаның қандай бөлігі тиеді? Бөлшекпен жаз.`, hint: 'Пицца санын алымға, достар санын бөлімге жаз.' },
      },
    },
    {
      id: percent.id,
      kind: 'whole-number',
      answer: price * (100 - discount) / 100,
      text: {
        ru: { title: percent.text.ru.title, prompt: `Приз стоил ${priceLabel} тенге. Сколько он стоит после скидки ${discount}%? Запиши цену числом в тенге.`, hint: 'Раздели исходную цену на сто, чтобы найти один процент. Найди размер скидки и вычти его из цены.' },
        kk: { title: percent.text.kk.title, prompt: `Жүлде ${priceLabel} теңге тұрды. ${discount}% жеңілдіктен кейін оның бағасы қандай? Бағаны теңгемен, санмен жаз.`, hint: 'Бастапқы бағаны жүзге бөліп, бір пайызды тап. Жеңілдік сомасын есептеп, оны бағадан шегер.' },
      },
    },
    {
      id: map.id,
      kind: 'whole-number',
      answer: length * scale,
      text: {
        ru: { ...map.text.ru, prompt: `На карте между двумя стойками ${length} см. Каждый сантиметр обозначает ${scale} м. Сколько метров между стойками? Запиши только число.` },
        kk: { ...map.text.kk, prompt: `Картада екі дүңгіршектің арасы ${length} см. Әр сантиметр ${scale} метрді білдіреді. Дүңгіршектердің арасы неше метр? Тек санды жаз.` },
      },
    },
  ]
}

export const DAMAGE_PER_ROUND = 30
const STORAGE_KEY = 'amc.schoolFair.guardian'

interface GuardianRun {
  cleared: number
  won: boolean
  variant: number
  used: Partial<Record<GuardianBoost, number>>
}

function readRun(key: string, total: number, fixedVariant?: number): GuardianRun {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (data && typeof data === 'object' && 'cleared' in data && 'won' in data) {
      const { cleared, won } = data
      if (
        typeof cleared === 'number' && Number.isInteger(cleared) &&
        cleared >= 0 && cleared <= total && typeof won === 'boolean'
      ) {
        const variant = 'variant' in data && typeof data.variant === 'number' && Number.isSafeInteger(data.variant) && data.variant > 0 ? data.variant : 0
        const used: GuardianRun['used'] = {}
        if ('used' in data && data.used && typeof data.used === 'object') {
          for (const boost of ['example', 'plan'] as const) {
            const index = (data.used as Record<string, unknown>)[boost]
            if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < total && index <= cleared) used[boost] = index
          }
        }
        return { cleared, won: won || cleared === total, variant: fixedVariant ?? variant, used }
      }
    }
  } catch {
    // An invalid or inaccessible save starts a fresh run.
  }
  return { cleared: 0, won: false, variant: fixedVariant ?? 0, used: {} }
}

function checkRound(round: GuardianRound, answer: string): CheckStatus {
  if (round.kind === 'fraction') {
    const parsed = parseFraction(answer)
    return parsed === null ? 'invalid' : fractionsEqual(parsed, round.answer) ? 'correct' : 'incorrect'
  }
  const parsed = parseWholeNumber(answer)
  return parsed === null ? 'invalid' : parsed === round.answer ? 'correct' : 'incorrect'
}

export function useGuardianChallenge(assignment?: GuardianAssignment) {
  const key = assignment ? `${STORAGE_KEY}.${guardianAssignmentHref(assignment)}` : STORAGE_KEY
  const total = assignment?.topics.length ?? GUARDIAN_ROUNDS.length
  const [run, setRun] = useState(() => readRun(key, total, assignment?.variant))
  const current = useRef(run)
  const allRounds = roundsFor(run.variant)
  const rounds = assignment ? allRounds.filter((round) => assignment.topics.includes(round.id)) : allRounds
  const boosts = assignment?.boosts ?? true

  function update(next: GuardianRun) {
    current.current = next
    setRun(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Play continues in memory when storage is unavailable.
    }
  }

  function submit(roundIndex: number, answer: string): CheckStatus | null {
    // Reject events from the previous round, even before React renders the new one.
    const active = current.current
    if (run.variant !== active.variant || roundIndex !== active.cleared) return null
    const round = rounds[roundIndex]
    if (!round) return null
    const result = checkRound(round, answer)
    if (result === 'correct') {
      const cleared = roundIndex + 1
      update({ ...active, cleared, won: active.won || cleared === rounds.length })
    }
    return result
  }

  function replay() {
    if (current.current.cleared === rounds.length) {
      const variant = assignment?.variant ?? current.current.variant % REPLAY_NUMBERS.length + 1
      update({ cleared: 0, won: true, variant, used: {} })
    }
  }

  function useBoost(boost: GuardianBoost, index: number) {
    const active = current.current
    if (!boosts || index !== active.cleared || index >= rounds.length || active.used[boost] !== undefined) return
    update({ ...active, used: { ...active.used, [boost]: index } })
  }

  return { run, rounds, submit, replay, boosts, useBoost }
}
