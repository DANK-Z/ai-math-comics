import type { Lang } from './api'

// Browsers often ship without Kazakh month names (kk-KZ renders "M11 24"), so Kazakh dates
// are spelled out here; Russian uses the browser's own locale data.
const KK_MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']

/** "24 ноября" / "24 қараша". */
export function dayMonth(value: Date, lang: Lang): string {
  if (lang === 'kk') return `${value.getDate()} ${KK_MONTHS[value.getMonth()]}`
  return value.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
