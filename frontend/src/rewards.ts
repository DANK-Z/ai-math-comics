import { ROADS_FLAG_ID } from './api/roadsChapters'
import type { Lang } from './api/types'
import { operationHref } from './operations'
import type { SchoolFairCollectible } from './schoolFair'

import rewardsFile from './progressRewards.json'

// Backpack and coin rewards for progress in every season:
// – each chapter and panel secret pays 5 coins and each finale 10, once (the server owns the
//   balance and pays each reward once; the list lives in progressRewards.json, shared with
//   backend/app/accounts.py);
// – every finale unlocks a trophy, «Флажок на колёсах» also the Yellow Flag (a find). Finds and
//   trophies also work for guests, from this browser's progress.

/** Progress id the client reports when the «Дороги ярмарки» finale is won. */
export const ROADS_FINALE_ID = 'roads-finale'
/** Progress id of the School Fair finale (the Fair Keeper). */
export const FAIR_FINALE_ID = 'fair-finale'
/** Progress id of an operation's finale. */
export const finaleProgressId = (operationId: string) => `${operationId}-finale`

/** Coins paid once for the first completion (shared with the server). */
export const PROGRESS_REWARDS: Readonly<Record<string, number>> = rewardsFile.rewards

type Text = Record<Lang, string>
const t = (ru: string, kk: string): Text => ({ ru, kk })

export interface OperationFind {
  id: 'yellow-flag'
  icon: string
  /** The chapter that unlocks the find; its card links back to it. */
  comicId: string
  chapter: Text
  name: Text
  story: Text
}

export const OPERATION_FINDS: readonly OperationFind[] = [
  {
    id: 'yellow-flag',
    icon: '🚩',
    comicId: ROADS_FLAG_ID,
    chapter: t('«Флажок на колёсах» · Дороги ярмарки', '«Дөңгелектегі жалауша» · Жәрмеңке жолдары'),
    name: t('Жёлтый флажок', 'Сары жалауша'),
    story: t(
      'Флажок для отметки маршрута. Алдияр отдал его Аруне, когда она догнала его на контрольной точке.',
      'Бағытты белгілейтін жалауша. Аруна Алдиярды бақылау нүктесінде қуып жеткенде, ол жалаушаны соған берді.',
    ),
  },
]

export interface Trophy {
  id: string
  icon: string
  /** Progress id that unlocks the trophy. */
  unlockedBy: string
  href: string
  name: Text
  earned: Text
  howTo: Text
}

