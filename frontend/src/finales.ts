import { useCallback, useState } from 'react'
import { parseWholeNumber } from './api/localComics'
import type { CheckStatus, Lang } from './api/types'

// Season finales of the operations after the fair: three whole-number rounds, each lighting
// up one part of the finale scene. Progress is kept in this browser per finale.

type Text = Record<Lang, string>

export interface FinaleRound {
  title: Text
  prompt: Text
  hint: Text
  answer: number
  /** Targeted messages for typical wrong answers. */
  mistakes?: Record<number, Text>
}

export interface FinaleDef {
  /** The operation id; the finale lives at #/operation/{id}/finale. */
  id: string
  title: Text
  intro: Text
  progress: (lit: number, total: number, lang: Lang) => string
  victory: Text
  victoryText: Text
  replay: Text
  rounds: readonly FinaleRound[]
}

const t = (ru: string, kk: string): Text => ({ ru, kk })

export const LIGHTS_FINALE: FinaleDef = {
  id: 'lights',
  title: t('Последний свет', 'Соңғы жарық'),
  intro: t(
    'Световая мозаика на сцене ещё тёмная. Каждый верный ответ зажигает её часть, пока не появится весь узор. Тогда начнётся концерт!',
    'Сахнадағы жарық мозаикасы әлі қараңғы. Әр дұрыс жауап оның бір бөлігін жағады, сонда бүкіл өрнек пайда болады. Сосын концерт басталады!',
  ),
  progress: (lit, total, lang) => (lang === 'kk' ? `Мозаика жанып тұр: ${lit} / ${total} бөлік` : `Мозаика горит: ${lit} из ${total} частей`),
  victory: t('Концерт начинается!', 'Концерт басталады!'),
  victoryText: t(
    'Мозаика горит целиком: площадь, дроби и проценты сошлись. Праздник «Огни Кокшетау» открыт!',
    'Мозаика толығымен жанып тұр: аудан, бөлшектер және пайыздар бәрі сәйкес келді. «Көкшетау шамдары» мерекесі ашылды!',
  ),
  replay: t('Зажечь мозаику заново', 'Мозаиканы қайта жағу'),
  rounds: [
    {
      title: t('Площадь', 'Аудан'),
      // 4 m = 8 tiles, 3 m = 6 rows → 48 tiles.
      answer: 48,
      prompt: t(
        'Световой экран на сцене — прямоугольник 4 м на 3 м. Его собрали из квадратных плиток 50 см на 50 см. Сколько всего плиток в экране? Запиши ответ числом.',
        'Сахнадағы жарық экраны — 4 м-ге 3 м тіктөртбұрыш. Ол 50 см-ге 50 см шаршы тақталардан құралған. Экранда барлығы неше тақта бар? Жауапты санмен жаз.',
      ),
      hint: t(
        'В одном метре помещаются две плитки по 50 см. По длине: 4 · 2 = 8 плиток, по высоте: 3 · 2 = 6 рядов. Перемножь.',
        'Бір метрге 50 см-лік екі тақта сыяды. Ұзындығы бойынша: 4 · 2 = 8 тақта, биіктігі бойынша: 3 · 2 = 6 қатар. Көбейт.',
      ),
      mistakes: {
        12: t('Это площадь в квадратных метрах. Но плитка меньше метра: в одном квадратном метре 4 плитки.', 'Бұл — шаршы метрмен алынған аудан. Бірақ тақта метрден кіші: бір шаршы метрде 4 тақта.'),
        14: t('Ты сложил плитки по длине и по высоте. Плитки заполняют весь экран — нужно умножить: 8 · 6.', 'Ұзындығы мен биіктігі бойынша тақталарды қостың. Тақталар бүкіл экранды толтырады — көбейту керек: 8 · 6.'),
        24: t('Почти! По каждой стороне плиток вдвое больше, чем метров: 8 плиток и 6 рядов.', 'Жақын! Әр жақта тақта метрден екі есе көп: 8 тақта және 6 қатар.'),
      },
    },
    {
      title: t('Дроби', 'Бөлшектер'),
      // 48 : 8 · 3 = 18.
      answer: 18,
      prompt: t(
        'По узору 3/8 всех 48 плиток должны гореть бирюзовым. Сколько бирюзовых плиток? Запиши ответ числом.',
        'Өрнек бойынша барлық 48 тақтаның 3/8 бөлігі көгілдір болып жануы керек. Неше көгілдір тақта? Жауапты санмен жаз.',
      ),
      hint: t(
        'Сначала найди 1/8 от 48, а потом возьми три такие части: 48 : 8 · 3.',
        'Алдымен 48-дің 1/8 бөлігін тап, сосын осындай үш бөлік ал: 48 : 8 · 3.',
      ),
      mistakes: {
        6: t('Это 1/8 всех плиток. А бирюзовых — три такие части.', 'Бұл — барлық тақтаның 1/8 бөлігі. Ал көгілдірлері — осындай үш бөлік.'),
        16: t('Ты разделил 48 на 3. Знаменатель 8 показывает, на сколько частей делить.', '48-ді 3-ке бөлдің. Бөлім 8 неше бөлікке бөлу керегін көрсетеді.'),
      },
    },
    {
      title: t('Проценты', 'Пайыздар'),
      // 25% of 48 = 12.
      answer: 12,
      prompt: t(
        'Ещё 25% всех 48 плиток — это золотые уголки узора. Сколько золотых плиток? Запиши ответ числом.',
        'Барлық 48 тақтаның тағы 25%-ы — өрнектің алтын бұрыштары. Неше алтын тақта? Жауапты санмен жаз.',
      ),
      hint: t('25% — это четверть. Раздели 48 на 4.', '25% — бұл төрттен бір. 48-ді 4-ке бөл.'),
      mistakes: {
        25: t('25 — это процент, а не число плиток. Найди 25% от 48.', '25 — бұл пайыз, тақта саны емес. 48-дің 25%-ын тап.'),
        36: t('Это плитки, которые останутся без золота. А золотых — четверть от 48.', 'Бұл — алтынсыз қалатын тақталар. Ал алтындары — 48-дің төрттен бірі.'),
      },
    },
  ],
}

