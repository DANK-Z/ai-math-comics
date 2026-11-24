import type { Lang, Topic } from './api/types'

// UI copy for sign-in, the student profile and the teacher dashboard.

type Skill = 'add' | 'sub' | 'mul' | 'div' | 'mul_add' | 'mul_sub' | 'whole' | 'part' | 'sum'

interface AccountCopy {
  signIn: string
  signUp: string
  signOut: string
  student: string
  teacher: string
  parent: string
  who: string
  displayName: string
  displayNameHint: string
  parentName: string
  parentNameHint: string
  login: string
  loginHint: string
  loginOrEmail: string
  email: string
  password: string
  passwordHint: string
  classCode: string
  classCodeHint: string
  submitSignIn: string
  submitSignUp: string
  working: string
  haveAccount: string
  noAccount: string
  guestNote: string
  errors: Record<string, string>
  fixFields: string
  profile: { title: string; coins: string; stars: string; classTitle: string; teacher: (name: string) => string; noClass: string; join: string; joined: (name: string) => string; play: string }
  teacherArea: {
    title: string
    lead: string
    classes: string
    noClasses: string
    newClass: string
    grade: string
    letter: string
    letterHint: string
    school: string
    schoolHint: string
    create: string
    code: string
    copy: string
    copied: string
    students: (n: number) => string
    open: string
    back: string
    demo: string
  }
  dashboard: {
    ranking: string
    empty: string
    shareCode: (code: string) => string
    columns: { name: string; stars: string; coins: string; bosses: string; misses: string; combo: string; topics: string }
    heatmap: string
    heatmapLead: string
    round: (n: number) => string
    mistakes: (wrong: number, all: number) => string
    invalid: (n: number) => string
    wrong: string
    noData: string
    recommendation: (percent: number, round: number, skill: string, review: string) => string
    noRecommendation: string
    fewAnswers: string
    legend: { low: string; mid: string; high: string }
  }
  topics: Record<Topic, string>
  skills: Record<Skill, { name: string; review: string }>
}

