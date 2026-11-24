import { useSyncExternalStore } from 'react'
import { LIGHTS_PARK_ID } from './api/lightsChapters'
import { MARS_CRATER_ID } from './api/marsChapters'
import { MUSEUM_MIRROR_ID } from './api/museumChapters'
import { ROADS_BRIDGE_ID, ROADS_FLAG_ID, ROADS_HILL_ID, ROADS_RIVER_ID } from './api/roadsChapters'
import { WEATHER_FROST_ID } from './api/weatherChapters'
import type { Lang } from './api/types'

// Hidden secrets on the first panel of a chapter: a small twinkle on something in the
// picture. Spotting it makes Pifik pop out with a line, and a signed-in student gets coins
// once (the secret is reported as its own progress id; the server pays it once, see
// progressRewards.json). Every chapter of «Дороги ярмарки» has one, the other operations one
// in their first chapter.

type Text = Record<Lang, string>
const t = (ru: string, kk: string): Text => ({ ru, kk })

export interface PanelSecret {
  /** Progress id, also the reward key. */
  id: string
  comicId: string
  /** Panel number (1-based) the secret hides in. */
  panel: number
  /** Centre of the twinkle, in % of the picture. */
  x: number
  y: number
  /** What the hidden thing is, for screen readers once found. */
  name: Text
  /** Pifik's line when the secret is found. */
  line: Text
}

export const SECRET_COINS = 5

export const PANEL_SECRETS: readonly PanelSecret[] = [
  {
    id: 'secret-roads-flag', comicId: ROADS_FLAG_ID, panel: 1, x: 96, y: 74,
    name: t('рисунок велосипеда на мольберте', 'мольберттегі велосипед суреті'),
    line: t('Ого, чертёж велосипеда! Кто-то здесь готовит свою гонку. Зоркий глаз!', 'Мынау велосипедтің сызбасы ғой! Біреу өз жарысын дайындап жатыр. Көзің қырағы екен!'),
  },
  {
    id: 'secret-roads-bridge', comicId: ROADS_BRIDGE_ID, panel: 1, x: 95, y: 50,
    name: t('каменный мост вдалеке', 'алыстағы тас көпір'),
    line: t('Ты заметил мост раньше нас! Именно туда мы и едем.', 'Көпірді бізден бұрын байқадың! Біз дәл соған барамыз.'),
  },
  {
    id: 'secret-roads-river', comicId: ROADS_RIVER_ID, panel: 1, x: 12, y: 44,
    name: t('велосипеды на берегу', 'жағадағы велосипедтер'),
    line: t('Наши велосипеды ждут на берегу. Хорошо, что ты присмотришь за ними!', 'Велосипедтеріміз жағада күтіп тұр. Оларға көз салып жүргенің жақсы болды!'),
  },
  {
    id: 'secret-roads-hill', comicId: ROADS_HILL_ID, panel: 1, x: 6, y: 25,
    name: t('башня с золотым шаром', 'алтын шары бар мұнара'),
    line: t('С холма видно башню с золотым шаром! Вот это высота.', 'Төбеден алтын шары бар мұнара көрінеді! Міне, биіктік!'),
  },
  {
    id: 'secret-lights-park', comicId: LIGHTS_PARK_ID, panel: 1, x: 91, y: 9,
    name: t('надпись «Kokshetau» на сопке', 'төбедегі «Kokshetau» жазуы'),
    line: t('Это же сопка с надписью «Kokshetau»! Вечером её тоже подсветят.', 'Бұл «Kokshetau» жазуы бар төбе ғой! Кешке оны да жарықтандырады.'),
  },
  {
    id: 'secret-museum-mirror', comicId: MUSEUM_MIRROR_ID, panel: 1, x: 86, y: 19,
    name: t('золотая карта Казахстана', 'Қазақстанның алтын картасы'),
    line: t('Золотая карта Казахстана! Найдёшь на ней Кокшетау?', 'Қазақстанның алтын картасы! Онда Көкшетауды таба аласың ба?'),
  },
  {
    id: 'secret-weather-frost', comicId: WEATHER_FROST_ID, panel: 1, x: 93, y: 11,
    name: t('флюгер на метеостанции', 'метеостанциядағы желбағар'),
    line: t('Флюгер! Стрелка показывает, откуда дует ветер. Запишем в журнал.', 'Желбағар! Тілі желдің қайдан соғатынын көрсетеді. Журналға жазайық.'),
  },
  {
    id: 'secret-mars-crater', comicId: MARS_CRATER_ID, panel: 1, x: 5, y: 9,
    name: t('растение у окна станции', 'бекет терезесінің жанындағы өсімдік'),
    line: t('Растение на станции! Совсем как в марсианской теплице — пригодится потом.', 'Бекеттегі өсімдік! Марс жылыжайындағыдай — кейін керек болады.'),
  },
]

export function secretFor(comicId: string, panel: number): PanelSecret | undefined {
  return PANEL_SECRETS.find((s) => s.comicId === comicId && s.panel === panel)
}

const IDS = new Set(PANEL_SECRETS.map((s) => s.id))
const STORAGE_KEY = 'amc.secrets.found'

function read(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(saved)) return new Set(saved.filter((id): id is string => typeof id === 'string' && IDS.has(id)))
  } catch {
    // Unreadable storage: nothing found yet.
  }
  return new Set()
}

let found = read()
const listeners = new Set<() => void>()

function save(ids: readonly string[]) {
  const fresh = ids.filter((id) => IDS.has(id) && !found.has(id))
  if (fresh.length === 0) return false
  found = new Set([...found, ...fresh])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...found]))
  } catch {
    // Kept for this visit.
  }
  listeners.forEach((l) => l())
  return true
}

/** Marks a secret found; true the first time. */
export const findSecret = (id: string) => save([id])
/** Adds secrets a signed-in student found on another device. */
export const mergeSecrets = (ids: readonly string[]) => void save(ids)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFoundSecrets(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => found)
}

export const SECRET_COPY = {
  ru: {
    hint: 'Здесь что-то спрятано',
    found: (name: string) => `Секрет найден: ${name}`,
    coins: `+${SECRET_COINS} монет за зоркий глаз`,
    guest: 'Войди как ученик, чтобы получать монеты за секреты.',
    close: 'Закрыть',
  },
  kk: {
    hint: 'Мұнда бірдеңе жасырылған',
    found: (name: string) => `Құпия табылды: ${name}`,
    coins: `Қырағы көз үшін +${SECRET_COINS} тиын`,
    guest: 'Құпиялар үшін тиын алу үшін оқушы ретінде кір.',
    close: 'Жабу',
  },
}
