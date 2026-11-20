import type { Lang } from './api/types'
import type { CharacterId } from './characters'
import {
  DEMO_COMIC_ID,
  GARLAND_COMIC_ID,
  LEMONADE_COMIC_ID,
  LIBRARY_BOXES_COMIC_ID,
  SCHOOL_MAP_COMIC_ID,
  SCHOOL_STORE_COMIC_ID,
} from './route'

interface Chapter {
  number: number
  /** Who speaks the transition line under the ending panel. */
  speaker: CharacterId
  ending: Record<Lang, string>
  /** Next chapter; the last chapter leads back to the catalog. */
  nextComicId?: string
}

// “Operation: School Fair”: six chapters, each with its own URL. The transition line
// appears under the real ending panel once the chapter's exercise is solved.
const chapters: Partial<Record<string, Chapter>> = {
  [DEMO_COMIC_ID]: {
    number: 1,
    speaker: 'aruna',
    ending: {
      ru: 'С пиццей разобрались! Теперь в школьный магазин — для ярмарки нужен рюкзак.',
      kk: 'Пиццаны бөліп алдық! Енді мектеп дүкеніне — жәрмеңкеге сөмке керек.',
    },
    nextComicId: SCHOOL_STORE_COMIC_ID,
  },
  [SCHOOL_STORE_COMIC_ID]: {
    number: 2,
    speaker: 'pifik',
    ending: {
      ru: 'Рюкзак есть, а в нём — карта ярмарки. Пора проверить маршрут!',
      kk: 'Сөмке бар, ал ішінде — жәрмеңке картасы. Енді бағытты тексерейік!',
    },
    nextComicId: SCHOOL_MAP_COMIC_ID,
  },
  [SCHOOL_MAP_COMIC_ID]: {
    number: 3,
    speaker: 'pifik',
    ending: {
      ru: 'В конверте подсказка: «Следующая станция — библиотека». Вперёд!',
      kk: 'Конвертте кеңес бар: «Келесі бекет — кітапхана». Алға!',
    },
    nextComicId: LIBRARY_BOXES_COMIC_ID,
  },
  [LIBRARY_BOXES_COMIC_ID]: {
    number: 4,
    speaker: 'aruna',
    ending: {
      ru: 'Упакуем книги как призы — и к лимонадному киоску!',
      kk: 'Кітаптарды сыйлыққа орап, лимонад дүңгіршегіне барайық!',
    },
    nextComicId: LEMONADE_COMIC_ID,
  },
  [LEMONADE_COMIC_ID]: {
    number: 5,
    speaker: 'aldiyar',
    ending: {
      ru: 'Лимонад разлит. Теперь украсим финишный стенд!',
      kk: 'Лимонад құйылды. Енді мәре стендін безендірейік!',
    },
    nextComicId: GARLAND_COMIC_ID,
  },
  [GARLAND_COMIC_ID]: {
    number: 6,
    speaker: 'pifik',
    ending: {
      ru: 'Книги-призы и лимонад уже ждут гостей. Ярмарка удалась — спасибо за помощь!',
      kk: 'Сыйлық кітаптар мен лимонад қонақтарды күтіп тұр. Жәрмеңке сәтті өтті — көмегің үшін рахмет!',
    },
  },
}

export const SCHOOL_FAIR_CHAPTER_COUNT = Object.keys(chapters).length

export function schoolFairChapter(comicId: string): Chapter | undefined {
  return Object.hasOwn(chapters, comicId) ? chapters[comicId] : undefined
}
