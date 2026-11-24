import type { Comic, CheckStatus, Lang } from './types'

// Contract-matching mock content: six panels, exercise on panel 4,
// three identical pizzas shared equally among four friends.
// Speakers are the cast from docs/visual-guide (Алдияр, Аруна, Пифик) so the art matches.
export const MOCK_COMICS: Record<Lang, Comic> = {
  ru: {
    id: 'pizza-fractions',
    lang: 'ru',
    title: 'Пицца для четырёх друзей',
    panels: [
      { id: 1, speaker: 'Пифик', text: 'Привет! Я Пифик. Сегодня у четырёх друзей праздник!', imageKey: 'pizza-01' },
      { id: 2, speaker: 'Аруна', text: 'Мы заказали три одинаковые пиццы.', imageKey: 'pizza-02' },
      { id: 3, speaker: 'Аруна', text: 'Вот они! Но нас четверо — как разделить три пиццы поровну?', imageKey: 'pizza-03' },
      { id: 4, speaker: 'Пифик', text: 'Помогите друзьям! Какую часть пиццы получит каждый?', imageKey: 'pizza-04' },
      { id: 5, speaker: 'Алдияр', text: 'Разрежу каждую пиццу на одинаковые кусочки!', imageKey: 'pizza-05' },
      { id: 6, speaker: 'Алдияр', text: 'Каждый получил поровну — вот это настоящая дружба!', imageKey: 'pizza-06' },
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
      { id: 2, speaker: 'Аруна', text: 'Біз үш бірдей пицца тапсырыс бердік.', imageKey: 'pizza-02' },
      { id: 3, speaker: 'Аруна', text: 'Міне, пиццалар! Бірақ біз төртеуміз — үш пиццаны қалай тең бөлеміз?', imageKey: 'pizza-03' },
      { id: 4, speaker: 'Пифик', text: 'Достарға көмектесіңдер! Әрқайсысы пиццаның қандай бөлігін алады?', imageKey: 'pizza-04' },
      { id: 5, speaker: 'Алдияр', text: 'Әр пиццаны бірдей тілімдерге кесемін!', imageKey: 'pizza-05' },
      { id: 6, speaker: 'Алдияр', text: 'Әркім тең үлес алды — міне, нағыз достық!', imageKey: 'pizza-06' },
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
    'Равное деление можно записать дробью: что делим — в числителе, на сколько частей делим — в знаменателе.',
    'Сосчитай пиццы и запиши это число сверху. Сосчитай друзей и запиши их число снизу.',
  ],
  kk: [
    'Тең бөлуді бөлшекпен жазуға болады: бөлінетін сан алымға, тең бөлік саны бөлімге жазылады.',
    'Пиццаларды санап, санын алымға жаз. Достарды санап, санын бөлімге жаз.',
  ],
}
