import type { CastHeroId, Lang, StoryOptions, StorySetting, StoryStyle } from './api/types'
import danaPortrait from './assets/portraits/dana.webp'
import timurPortrait from './assets/portraits/timur.webp'

// «Моя история»: form state, client-side validation (mirrors backend StoryOptions) and copy.

export const STORY_LIMITS = { heroName: 24, heroDescription: 80, customSetting: 60, premise: 280, customHeroes: 2 } as const
export const CAST_ORDER: readonly CastHeroId[] = ['pifik', 'aldiyar', 'aruna', 'timur', 'dana']
/** Pifik and at most two friends (the server takes three cast heroes). */
export const MAX_FRIENDS = 2

/** Heroes that exist only in «Моя история» (not in the bundled stories). */
export const EXTRA_HEROES: Record<'timur' | 'dana', { portrait: string; name: Record<Lang, string>; role: Record<Lang, string> }> = {
  timur: { portrait: timurPortrait, name: { ru: 'Тимур', kk: 'Тимур' }, role: { ru: 'детектив', kk: 'детектив' } },
  dana: { portrait: danaPortrait, name: { ru: 'Дана', kk: 'Дана' }, role: { ru: 'космобиолог', kk: 'ғарыш биологы' } },
}
export const isExtraHero = (hero: CastHeroId): hero is 'timur' | 'dana' => hero in EXTRA_HEROES
export const STORY_STYLES: readonly StoryStyle[] = ['comic', 'cartoon', 'pixel']
export const STORY_SETTINGS: readonly StorySetting[] = ['school', 'space', 'forest', 'custom']
export const SETTING_ICON: Record<StorySetting, string> = { school: '🏫', space: '🚀', forest: '🌲', custom: '✏️' }

export interface StoryDraft {
  heroes: CastHeroId[]
  customHeroes: { name: string; description: string }[]
  style: StoryStyle
  setting: StorySetting
  customSetting: string
  premise: string
}

export const DEFAULT_STORY: StoryDraft = {
  heroes: ['pifik', 'aldiyar', 'aruna'],
  customHeroes: [],
  style: 'comic',
  setting: 'school',
  customSetting: '',
  premise: '',
}

export function draftFrom(options: StoryOptions | undefined): StoryDraft {
  if (!options) return DEFAULT_STORY
  return {
    heroes: options.heroes,
    customHeroes: options.customHeroes.map((h) => ({ name: h.name, description: h.description ?? '' })),
    style: options.style,
    setting: options.setting,
    customSetting: options.customSetting ?? '',
    premise: options.premise ?? '',
  }
}

export type StoryError = 'chars' | 'required' | 'duplicate'
export type StoryErrors = Partial<Record<string, StoryError>>

