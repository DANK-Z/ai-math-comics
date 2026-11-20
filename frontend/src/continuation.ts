import type { Lang } from './api/types'

type Localized<T> = Record<Lang, T>

interface Choice {
  label: Localized<string>
  preview: Localized<string>
}

// IDs are stable across languages and can be used by a future generation endpoint.
export const CONTINUATION_CHOICES = {
  'library-cabinet-key': {
    label: {
      ru: 'Ключ от библиотечного шкафа',
      kk: 'Кітапхана шкафының кілті',
    },
    preview: {
      ru: 'Аруна достала из конверта ключ с крошечной книжкой на брелоке. Алдияр убрал конверт в жёлтый рюкзак, а Пифик заметил вывеску библиотеки за книжным стендом ярмарки. Друзья решили спросить библиотекаря, от какого шкафа этот ключ.',
      kk: 'Аруна конверттен кішкентай кітап салпыншағы бар кілтті алды. Алдияр конвертті сары сөмкеге салды, ал Пифик жәрмеңкедегі кітап сөресінің ар жағынан кітапхананың маңдайшасын байқады. Достар кілттің қай шкафты ашатынын кітапханашыдан сұрамақ болды.',
    },
  },
  'new-route-note': {
    label: {
      ru: 'Записка с новым маршрутом',
      kk: 'Жаңа бағыт жазылған хат',
    },
    preview: {
      ru: 'В конверте нашлась записка: у флажков ярмарки нужно свернуть во двор. Алдияр достал карту из жёлтого рюкзака, и Аруна отметила поворот. Пифик предложил сверить стрелку на карте с указателем у входа во двор.',
      kk: 'Конверттегі хатта жәрмеңке жалаушаларының тұсынан аулаға бұрылу керегі жазылыпты. Алдияр сары сөмкеден картаны шығарды, Аруна бұрылысты белгілеп қойды. Пифик картадағы жебені аулаға кіреберістегі көрсеткішпен салыстыруды ұсынды.',
    },
  },
  'fair-attraction-ticket': {
    label: {
      ru: 'Билет на аттракцион ярмарки',
      kk: 'Жәрмеңкедегі аттракционға билет',
    },
    preview: {
      ru: 'Из конверта выпал билет на ярмарочную игру с кольцами. Аруна заметила стойку с такими же кольцами, а Пифик предложил сыграть, пока там нет очереди. Алдияр положил конверт в жёлтый рюкзак и отметил на карте, откуда они продолжат маршрут.',
      kk: 'Конверттен жәрмеңкедегі сақина лақтыру ойынына билет түсті. Аруна дәл сондай сақиналары бар дүңгіршекті көрді, ал Пифик кезек жоқта ойнап көруді ұсынды. Алдияр конвертті сары сөмкеге салып, бағытты қай жерден жалғастыратынын картаға белгіледі.',
    },
  },
} satisfies Record<string, Choice>

export type ContinuationChoiceId = keyof typeof CONTINUATION_CHOICES
export const CONTINUATION_CHOICE_IDS = Object.keys(CONTINUATION_CHOICES) as ContinuationChoiceId[]

const fixedStoryFacts = {
  heroes: ['aldiyar', 'aruna', 'pifik'],
  setting: 'school-fair',
  backpack: 'yellow school backpack carrying the fair route map',
  envelope: 'an envelope found during the fair route',
  canonicalEnvelopeClue: 'the library is the next station',
} as const

export interface ContinuationInput {
  sourceChapterId: string
  choiceId: ContinuationChoiceId
  locale: Lang
  fixedStoryFacts: typeof fixedStoryFacts
}

export function continuationInput(
  sourceChapterId: string,
  choiceId: ContinuationChoiceId,
  locale: Lang,
): ContinuationInput {
  return { sourceChapterId, choiceId, locale, fixedStoryFacts }
}

export function preparedPreview(input: ContinuationInput): string {
  return CONTINUATION_CHOICES[input.choiceId].preview[input.locale]
}

export const CONTINUATION_COPY = {
  ru: {
    create: 'Придумать продолжение',
    question: 'Что было в конверте?',
    premise: 'Представь, что кроме подсказки о библиотеке в конверте было что-то ещё.',
    openPreview: 'Открыть отрывок',
    preview: 'Подготовленный отрывок истории',
    chooseDifferent: 'Выбрать другой вариант',
    back: 'Вернуться к финалу главы',
    canonical: 'Перейти к главе 4',
  },
  kk: {
    create: 'Оқиғаны жалғастыру',
    question: 'Конверттің ішінде не болды?',
    premise: 'Кітапхана туралы кеңестен бөлек, конвертте тағы бір зат болды деп елестет.',
    openPreview: 'Үзіндіні ашу',
    preview: 'Оқиғаның дайын үзіндісі',
    chooseDifferent: 'Басқа нұсқаны таңдау',
    back: 'Тараудың соңына оралу',
    canonical: '4-тарауға өту',
  },
} satisfies Localized<Record<string, string>>
