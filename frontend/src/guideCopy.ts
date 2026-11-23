import type { Lang } from './api'

// "What next?" hints that fill otherwise empty space: the map's continue card, the reader's
// progress card, My Comics, backpack silhouettes and the teacher's class cards.

interface GuideCopy {
  map: {
    continueFrom: (chapter: number) => string
    startSeason: string
    read: (chapter: number) => string
    allChapters: string
    allChaptersLead: string
    toGuardian: string
    seasonDone: string
    seasonDoneLead: string
    createComic: string
    lastOpened: string
    teacherStop: string
  }
  reader: {
    title: string
    panels: (open: number, total: number) => string
    task: (panel: number) => string
    lockReason: (panel: number) => string
    bossReason: (panel: number, cleared: number, rounds: number) => string
    toTask: (panel: number) => string
    open: string
    legendTask: string
  }
  myComics: { lastOpened: string }
  backpack: { secret: string; where: (chapter: number, location: string) => string; open: string }
  teacher: {
    waiting: string
    shareCode: string
    latest: string
    solved: (done: number, total: number) => string
    hints: (n: number) => string
    noAssignments: string
  }
}

export const GUIDE_COPY: Record<Lang, GuideCopy> = {
  ru: {
    map: {
      continueFrom: (n) => `Продолжить с главы ${n}`,
      startSeason: 'Начни сезон с главы 1',
      read: (n) => `Читать главу ${n}`,
      allChapters: 'Все главы пройдены!',
      allChaptersLead: 'Остался последний шаг — Финальное испытание.',
      toGuardian: 'К испытанию',
      seasonDone: 'Сезон пройден!',
      seasonDoneLead: 'Придумай свою историю с Пификом.',
      createComic: 'Создать комикс',
      lastOpened: 'Последний открытый комикс',
      teacherStop: 'Локация учителя',
    },
    reader: {
      title: 'Прогресс по кадрам',
      panels: (open, total) => `Открыто кадров: ${open} из ${total}`,
      task: (n) => `Задача — на кадре ${n}`,
      lockReason: (n) => `Финал закрыт: реши задачу на кадре ${n}, и откроются следующие кадры.`,
      bossReason: (n, cleared, rounds) => `Финал закрыт: победи босса на кадре ${n}. Раунды: ${cleared} из ${rounds}.`,
      toTask: (n) => `К задаче на кадре ${n}`,
      open: 'Задача решена — вся история открыта.',
      legendTask: 'кадр с задачей',
    },
    myComics: { lastOpened: 'Открыт последним' },
    backpack: {
      secret: 'Секретный предмет',
      where: (n, location) => `Глава ${n} · ${location}`,
      open: 'Открыть главу',
    },
    teacher: {
      waiting: 'Пока никто не вступил. Отправьте ученикам код класса:',
      shareCode: 'Ученик вводит этот код при регистрации или в профиле.',
      latest: 'Последнее задание',
      solved: (done, total) => `Решили: ${done} из ${total}`,
      hints: (n) => `Открывали подсказки: ${n}`,
      noAssignments: 'Заданий пока нет — создайте авторский комикс.',
    },
  },
  kk: {
    map: {
      continueFrom: (n) => `${n}-тараудан жалғастыру`,
      startSeason: 'Маусымды 1-тараудан баста',
      read: (n) => `${n}-тарауды оқу`,
      allChapters: 'Барлық тарау өтілді!',
      allChaptersLead: 'Соңғы қадам қалды — Соңғы сынақ.',
      toGuardian: 'Сынаққа өту',
      seasonDone: 'Маусым аяқталды!',
      seasonDoneLead: 'Пификпен өз оқиғаңды ойлап тап.',
      createComic: 'Комикс жасау',
      lastOpened: 'Соңғы ашылған комикс',
      teacherStop: 'Мұғалімнің аялдамасы',
    },
    reader: {
      title: 'Кадрлар бойынша прогресс',
      panels: (open, total) => `Ашылған кадрлар: ${open} / ${total}`,
      task: (n) => `Есеп — ${n}-кадрда`,
      lockReason: (n) => `Соңы жабық: ${n}-кадрдағы есепті шығар, сонда келесі кадрлар ашылады.`,
      bossReason: (n, cleared, rounds) => `Соңы жабық: ${n}-кадрдағы боссты жең. Раундтар: ${cleared} / ${rounds}.`,
      toTask: (n) => `${n}-кадрдағы есепке өту`,
      open: 'Есеп шығарылды — бүкіл оқиға ашық.',
      legendTask: 'есеп бар кадр',
    },
    myComics: { lastOpened: 'Соңғы ашылған' },
    backpack: {
      secret: 'Құпия зат',
      where: (n, location) => `${n}-тарау · ${location}`,
      open: 'Тарауды ашу',
    },
    teacher: {
      waiting: 'Әзірге ешкім қосылған жоқ. Оқушыларға сынып кодын жіберіңіз:',
      shareCode: 'Оқушы бұл кодты тіркелгенде немесе профильде енгізеді.',
      latest: 'Соңғы тапсырма',
      solved: (done, total) => `Шығарғандар: ${done} / ${total}`,
      hints: (n) => `Кеңес ашқандар: ${n}`,
      noAssignments: 'Әзірге тапсырма жоқ — авторлық комикс жасаңыз.',
    },
  },
}