const ALLOWED = /^[\p{L}\p{M}\s.,!?'"«»()\-—–:;]*$/u
const LINK = /https?|www\.|\.(?:com|ru|kz|org|net)\b/i
const RESERVED = new Set(['пифик', 'аруна', 'алдияр', 'тимур', 'дана', 'pifik', 'aruna', 'aldiyar', 'timur', 'dana'])

/** Same normalization as the server: NFKC and collapsed spaces. */
export function cleanText(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function textError(value: string): StoryError | undefined {
  if (/\p{N}/u.test(value) || !ALLOWED.test(value) || LINK.test(value)) return 'chars'
  return undefined
}

/** Field keys: hero-0-name, hero-0-description, customSetting, premise. */
export function validateStory(draft: StoryDraft): { errors: StoryErrors; options: StoryOptions | null } {
  const errors: StoryErrors = {}
  const names = new Set<string>()
  const customHeroes = draft.customHeroes.map((hero, i) => {
    const name = cleanText(hero.name)
    const description = cleanText(hero.description)
    if (!/\p{L}/u.test(name)) errors[`hero-${i}-name`] = 'required'
    else if (textError(name)) errors[`hero-${i}-name`] = 'chars'
    else if (names.has(name.toLocaleLowerCase()) || RESERVED.has(name.toLocaleLowerCase())) errors[`hero-${i}-name`] = 'duplicate'
    names.add(name.toLocaleLowerCase())
    if (textError(description)) errors[`hero-${i}-description`] = 'chars'
    return { name, description }
  })
  const customSetting = cleanText(draft.customSetting)
  if (draft.setting === 'custom') {
    if (!customSetting) errors.customSetting = 'required'
    else if (textError(customSetting)) errors.customSetting = 'chars'
  }
  const premise = cleanText(draft.premise)
  if (textError(premise)) errors.premise = 'chars'
  if (Object.keys(errors).length) return { errors, options: null }
  return {
    errors,
    options: {
      heroes: CAST_ORDER.filter((h) => draft.heroes.includes(h)),
      customHeroes,
      style: draft.style,
      setting: draft.setting,
      customSetting: draft.setting === 'custom' ? customSetting : null,
      premise: premise || null,
    },
  }
}

export const STORY_COPY: Record<
  Lang,
  {
    modeLabel: string
    modes: { express: string; story: string }
    lead: string
    heroesTitle: string
    pifikAlways: string
    addHero: string
    heroN: (n: number) => string
    heroName: string
    heroNamePlaceholder: string
    heroDescription: string
    heroDescriptionPlaceholder: string
    removeHero: string
    heroLimit: string
    customHeroNote: string
    liveHeroNote: string
    styleTitle: string
    styles: Record<StoryStyle, string>
    preparedStyleNote: string
    settingTitle: string
    settings: Record<StorySetting, string>
    customSettingLabel: string
    customSettingPlaceholder: string
    premiseTitle: string
    premisePlaceholder: string
    premiseNote: string
    mathTitle: string
    errors: Record<StoryError, string>
    fixErrors: string
  }
> = {
  ru: {
    modeLabel: 'Режим',
    modes: { express: 'Математический экспресс', story: 'Моя история' },
    lead: 'Придумай героев, стиль, место и начало истории — Пифик встроит в неё задачу.',
    heroesTitle: 'Герои',
    pifikAlways: 'Пифик всегда рядом: он задаёт задачу и подсказывает. С ним можно взять двух друзей.',
    addHero: 'Добавить своего героя',
    heroN: (n) => `Свой герой ${n}`,
    heroName: 'Имя',
    heroNamePlaceholder: 'например, Робот Шестерёнка',
    heroDescription: 'Как герой выглядит?',
    heroDescriptionPlaceholder: 'например, медный робот с зелёными глазами',
    removeHero: 'Убрать героя',
    heroLimit: 'Можно добавить до двух своих героев.',
    customHeroNote: 'Свои герои говорят в репликах, а на картинках их пока заменяет заставка.',
    liveHeroNote: 'После проверки текста Пифик создаст образ героя и использует его во всех кадрах.',
    styleTitle: 'Стиль комикса',
    styles: { comic: 'Яркий комикс', cartoon: 'Мультфильм', pixel: 'Пиксель-арт' },
    preparedStyleNote: 'Сейчас включены готовые иллюстрации: стиль применится, когда включат живую графику.',
    settingTitle: 'Место действия',
    settings: { school: 'Школа', space: 'Космическая станция', forest: 'Волшебный лес', custom: 'Своё место' },
    customSettingLabel: 'Где разворачиваются события?',
    customSettingPlaceholder: 'например: на дне океана, в заброшенном замке',
    premiseTitle: 'Завязка сюжета',
    premisePlaceholder: 'Пример: герои нашли на чердаке старую карту сокровищ, но её закрыл волшебный замок…',
    premiseNote: 'Можно оставить пустым — тогда Пифик придумает начало сам!',
    mathTitle: 'Математическое ядро',
    errors: {
      chars: 'Только буквы, пробелы и знаки препинания — без цифр, формул и ссылок.',
      required: 'Заполни это поле.',
      duplicate: 'Имена героев должны быть разными и не совпадать с Алдияром, Аруной или Пификом.',
    },
    fixErrors: 'Проверь отмеченные поля.',
  },
  kk: {
    modeLabel: 'Режим',
    modes: { express: 'Математикалық экспресс', story: 'Менің оқиғам' },
    lead: 'Кейіпкерлерді, стильді, орынды және оқиғаның басын ойлап тап — Пифик оған есеп қосады.',
    heroesTitle: 'Кейіпкерлер',
    pifikAlways: 'Пифик әрқашан бірге: ол есеп береді және кеңес айтады. Онымен бірге екі досты алуға болады.',
    addHero: 'Өз кейіпкеріңді қосу',
    heroN: (n) => `Өз кейіпкерім ${n}`,
    heroName: 'Аты',
    heroNamePlaceholder: 'мысалы, Тетік атты робот',
    heroDescription: 'Кейіпкер қалай көрінеді?',
    heroDescriptionPlaceholder: 'мысалы, жасыл көзді мыс робот',
    removeHero: 'Кейіпкерді алып тастау',
    heroLimit: 'Екі кейіпкерге дейін қосуға болады.',
    customHeroNote: 'Өз кейіпкерлерің сөйлейді, ал суреттерде әзірге олардың орнына заставка тұрады.',
    liveHeroNote: 'Мәтінді тексергеннен кейін Пифик кейіпкердің бейнесін жасап, оны барлық кадрда қолданады.',
    styleTitle: 'Комикс стилі',
    styles: { comic: 'Жарқын комикс', cartoon: 'Мультфильм', pixel: 'Пиксель-арт' },
    preparedStyleNote: 'Қазір дайын иллюстрациялар қосулы: стиль тірі графика қосылғанда қолданылады.',
    settingTitle: 'Оқиға орны',
    settings: { school: 'Мектеп', space: 'Ғарыш станциясы', forest: 'Сиқырлы орман', custom: 'Өз орным' },
    customSettingLabel: 'Оқиға қай жерде өтеді?',
    customSettingPlaceholder: 'мысалы: мұхит түбінде, ескі қамалда',
    premiseTitle: 'Оқиғаның басы',
    premisePlaceholder: 'Мысалы: кейіпкерлер шатырдан ескі қазына картасын тапты, бірақ оны сиқырлы құлып жауып тастады…',
    premiseNote: 'Бос қалдыруға болады — сонда Пифик басын өзі ойлап табады!',
    mathTitle: 'Математикалық өзек',
    errors: {
      chars: 'Тек әріптер, бос орындар мен тыныс белгілері — сандарсыз, формуласыз және сілтемесіз.',
      required: 'Бұл өрісті толтыр.',
      duplicate: 'Кейіпкерлердің аттары әртүрлі болуы және Алдияр, Аруна, Пифик аттарымен сәйкес келмеуі керек.',
    },
    fixErrors: 'Белгіленген өрістерді тексер.',
  },
}