export const FINALES: Record<string, FinaleDef> = { lights: LIGHTS_FINALE }

export function finaleHref(id: string) {
  return `#/operation/${id}/finale`
}

interface FinaleRun {
  cleared: number
  won: boolean
}

const key = (id: string) => `amc.finale.${id}`

function readRun(def: FinaleDef): FinaleRun {
  try {
    const data = JSON.parse(localStorage.getItem(key(def.id)) ?? 'null') as Partial<FinaleRun> | null
    if (data && Number.isInteger(data.cleared) && data.cleared! >= 0 && data.cleared! <= def.rounds.length && typeof data.won === 'boolean') {
      return { cleared: data.cleared!, won: data.won || data.cleared === def.rounds.length }
    }
  } catch {
    // An invalid or inaccessible save starts from the beginning.
  }
  return { cleared: 0, won: false }
}

/** Whether a finale was ever completed in this browser. */
export function finaleWon(id: string): boolean {
  const def = FINALES[id]
  return !!def && readRun(def).won
}

export function useFinale(def: FinaleDef) {
  const [run, setRun] = useState(() => readRun(def))

  const save = useCallback((next: FinaleRun) => {
    setRun(next)
    try {
      localStorage.setItem(key(def.id), JSON.stringify(next))
    } catch {
      // Play continues in memory when storage is unavailable.
    }
  }, [def.id])

  /** Checks the answer for the current round; a correct one opens the next part. */
  function submit(index: number, answer: string, lang: Lang): { status: CheckStatus; message?: string } | null {
    if (index !== run.cleared) return null
    const round = def.rounds[index]
    if (!round) return null
    const value = parseWholeNumber(answer)
    if (value === null) return { status: 'invalid' }
    if (value !== round.answer) return { status: 'incorrect', message: round.mistakes?.[value]?.[lang] }
    const cleared = index + 1
    save({ cleared, won: run.won || cleared === def.rounds.length })
    return { status: 'correct' }
  }

  function replay() {
    if (run.cleared === def.rounds.length) save({ cleared: 0, won: true })
  }

  return { run, submit, replay }
}
