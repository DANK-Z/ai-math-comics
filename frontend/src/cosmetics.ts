import type { Lang } from './api'

// Frames (around the hero card's picture) and titles (under the student's name) from the fair
// shop. Prices here only feed demo mode: on the server the catalog in backend/app/shop.py rules.

export type FrameKey = 'frame-sunny' | 'frame-steppe' | 'frame-space' | 'frame-gold'
export type TitleKey = 'title-explorer' | 'title-fractions' | 'title-equations' | 'title-fair-hero'
export type CosmeticKey = FrameKey | TitleKey

interface Cosmetic {
  slot: 'frame' | 'title'
  price: number
  icon: string
  name: Record<Lang, string>
  about: Record<Lang, string>
}

const t = (ru: string, kk: string): Record<Lang, string> => ({ ru, kk })

export const COSMETICS: Record<CosmeticKey, Cosmetic> = {
  'frame-sunny': {
    slot: 'frame', price: 30, icon: '☀️',
    name: t('Солнечная рамка', 'Күн жиегі'),
    about: t('Тёплое жёлтое сияние вокруг героя.', 'Кейіпкердің айналасындағы жылы сары жарқыл.'),
  },
  'frame-steppe': {
    slot: 'frame', price: 45, icon: '🌾',
    name: t('Степной орнамент', 'Дала өрнегі'),
    about: t('Узор цвета степи и неба — как на ярмарочном шатре.', 'Дала мен аспан түсті өрнек — жәрмеңке шатырындағыдай.'),
  },
  'frame-space': {
    slot: 'frame', price: 45, icon: '🚀',
    name: t('Космическая рамка', 'Ғарыш жиегі'),
    about: t('Фиолетовый космос со звёздами — для тех, кто решает с запасом.', 'Жұлдызды күлгін ғарыш — есепті артығымен шығаратындарға.'),
  },
  'frame-gold': {
    slot: 'frame', price: 80, icon: '🏆',
    name: t('Золотая рамка', 'Алтын жиек'),
    about: t('Рамка чемпиона: видна издалека.', 'Чемпион жиегі: алыстан көрінеді.'),
  },
  'title-explorer': {
    slot: 'title', price: 20, icon: '🧭',
    name: t('Исследователь', 'Зерттеуші'),
    about: t('Звание под именем на главной и в профиле.', 'Басты бет пен профильдегі есім астындағы атақ.'),
  },
  'title-fractions': {
    slot: 'title', price: 25, icon: '🍕',
    name: t('Мастер дробей', 'Бөлшек шебері'),
    about: t('Для тех, кто делит пиццу поровну с первого раза.', 'Пиццаны бірден тең бөлетіндерге.'),
  },
  'title-equations': {
    slot: 'title', price: 25, icon: '⚖️',
    name: t('Укротитель уравнений', 'Теңдеу жеңімпазы'),
    about: t('x больше не спрячется.', 'x енді жасырына алмайды.'),
  },
  'title-fair-hero': {
    slot: 'title', price: 35, icon: '🎪',
    name: t('Герой ярмарки', 'Жәрмеңке батыры'),
    about: t('Почётное звание спасителя Школьной ярмарки.', 'Мектеп жәрмеңкесін құтқарушының құрметті атағы.'),
  },
}

export const isCosmetic = (key: string): key is CosmeticKey => key in COSMETICS

/** CSS class that draws a frame around a picture (see index.css). */
export const frameClass = (key: string | null | undefined) => (key && isCosmetic(key) ? `hero-${key}` : '')
