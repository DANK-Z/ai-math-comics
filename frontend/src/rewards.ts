import { ROADS_FLAG_ID } from './api/roadsChapters'
import type { Lang } from './api/types'
import { PANEL_SECRETS, SECRET_COINS } from './panelSecrets'
import { operationHref } from './operations'
import type { SchoolFairCollectible } from './schoolFair'

// Backpack and coin rewards for operation progress. «Дороги ярмарки» is the pilot:
// – each chapter pays 5 coins and its finale 10, once (the server owns the balance and
//   pays each reward once; see PROGRESS_REWARDS in backend/app/accounts.py);
// – «Флажок на колёсах» unlocks the Yellow Flag (a find), the finale the Road Guardian Medal
//   (a trophy). Finds and trophies also work for guests, from this browser's progress.

/** Progress id the client reports when the «Дороги ярмарки» finale is won. */
export const ROADS_FINALE_ID = 'roads-finale'

/** Coins paid once for the first completion. Keep in sync with the server. */
export const PROGRESS_REWARDS: Readonly<Record<string, number>> = {
  'roads-flag': 5,
  'roads-bridge': 5,
  'roads-river': 5,
  'roads-hill': 5,
  [ROADS_FINALE_ID]: 10,
  ...Object.fromEntries(PANEL_SECRETS.map((s) => [s.id, SECRET_COINS])),
}

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
  id: 'road-guardian-medal'
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
