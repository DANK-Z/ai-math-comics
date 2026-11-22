import type { CheckStatus, Lang } from './api/types'
import type { UiStrings } from './i18n'
import { LEMONADE_COMIC_ID, LIBRARY_BOXES_COMIC_ID, SCHOOL_STORE_COMIC_ID } from './route'

export const BONUS_STICKER_IDS = ['price-tag', 'library-bookmark', 'lemon-slice'] as const
export type BonusSticker = (typeof BONUS_STICKER_IDS)[number]

const CHAPTER_PUZZLES: Readonly<Record<string, BonusSticker>> = {
  [SCHOOL_STORE_COMIC_ID]: 'price-tag',
  [LIBRARY_BOXES_COMIC_ID]: 'library-bookmark',
  [LEMONADE_COMIC_ID]: 'lemon-slice',
}

export function chapterBonus(comicId: string): BonusSticker | undefined {
  return CHAPTER_PUZZLES[comicId]
}

interface PuzzleCopy {
  inspect: string
  title: string
  prompt: string
  hint: string
  feedback: Record<CheckStatus, string>
  explanation: string
  sticker: string
  reward: string
}

const PUZZLES = {
  'library-bookmark': {
    answer: 12,
    icon: '🔖',
    ru: {
      inspect: 'Проверить закладку',
      title: 'Книги для стендов',
      prompt: 'В коробках было 24 книги. Половину отнесли на стенд ярмарки. Сколько книг осталось в коробках? Запиши число.',
      hint: 'Раздели книги на две равные группы. Одна группа уходит на стенд.',
      feedback: { correct: 'Верно!', incorrect: 'Пока не так. Найди половину от всех книг в коробках.', invalid: 'Запиши число книг без слов.' },
      explanation: '24 : 2 = 12 книг осталось в коробках.',
      sticker: 'Библиотечная закладка',
      reward: 'Получена наклейка «Библиотечная закладка»!',
    },
    kk: {
      inspect: 'Бетбелгіні тексеру',
      title: 'Сөреге арналған кітаптар',
      prompt: 'Қораптарда 24 кітап болды. Жартысын жәрмеңке сөресіне апарды. Қораптарда неше кітап қалды? Жауапты санмен жаз.',
      hint: 'Кітаптарды тең екі топқа бөл. Бір тобын сөреге апарды.',
      feedback: { correct: 'Дұрыс!', incorrect: 'Әзірге дұрыс емес. Қораптардағы барлық кітаптың жартысын тап.', invalid: 'Кітап санын сөзсіз жаз.' },
      explanation: '24 : 2 = 12 кітап қораптарда қалды.',
      sticker: 'Кітапхана бетбелгісі',
      reward: '«Кітапхана бетбелгісі» жапсырмасын алдың!',
    },
  },
  'lemon-slice': {
    answer: 750,
    icon: '🍋',
    ru: {
      inspect: 'Заглянуть в рецепт',
      title: 'Лимонад для пяти гостей',
      prompt: 'На один стакан нужно 150 мл воды. Сколько миллилитров нужно, чтобы угостить ещё пять гостей? Запиши число.',
      hint: 'Для каждого гостя нужен один стакан. Возьми по 150 мл на каждый стакан.',
      feedback: { correct: 'Верно!', incorrect: 'Пока не так. Учти все пять стаканов.', invalid: 'Запиши число миллилитров без единиц измерения.' },
      explanation: '150 × 5 = 750 мл воды.',
      sticker: 'Лимонная долька',
      reward: 'Получена наклейка «Лимонная долька»!',
    },
    kk: {
      inspect: 'Рецептті қарап шығу',
      title: 'Бес қонаққа арналған лимонад',
      prompt: 'Бір стақанға 150 мл су керек. Тағы бес қонаққа лимонад беру үшін неше миллилитр су қажет? Жауапты санмен жаз.',
      hint: 'Әр қонаққа бір стақан керек. Әр стақанға 150 мл су ал.',
      feedback: { correct: 'Дұрыс!', incorrect: 'Әзірге дұрыс емес. Бес стақанның бәрін есепке ал.', invalid: 'Миллилитр санын өлшем бірлігінсіз жаз.' },
      explanation: '150 × 5 = 750 мл су.',
      sticker: 'Лимон тілімі',
      reward: '«Лимон тілімі» жапсырмасын алдың!',
    },
  },
} satisfies Record<Exclude<BonusSticker, 'price-tag'>, { answer: number; icon: string } & Record<Lang, PuzzleCopy>>

export function bonusPuzzle(id: BonusSticker, lang: Lang, t: UiStrings) {
  if (id === 'price-tag') return { answer: 600, icon: '🏷️', copy: t.priceTagBonus }
  const puzzle = PUZZLES[id]
  return { answer: puzzle.answer, icon: puzzle.icon, copy: puzzle[lang] }
}