export const TROPHIES: readonly Trophy[] = [
  {
    id: 'fair-keeper-cup',
    icon: '🏆',
    unlockedBy: FAIR_FINALE_ID,
    href: '#/guardian',
    name: t('Кубок Стража ярмарки', 'Жәрмеңке Сақшысының кубогы'),
    earned: t('Все три фонаря на арке горят — Страж ярмарки вручил кубок.', 'Арканың үш шамы да жанып тұр — Жәрмеңке Сақшысы кубок берді.'),
    howTo: t('Пройди все главы «Школьной ярмарки» и зажги три фонаря в финальном испытании.', '«Мектеп жәрмеңкесінің» барлық тарауынан өтіп, финалдық сынақта үш шамды жақ.'),
  },
  {
    id: 'road-guardian-medal',
    icon: '🏅',
    unlockedBy: ROADS_FINALE_ID,
    href: operationHref('roads'),
    name: t('Медаль Хранителя Дорог', 'Жолдар Сақшысының медалі'),
    earned: t(
      'Все три замка открыты — Хранитель Дорог вручил медаль за погоню, встречу и реку.',
      'Үш құлып та ашылды — Жолдар Сақшысы қуу, кездесу және өзен үшін медаль берді.',
    ),
    howTo: t(
      'Пройди все главы «Дорог ярмарки» и открой три замка в финале «Три замка Хранителя».',
      '«Жәрмеңке жолдарының» барлық тарауынан өтіп, «Сақшының үш құлпы» финалында үш құлыпты аш.',
    ),
  },
  {
    id: 'kokshetau-lantern',
    icon: '🏮',
    unlockedBy: finaleProgressId('lights'),
    href: operationHref('lights'),
    name: t('Фонарь Кокшетау', 'Көкшетау шамы'),
    earned: t('Мозаика огней собрана — город сияет к празднику.', 'Шамдар мозаикасы құрастырылды — қала мерекеге жарқырап тұр.'),
    howTo: t('Пройди «Огни Кокшетау» и собери мозаику огней в финале.', '«Көкшетау шамдарынан» өтіп, финалда шамдар мозаикасын құрастыр.'),
  },
  {
    id: 'museum-key',
    icon: '🗝️',
    unlockedBy: finaleProgressId('museum'),
    href: operationHref('museum'),
    name: t('Ключ от тайного зала', 'Құпия залдың кілті'),
    earned: t('Тайный зал музея открыт — ключ остаётся у тебя.', 'Мұражайдың құпия залы ашылды — кілт сенде қалады.'),
    howTo: t('Пройди «Музей после закрытия» и открой тайный зал в финале.', '«Жабылғаннан кейінгі мұражайдан» өтіп, финалда құпия залды аш.'),
  },
  {
    id: 'weather-vane',
    icon: '🌦️',
    unlockedBy: finaleProgressId('weather'),
    href: operationHref('weather'),
    name: t('Флюгер синоптика', 'Синоптиктің желбағары'),
    earned: t('Прогноз сбылся: сцену поставили там, где не было дождя.', 'Болжам дәл келді: сахна жаңбыр жоқ жерге қойылды.'),
    howTo: t('Пройди «Погоду на завтра» и выбери место для сцены в финале.', '«Ертеңгі ауа райынан» өтіп, финалда сахнаға орын таңда.'),
  },
  {
    id: 'mars-patch',
    icon: '🚀',
    unlockedBy: finaleProgressId('mars'),
    href: operationHref('mars'),
    name: t('Нашивка марсианской станции', 'Марс бекетінің белгісі'),
    earned: t('Стыковка вслепую удалась — экипаж принял тебя в команду.', 'Соқыр түйісу сәтті болды — экипаж сені командаға қабылдады.'),
    howTo: t('Пройди «Марс на перемене» и проведи стыковку в финале.', '«Үзілістегі Марстан» өтіп, финалда түйісуді жүргіз.'),
  },
]

/** Reward notes under a chapter ending and on the finale's victory screen. */
export const REWARD_COPY = {
  ru: {
    find: (name: string) => `Находка: «${name}» — теперь в рюкзаке.`,
    trophy: (name: string) => `Трофей: «${name}» — теперь в рюкзаке.`,
    coins: (n: number) => `+${n} монет за первое прохождение`,
    guest: 'Войди как ученик, чтобы получать монеты за первые прохождения.',
    backpack: 'Открыть рюкзак',
  },
  kk: {
    find: (name: string) => `Олжа: «${name}» — енді рюкзакта.`,
    trophy: (name: string) => `Жүлде: «${name}» — енді рюкзакта.`,
    coins: (n: number) => `Алғаш өткені үшін +${n} тиын`,
    guest: 'Алғаш өткені үшін тиын алу үшін оқушы ретінде кір.',
    backpack: 'Рюкзакты ашу',
  },
}

export function findForChapter(comicId: string): OperationFind | undefined {
  return OPERATION_FINDS.find((find) => find.comicId === comicId)
}

export type FindId = SchoolFairCollectible | OperationFind['id']

// A small log of when each find was first unlocked, for “the most recent find”.
const LOG_KEY = 'amc.finds.log'

export function readFindsLog(): { id: FindId; at: number }[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')
    if (Array.isArray(saved)) {
      return saved.filter((e): e is { id: FindId; at: number } => !!e && typeof e.id === 'string' && typeof e.at === 'number')
    }
  } catch {
    // A missing or broken log only hides “the most recent find”.
  }
  return []
}

/** Records a find the first time it is unlocked. */
export function logFind(id: FindId) {
  const log = readFindsLog()
  if (log.some((e) => e.id === id)) return
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([...log, { id, at: Date.now() }]))
  } catch {
    // Storage unavailable: the backpack falls back to story order.
  }
}
