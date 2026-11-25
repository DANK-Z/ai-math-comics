import panel1 from '../assets/school-store/panel-1.png'
import panel2 from '../assets/school-store/panel-2.png'
import panel3 from '../assets/school-store/panel-3.png'
import panel4 from '../assets/school-store/panel-4.png'
import { SCHOOL_STORE_COMIC_ID } from '../route'
import type { LocalComicDef } from './localComics'

export const SCHOOL_STORE_EXERCISE_ID = 'backpack-discount'

const prompt = {
  ru: 'Рюкзак стоил 12 000 ₸. Сколько он будет стоить после скидки 25%? Запиши цену в тенге целым числом.',
  kk: 'Арқа сөмкесінің бағасы 12 000 ₸ еді. 25% жеңілдіктен кейін ол қанша тұрады? Бағаны теңгемен бүтін сан түрінде жаз.',
}

/** Chapter 2 of “Operation: School Fair”. */
export const SCHOOL_STORE: LocalComicDef = {
  id: SCHOOL_STORE_COMIC_ID,
  exerciseId: SCHOOL_STORE_EXERCISE_ID,
  panels: [
    { image: panel1, speaker: 'Алдияр' },
    { image: panel2, speaker: 'Аруна' },
    { image: panel3, speaker: 'Пифик' },
    { image: panel4, speaker: 'Алдияр' },
  ],
  imageAspect: 16 / 9,
  exercisePanelId: 3,
  answer: 9000,
  text: {
    ru: {
      title: 'Скидка в школьном магазине',
      hook: 'Рюкзак со скидкой. Сколько нужно заплатить?',
      dialogue: [
        'Смотрите, какой рюкзак в школьном магазине!',
        'На ценнике 12 000 ₸, а сегодня на рюкзак скидка 25%.',
        prompt.ru,
        'Скидка составляет 3 000 ₸. Итоговая цена: 12 000 − 3 000 = 9 000 ₸.',
      ],
      prompt: prompt.ru,
      hints: [
        '25% — это четверть. Цена со скидкой равна исходной цене минус размер скидки.',
        'Раздели 12 000 на четыре, чтобы найти размер скидки. Затем вычти его из 12 000.',
      ],
      feedback: {
        correct: 'Верно! Ты нашёл цену рюкзака после скидки.',
        incorrect: 'Пока неверно. Проверь, какую сумму нужно вычесть из исходной цены.',
        invalid: 'Введи целое число в тенге без символа валюты. Ты можешь разделить разряды пробелом.',
      },
    },
    kk: {
      title: 'Мектеп дүкеніндегі жеңілдік',
      hook: 'Жеңілдіктегі арқа сөмкесі. Қанша төлеу керек?',
      dialogue: [
        'Мектеп дүкеніндегі мына сөмкені қараңдаршы!',
        'Бағасы 12 000 ₸ екен. Бүгін бұл сөмкеге 25% жеңілдік бар.',
        prompt.kk,
        'Жеңілдік сомасы — 3 000 ₸. Соңғы баға: 12 000 − 3 000 = 9 000 ₸.',
      ],
      prompt: prompt.kk,
      hints: [
        '25% — төрттен бір бөлік. Жеңілдіктен кейінгі баға бастапқы баға мен жеңілдік сомасының айырмасына тең.',
        'Жеңілдік сомасын табу үшін 12 000-ды төртке бөл. Содан кейін оны 12 000-нан шегер.',
      ],
      feedback: {
        correct: 'Дұрыс! Жеңілдіктен кейінгі бағаны таптың.',
        incorrect: 'Әзірге дұрыс емес. Бастапқы бағадан қанша теңге шегеру керегін тексер.',
        invalid: 'Валюта белгісінсіз бүтін сан енгіз. Санның разрядтарын бос орынмен бөлуге болады.',
      },
    },
  },
}
