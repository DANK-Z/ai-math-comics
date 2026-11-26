import type { Lang } from './api'
import gearArt from './assets/helpers/gear.webp'
import sphinxArt from './assets/helpers/sphinx.webp'

// Frames (around the hero card's picture) and titles (under the student's name) from the fair
// shop. Prices here only feed demo mode: on the server the catalog in backend/app/shop.py rules.

export type FrameKey = 'frame-sunny' | 'frame-steppe' | 'frame-space' | 'frame-gold'
export type TitleKey = 'title-explorer' | 'title-fractions' | 'title-equations' | 'title-fair-hero'
export type HelperKey = 'helper-gear' | 'helper-sphinx'
export type CosmeticKey = FrameKey | TitleKey | HelperKey

interface Cosmetic {
  slot: 'frame' | 'title' | 'helper'
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
  'helper-gear': {
    slot: 'helper', price: 80, icon: '⚙️',
    name: t('Гайка — робот-инженер', 'Гайка — инженер робот'),
    about: t('Медный робот на одном колесе. Подсказывает вместо Пифика и чинит любую задачу гаечным ключом.', 'Бір дөңгелекті мыс робот. Пификтің орнына кеңес береді, кез келген есепті кілтпен жөндейді.'),
  },
  'helper-sphinx': {
    slot: 'helper', price: 90, icon: '🐱',
    name: t('Кибер-Сфинкс — аналитик', 'Кибер-Сфинкс — талдаушы'),
    about: t('Неоновый робот-кот. Подсказывает вместо Пифика и видит ошибку раньше всех.', 'Неон робот-мысық. Пификтің орнына кеңес береді, қатені бәрінен бұрын көреді.'),
  },
  'title-fair-hero': {
    slot: 'title', price: 35, icon: '🎪',
    name: t('Герой ярмарки', 'Жәрмеңке батыры'),
    about: t('Почётное звание спасителя Школьной ярмарки.', 'Мектеп жәрмеңкесін құтқарушының құрметті атағы.'),
  },
}

export const isCosmetic = (key: string): key is CosmeticKey => key in COSMETICS

/** CSS class that draws a frame around a picture (see index.css). */
export const frameClass = (key: string | null | undefined) => (key && isCosmetic(key) && COSMETICS[key].slot === 'frame' ? `hero-${key}` : '')

/** Pictures of the helpers that can stand in for Pifik (cut out, transparent). */
export const HELPER_ART: Record<HelperKey, string> = {
  'helper-gear': gearArt,
  'helper-sphinx': sphinxArt,
}

export const isHelper = (key: string | null | undefined): key is HelperKey => !!key && key in HELPER_ART

/** The helper's short name for hint labels («Гайка: вспомни правило»). */
export const HELPER_NAME: Record<HelperKey, Record<Lang, string>> = {
  'helper-gear': { ru: 'Гайка', kk: 'Гайка' },
  'helper-sphinx': { ru: 'Кибер-Сфинкс', kk: 'Кибер-Сфинкс' },
}
