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

export type SchoolFairLocation = 'cafeteria' | 'store' | 'schoolyard' | 'library' | 'lemonade' | 'finish'
export type SchoolFairCollectible =
  | 'pizza-token'
  | 'yellow-backpack'
  | 'clue-envelope'
  | 'prize-book'
  | 'lemonade-recipe'
  | 'festival-garland'

interface Chapter {
  number: number
  location: SchoolFairLocation
  collectible: SchoolFairCollectible
  /** Who speaks the transition line under the ending panel. */
  speaker: CharacterId
  ending: Record<Lang, string>
  /** Next chapter; the last chapter leads back to the catalog. */
  nextComicId?: string
}

// “Operation: School Fair”: six chapters, each with its own URL. The transition line
// appears under the real ending panel once the chapter's exercise is solved.
const chapters: Record<string, Chapter> = {
  [DEMO_COMIC_ID]: {
    number: 1,
    location: 'cafeteria',
    collectible: 'pizza-token',
    speaker: 'aruna',
    ending: {
      ru: 'С пиццей разобрались! Теперь в школьный магазин — для ярмарки нужен рюкзак.',
      kk: 'Пиццаны бөліп алдық! Енді мектеп дүкеніне — жәрмеңкеге сөмке керек.',
    },
    nextComicId: SCHOOL_STORE_COMIC_ID,
  },
  [SCHOOL_STORE_COMIC_ID]: {
    number: 2,
    location: 'store',
    collectible: 'yellow-backpack',
    speaker: 'pifik',
    ending: {
      ru: 'Рюкзак есть, а в нём — карта ярмарки. Пора проверить маршрут!',
      kk: 'Сөмке бар, ал ішінде — жәрмеңке картасы. Енді бағытты тексерейік!',
    },
    nextComicId: SCHOOL_MAP_COMIC_ID,
  },
  [SCHOOL_MAP_COMIC_ID]: {
    number: 3,
    location: 'schoolyard',
    collectible: 'clue-envelope',
    speaker: 'pifik',
    ending: {
      ru: 'В конверте подсказка: «Следующая станция — библиотека». Вперёд!',
      kk: 'Конвертте кеңес бар: «Келесі бекет — кітапхана». Алға!',
    },
    nextComicId: LIBRARY_BOXES_COMIC_ID,
  },
  [LIBRARY_BOXES_COMIC_ID]: {
    number: 4,
    location: 'library',
    collectible: 'prize-book',
    speaker: 'aruna',
    ending: {
      ru: 'Упакуем книги как призы — и к лимонадному киоску!',
      kk: 'Кітаптарды сыйлыққа орап, лимонад дүңгіршегіне барайық!',
    },
    nextComicId: LEMONADE_COMIC_ID,
  },
  [LEMONADE_COMIC_ID]: {
    number: 5,
    location: 'lemonade',
    collectible: 'lemonade-recipe',
    speaker: 'aldiyar',
    ending: {
      ru: 'Лимонад разлит. Теперь украсим финишный стенд!',
      kk: 'Лимонад құйылды. Енді мәре стендін безендірейік!',
    },
    nextComicId: GARLAND_COMIC_ID,
  },
  [GARLAND_COMIC_ID]: {
    number: 6,
    location: 'finish',
    collectible: 'festival-garland',
    speaker: 'pifik',
    ending: {
      ru: 'Книги-призы и лимонад уже ждут гостей. Ярмарка удалась — спасибо за помощь!',
      kk: 'Сыйлық кітаптар мен лимонад қонақтарды күтіп тұр. Жәрмеңке сәтті өтті — көмегің үшін рахмет!',
    },
  },
}

export const SCHOOL_FAIR_STOPS = Object.entries(chapters)
  .map(([comicId, { number, location, collectible }]) => ({ comicId, number, location, collectible }))
  .sort((a, b) => a.number - b.number)

export const SCHOOL_FAIR_CHAPTER_COUNT = SCHOOL_FAIR_STOPS.length

export function schoolFairChapter(comicId: string): Chapter | undefined {
  return Object.hasOwn(chapters, comicId) ? chapters[comicId] : undefined
}
