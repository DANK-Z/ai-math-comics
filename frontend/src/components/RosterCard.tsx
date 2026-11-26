import type { Lang, StudentCredentials } from '../api'

// Texts for student accounts and the printable login cards. Passwords are shown once (the
// server keeps only a hash), so a card can be printed right after creating or resetting one.

export const ROSTER_COPY = {
  ru: {
    tab: 'Ученики',
    title: 'Аккаунты учеников',
    lead: 'Впишите имена — по одному в строке. Логин и простой пароль придумаются сами. Пароль виден только сейчас: распечатайте карточки или перепишите.',
    names: 'Имена учеников',
    placeholder: 'Аружан Бекова\nТимур Ахметов',
    create: 'Создать аккаунты',
    creating: 'Создаём…',
    made: 'Новые входы — раздайте ученикам',
    print: 'Распечатать карточки',
    login: 'Логин',
    password: 'Пароль',
    site: 'Сайт',
    list: 'Ученики класса',
    empty: 'В классе пока нет учеников.',
    reset: 'Новый пароль',
    resetting: '…',
    newPassword: (name: string, login: string, password: string) => `${name}: логин ${login}, новый пароль ${password}`,
    error: 'Не получилось. Проверьте имена: только буквы, без цифр.',
    report: 'Тренировки за 30 дней',
    reportLead: 'Кто повторял темы сам: начатые тренировки, решённые задачи и темы.',
    drills: (n: number, done: number) => `тренировок: ${n}, пройдено: ${done}`,
    solved: (n: number) => `задач решено: ${n}`,
    never: 'ещё не тренировался',
  },
  kk: {
    tab: 'Оқушылар',
    title: 'Оқушылардың аккаунттары',
    lead: 'Аттарды жазыңыз — әр жолға біреуден. Логин мен қарапайым құпиясөз өзі жасалады. Құпиясөз тек қазір көрінеді: карточкаларды басып шығарыңыз немесе көшіріп алыңыз.',
    names: 'Оқушылардың аттары',
    placeholder: 'Аружан Бекова\nТимур Ахметов',
    create: 'Аккаунттарды жасау',
    creating: 'Жасап жатырмыз…',
    made: 'Жаңа кірулер — оқушыларға таратыңыз',
    print: 'Карточкаларды басып шығару',
    login: 'Логин',
    password: 'Құпиясөз',
    site: 'Сайт',
    list: 'Сынып оқушылары',
    empty: 'Сыныпта әлі оқушы жоқ.',
    reset: 'Жаңа құпиясөз',
    resetting: '…',
    newPassword: (name: string, login: string, password: string) => `${name}: логин ${login}, жаңа құпиясөз ${password}`,
    error: 'Болмады. Аттарды тексеріңіз: тек әріптер, сансыз.',
    report: '30 күндегі жаттығулар',
    reportLead: 'Тақырыптарды кім өз бетінше қайталады: басталған жаттығулар, шығарылған есептер және тақырыптар.',
    drills: (n: number, done: number) => `жаттығу: ${n}, аяқталды: ${done}`,
    solved: (n: number) => `шығарылған есеп: ${n}`,
    never: 'әлі жаттықпаған',
  },
}

export function printCards(lang: Lang, made: StudentCredentials[]) {
  const copy = ROSTER_COPY[lang]
  const site = `${window.location.origin}${window.location.pathname}`
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return
  const doc = win.document
  doc.title = copy.made
  const style = doc.createElement('style')
  style.textContent = 'body{font-family:system-ui,sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}div{border:2px dashed #555;border-radius:12px;padding:12px;break-inside:avoid}b{font-size:18px}p{margin:6px 0;font-size:15px}code{font-size:18px;font-weight:700}'
  doc.head.append(style)
  for (const s of made) {
    const card = doc.createElement('div')
    const name = doc.createElement('b')
    name.textContent = s.displayName
    card.append(name)
    for (const [label, value] of [[copy.site, site], [copy.login, s.login], [copy.password, s.password]]) {
      const line = doc.createElement('p')
      line.append(`${label}: `)
      const code = doc.createElement('code')
      code.textContent = value
      line.append(code)
      card.append(line)
    }
    doc.body.append(card)
  }
  win.print()
}