export const ACCOUNT_COPY: Record<Lang, AccountCopy> = {
  ru: {
    signIn: 'Войти',
    signUp: 'Регистрация',
    signOut: 'Выйти',
    student: 'Я ученик',
    parent: 'Я родитель',
    teacher: 'Я учитель',
    who: 'Кто входит?',
    displayName: 'Как тебя зовут',
    displayNameHint: 'Это имя увидит учитель.',
    parentName: 'Ваше имя',
    parentNameHint: 'Ребёнок увидит его в ваших открытках.',
    login: 'Логин',
    loginHint: 'Латинские буквы и цифры, от 3 символов: например, aruna_5a.',
    loginOrEmail: 'Логин (или почта учителя)',
    email: 'Почта',
    password: 'Пароль',
    passwordHint: 'Не короче 8 символов.',
    classCode: 'Код класса',
    classCodeHint: 'Если учитель дал код — введи его. Можно добавить позже в профиле.',
    submitSignIn: 'Войти',
    submitSignUp: 'Создать аккаунт',
    working: 'Подождите…',
    haveAccount: 'Уже есть аккаунт? Войти',
    noAccount: 'Нет аккаунта? Зарегистрироваться',
    guestNote: 'Можно играть и без входа — но тогда звёзды, монеты и прогресс хранятся только в этом браузере.',
    errors: {
      login_taken: 'Такой логин уже занят — придумай другой.',
      email_taken: 'Эта почта уже зарегистрирована.',
      wrong_login_or_password: 'Неверный логин или пароль.',
      sign_in_rate_limited: 'Слишком много попыток входа. Подожди несколько минут и попробуй снова.',
      class_not_found: 'Класс с таким кодом не найден. Проверь код у учителя.',
      validation: 'Проверь поля: логин, почту и пароль.',
      network: 'Нет связи с сервером. Попробуй ещё раз.',
    },
    fixFields: 'Проверь отмеченные поля.',
    profile: {
      title: 'Мой профиль',
      coins: 'Монеты',
      stars: 'Звёзды',
      classTitle: 'Мой класс',
      teacher: (name) => `Учитель: ${name}`,
      noClass: 'Ты пока не в классе. Введи код, который дал учитель.',
      join: 'Присоединиться',
      joined: (name) => `Готово! Ты в классе ${name}.`,
      play: 'К карте глав',
    },
    teacherArea: {
      title: 'Кабинет учителя',
      lead: 'Создайте класс, раздайте ученикам код и смотрите, где класс ошибается чаще всего.',
      classes: 'Мои классы',
      noClasses: 'Классов пока нет — создайте первый.',
      newClass: 'Новый класс',
      grade: 'Параллель',
      letter: 'Буква',
      letterHint: 'Например: А',
      school: 'Код школы',
      schoolHint: 'Латиницей, 2–8 букв: например, KOKSH. Станет началом кода класса.',
      create: 'Создать класс и код',
      code: 'Код класса',
      copy: 'Скопировать',
      copied: 'Скопировано!',
      students: (n) => `Учеников: ${n}`,
      open: 'Открыть аналитику',
      back: '← Все классы',
      demo: 'Демо-режим: в аналитике показаны примерные данные.',
    },
    dashboard: {
      ranking: 'Рейтинг учеников',
      empty: 'В классе пока нет учеников.',
      shareCode: (code) => `Раздайте ученикам код ${code}: они вводят его при регистрации или в профиле.`,
      columns: { name: 'Ученик', stars: 'Звёзды', coins: 'Монеты', bosses: 'Боссы', misses: 'Ошибки', combo: 'Комбо', topics: 'Темы' },
      heatmap: 'Карта ошибок',
      heatmapLead: 'Доля учеников, которые ошиблись хотя бы раз в раунде босса.',
      round: (n) => `Раунд ${n}`,
      mistakes: (w, all) => `ошиблись ${w} из ${all}`,
      invalid: (n) => `неверный формат: ${n}`,
      wrong: 'Частые ответы:',
      noData: 'Пока нет ответов',
      recommendation: (percent, round, skill, review) =>
        `${percent}% класса ошиблись в Раунде ${round} (${skill}). Рекомендуется повторить тему «${review}».`,
      noRecommendation: 'Явных провалов нет: ни в одном раунде не ошиблась половина класса.',
      fewAnswers: 'Пока ответов мало: рекомендация появится, когда раунд пройдут хотя бы два ученика.',
      legend: { low: 'до 30%', mid: '30–59%', high: '60% и больше' },
    },
    topics: { fractions: 'Дроби', equations: 'Уравнения' },
    skills: {
      add: { name: 'уравнения со сложением', review: 'Неизвестное слагаемое' },
      sub: { name: 'уравнения с вычитанием', review: 'Неизвестное уменьшаемое' },
      mul: { name: 'уравнения на умножение', review: 'Неизвестный множитель' },
      div: { name: 'уравнения на деление', review: 'Деление с неизвестным' },
      mul_add: { name: 'уравнения в два действия', review: 'Уравнения в два действия' },
      mul_sub: { name: 'уравнения в два действия', review: 'Уравнения в два действия' },
      whole: { name: 'деление целых пицц', review: 'Дробь как результат деления' },
      part: { name: 'деление дроби на число', review: 'Деление дроби на натуральное число' },
      sum: { name: 'сложение дробей', review: 'Сложение дробей с разными знаменателями' },
    },
  },
  kk: {
    signIn: 'Кіру',
    signUp: 'Тіркелу',
    signOut: 'Шығу',
    student: 'Мен оқушымын',
    parent: 'Мен ата-анамын',
    teacher: 'Мен мұғаліммін',
    who: 'Кім кіреді?',
    displayName: 'Атың кім',
    displayNameHint: 'Бұл атты мұғалім көреді.',
    parentName: 'Сіздің атыңыз',
    parentNameHint: 'Бала оны сіздің ашықхаттарыңызда көреді.',
    login: 'Логин',
    loginHint: 'Латын әріптері мен сандар, кемінде 3 таңба: мысалы, aruna_5a.',
    loginOrEmail: 'Логин (немесе мұғалімнің поштасы)',
    email: 'Пошта',
    password: 'Құпиясөз',
    passwordHint: 'Кемінде 8 таңба.',
    classCode: 'Сынып коды',
    classCodeHint: 'Мұғалім код берсе, оны енгіз. Кейін профильде де қосуға болады.',
    submitSignIn: 'Кіру',
    submitSignUp: 'Аккаунт ашу',
    working: 'Күте тұрыңыз…',
    haveAccount: 'Аккаунтың бар ма? Кіру',
    noAccount: 'Аккаунтың жоқ па? Тіркелу',
    guestNote: 'Кірмей-ақ ойнауға болады — бірақ сонда жұлдыздар, тиындар мен прогресс тек осы браузерде сақталады.',
    errors: {
      login_taken: 'Бұл логин бос емес — басқасын ойлап тап.',
      email_taken: 'Бұл пошта бұрын тіркелген.',
      wrong_login_or_password: 'Логин немесе құпиясөз қате.',
      sign_in_rate_limited: 'Кіру әрекеттері тым көп. Бірнеше минут күтіп, қайта байқап көр.',
      class_not_found: 'Мұндай кодпен сынып табылмады. Кодты мұғалімнен тексер.',
      validation: 'Өрістерді тексер: логин, пошта және құпиясөз.',
      network: 'Сервермен байланыс жоқ. Тағы байқап көр.',
    },
    fixFields: 'Белгіленген өрістерді тексер.',
    profile: {
      title: 'Менің профилім',
      coins: 'Тиындар',
      stars: 'Жұлдыздар',
      classTitle: 'Менің сыныбым',
      teacher: (name) => `Мұғалім: ${name}`,
      noClass: 'Сен әлі сыныпта емессің. Мұғалім берген кодты енгіз.',
      join: 'Қосылу',
      joined: (name) => `Дайын! Сен ${name} сыныбындасың.`,
      play: 'Тараулар картасына',
    },
    teacherArea: {
      title: 'Мұғалім кабинеті',
      lead: 'Сынып ашып, оқушыларға код таратыңыз және сынып қай жерде жиі қателесетінін көріңіз.',
      classes: 'Менің сыныптарым',
      noClasses: 'Әзірге сынып жоқ — алғашқысын ашыңыз.',
      newClass: 'Жаңа сынып',
      grade: 'Параллель',
      letter: 'Әріп',
      letterHint: 'Мысалы: А',
      school: 'Мектеп коды',
      schoolHint: 'Латынша, 2–8 әріп: мысалы, KOKSH. Сынып кодының басы болады.',
      create: 'Сынып пен код ашу',
      code: 'Сынып коды',
      copy: 'Көшіру',
      copied: 'Көшірілді!',
      students: (n) => `Оқушылар: ${n}`,
      open: 'Талдауды ашу',
      back: '← Барлық сыныптар',
      demo: 'Демо режим: талдауда үлгі деректер көрсетілген.',
    },
    dashboard: {
      ranking: 'Оқушылар рейтингі',
      empty: 'Сыныпта әзірге оқушы жоқ.',
      shareCode: (code) => `Оқушыларға ${code} кодын таратыңыз: олар оны тіркелгенде не профильде енгізеді.`,
      columns: { name: 'Оқушы', stars: 'Жұлдыз', coins: 'Тиын', bosses: 'Босс', misses: 'Қате', combo: 'Комбо', topics: 'Тақырыптар' },
      heatmap: 'Қателер картасы',
      heatmapLead: 'Босс раундында кемінде бір рет қателескен оқушылардың үлесі.',
      round: (n) => `${n}-раунд`,
      mistakes: (w, all) => `${all} оқушының ${w}-і қателесті`,
      invalid: (n) => `қате формат: ${n}`,
      wrong: 'Жиі жауаптар:',
      noData: 'Әзірге жауап жоқ',
      recommendation: (percent, round, skill, review) =>
        `Сыныптың ${percent}%-ы ${round}-раундта қателесті (${skill}). «${review}» тақырыбын қайталау ұсынылады.`,
      noRecommendation: 'Айқын қиындық жоқ: ешбір раундта сыныптың жартысы қателеспеді.',
      fewAnswers: 'Әзірге жауап аз: раундты кемінде екі оқушы өткенде ұсыныс пайда болады.',
      legend: { low: '30%-ға дейін', mid: '30–59%', high: '60% және одан көп' },
    },
    topics: { fractions: 'Бөлшектер', equations: 'Теңдеулер' },
    skills: {
      add: { name: 'қосуға арналған теңдеулер', review: 'Белгісіз қосылғыш' },
      sub: { name: 'азайтуға арналған теңдеулер', review: 'Белгісіз азайғыш' },
      mul: { name: 'көбейтуге арналған теңдеулер', review: 'Белгісіз көбейткіш' },
      div: { name: 'бөлуге арналған теңдеулер', review: 'Белгісізі бар бөлу' },
      mul_add: { name: 'екі амалды теңдеулер', review: 'Екі амалды теңдеулер' },
      mul_sub: { name: 'екі амалды теңдеулер', review: 'Екі амалды теңдеулер' },
      whole: { name: 'бүтін пиццаларды бөлу', review: 'Бөлшек — бөлудің нәтижесі' },
      part: { name: 'бөлшекті санға бөлу', review: 'Бөлшекті натурал санға бөлу' },
      sum: { name: 'бөлшектерді қосу', review: 'Бөлімдері әртүрлі бөлшектерді қосу' },
    },
  },
}

export function skillCopy(lang: Lang, skill: string | null) {
  return (skill && ACCOUNT_COPY[lang].skills[skill as Skill]) || null
}
