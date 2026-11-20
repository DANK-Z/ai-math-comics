import panel1 from '../assets/school-store/panel-1.png'
import panel2 from '../assets/school-store/panel-2.png'
import panel3 from '../assets/school-store/panel-3.png'
import panel4 from '../assets/school-store/panel-4.png'
import { SCHOOL_STORE_COMIC_ID } from '../route'
import type { CheckResponse, CheckStatus, Comic, HintResponse, HintStep, Lang } from './types'

export const SCHOOL_STORE_EXERCISE_ID = 'backpack-discount'

export const SCHOOL_STORE_TITLES = {
  ru: 'Скидка в школьном магазине',
  kk: 'Мектеп дүкеніндегі жеңілдік',
}

const story = {
  ru: {
    dialogue: [
      'Смотрите, какой рюкзак в школьном магазине!',
      'На ценнике 12 000 ₸, а сегодня на рюкзак скидка 25%.',
      'Рюкзак стоил 12 000 ₸. Сколько он будет стоить после скидки 25%? Запиши цену в тенге целым числом.',
      'Скидка составляет 3 000 ₸. Итоговая цена: 12,000 − 3,000 = 9,000 KZT.',
    ],
    hints: [
      '25% — это четверть. Чтобы найти размер скидки, раздели исходную цену на четыре.',
      'Вычти сумму скидки из исходной цены рюкзака.',
    ],
    feedback: {
      correct: 'Верно! Ты нашёл цену рюкзака после скидки.',
      incorrect: 'Пока неверно. Проверь, какую сумму нужно вычесть из исходной цены.',
      invalid: 'Введи целое число в тенге без символа валюты. Ты можешь разделить разряды пробелом.',
    },
  },
  kk: {
    dialogue: [
      'Мектеп дүкеніндегі мына сөмкені қараңдаршы!',
      'Бағасы 12 000 ₸ екен. Бүгін бұл сөмкеге 25% жеңілдік бар.',
      'Арқа сөмкесінің бағасы 12 000 ₸ еді. 25% жеңілдіктен кейін ол қанша тұрады? Бағаны теңгемен бүтін сан түрінде жаз.',
      'Жеңілдік сомасы — 3 000 ₸. Соңғы баға: 12,000 − 3,000 = 9,000 KZT.',
    ],
    hints: [
      '25% — төрттен бір бөлік. Жеңілдік сомасын табу үшін бастапқы бағаны төртке бөл.',
      'Арқа сөмкесінің бастапқы бағасынан жеңілдік сомасын шегер.',
    ],
    feedback: {
      correct: 'Дұрыс! Жеңілдіктен кейінгі бағаны таптың.',
      incorrect: 'Әзірге дұрыс емес. Бастапқы бағадан қанша теңге шегеру керегін тексер.',
      invalid: 'Валюта белгісінсіз бүтін сан енгіз. Санның разрядтарын бос орынмен бөлуге болады.',
    },
  },
}

const panels = [
  { image: panel1, speaker: 'Алдияр' },
  { image: panel2, speaker: 'Аруна' },
  { image: panel3, speaker: 'Пифик' },
  { image: panel4, speaker: 'Алдияр' },
]

export function schoolStoreComic(lang: Lang): Comic {
  const content = story[lang]
  return {
    id: SCHOOL_STORE_COMIC_ID,
    lang,
    title: SCHOOL_STORE_TITLES[lang],
    panels: panels.map(({ image, speaker }, index) => ({
      id: index + 1,
      speaker,
      imageKey: `school-store-${index + 1}`,
      // Vite serves these assets on the frontend origin, including in live API mode.
      imageUrl: new URL(image, window.location.href).href,
      imageAspect: 16 / 9,
      text: content.dialogue[index],
    })),
    exercise: {
      id: SCHOOL_STORE_EXERCISE_ID,
      panelId: 3,
      prompt: content.dialogue[2],
      answerFormat: 'whole-number',
    },
  }
}

export function checkSchoolStoreAnswer(answer: string, lang: Lang): CheckResponse {
  const value = answer.trim()
  let status: CheckStatus = 'invalid'
  if (/^(?:[0-9]+|[0-9]{1,3}(?:[ \u00a0\u202f][0-9]{3})+)$/.test(value)) {
    status = Number(value.replace(/[ \u00a0\u202f]/g, '')) === 9000 ? 'correct' : 'incorrect'
  }
  return { status, message: story[lang].feedback[status] }
}

export function schoolStoreHint(lang: Lang, step: HintStep): HintResponse {
  return { step, text: story[lang].hints[step - 1], hasMore: step === 1 }
}
