import type { Comic, CheckStatus, Lang } from './types'

// Contract-matching mock content: six panels, exercise on panel 4,
// three identical pizzas shared equally among four friends.
export const MOCK_COMICS: Record<Lang, Comic> = {
  ru: {
    id: 'pizza-fractions',
    lang: 'ru',
    title: 'Пицца для четырёх друзей',
    panels: [
      { id: 1, speaker: 'Пифик', text: 'Привет! Я Пифик. Сегодня у четырёх друзей праздник!', imageKey: 'pizza-01' },
      { id: 2, speaker: 'Айгерим', text: 'Мы заказали три одинаковые пиццы.', imageKey: 'pizza-02' },
      { id: 3, speaker: 'Данияр', text: 'Но нас четверо! Как разделить пиццы поровну?', imageKey: 'pizza-03' },
      { id: 4, speaker: 'Пифик', text: 'Помогите друзьям! Какую часть пиццы получит каждый?', imageKey: 'pizza-04' },
      { id: 5, speaker: 'Мира', text: 'Можно разрезать каждую пиццу на одинаковые кусочки!', imageKey: 'pizza-05' },
      { id: 6, speaker: 'Пифик', text: 'Каждый получил поровну — вот это настоящая дружба!', imageKey: 'pizza-06' },
    ],
    exercise: {
      id: 'pizza-share',
      panelId: 4,
      prompt:
        'Три одинаковые пиццы разделили поровну между четырьмя друзьями. Какую часть пиццы получит каждый? Запиши ответ дробью, например 1/2.',
    },
  },
  kk: {
    id: 'pizza-fractions',
    lang: 'kk',
    title: 'Төрт досқа арналған пицца',
    panels: [
      { id: 1, speaker: 'Пифик', text: 'Сәлем! Мен Пификпін. Бүгін төрт доста мереке!', imageKey: 'pizza-01' },
      { id: 2, speaker: 'Әйгерім', text: 'Біз үш бірдей пицца тапсырыс бердік.', imageKey: 'pizza-02' },
      { id: 3, speaker: 'Данияр', text: 'Бірақ біз төртеуміз! Пиццаларды қалай тең бөлеміз?', imageKey: 'pizza-03' },
      { id: 4, speaker: 'Пифик', text: 'Достарға көмектесіңдер! Әрқайсысы пиццаның қандай бөлігін алады?', imageKey: 'pizza-04' },
      { id: 5, speaker: 'Мира', text: 'Әр пиццаны бірдей тілімдерге кесуге болады!', imageKey: 'pizza-05' },
      { id: 6, speaker: 'Пифик', text: 'Әркім тең үлес алды — міне, нағыз достық!', imageKey: 'pizza-06' },
    ],
    exercise: {
      id: 'pizza-share',
      panelId: 4,
      prompt:
        'Үш бірдей пиццаны төрт досқа тең бөлді. Әр дос пиццаның қандай бөлігін алады? Жауапты бөлшекпен жаз, мысалы 1/2.',
    },
  },
}

export const MOCK_FEEDBACK: Record<Lang, Record<CheckStatus, string>> = {
  ru: {
    correct: 'Верно! Каждый друг получает 3/4 пиццы.',
    incorrect: 'Пока не так. Попробуй ещё раз или попроси подсказку у Пифика.',
    invalid: 'Не получается прочитать ответ. Запиши дробь в виде a/b — знаменатель не может быть нулём.',
  },
  kk: {
    correct: 'Дұрыс! Әр дос пиццаның 3/4 бөлігін алады.',
    incorrect: 'Әзірге дұрыс емес. Тағы байқап көр немесе Пификтен кеңес сұра.',
    invalid: 'Жауапты оқу мүмкін болмады. Бөлшекті a/b түрінде жаз — бөлім нөлге тең болмауы керек.',
  },
}

// Hints guide the student without stating the answer.
export const MOCK_HINTS: Record<Lang, [string, string]> = {
  ru: [
    'Сколько всего пицц и на сколько друзей их делят? Деление можно записать дробью: что делим / на сколько делим.',
    'Разрежь каждую пиццу на 4 равных кусочка. Сколько кусочков получится всего и сколько достанется одному другу?',
  ],
  kk: [
    'Барлығы қанша пицца және оны неше досқа бөледі? Бөлуді бөлшекпен жазуға болады: нені бөлеміз / нешеге бөлеміз.',
    'Әр пиццаны 4 тең тілімге кес. Барлығы қанша тілім шығады және бір досқа нешеуі тиеді?',
  ],
}
