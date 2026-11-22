import type { Fraction } from './fraction'

// Mirror of backend/app/answers.py for the mocks: the value of x the student gave.
// Accepts 3, 3.0, 3,0, x = 3, х = 3 (Cyrillic), 3 = x, 6/2, 1 200, −3. Exact, no floats.

const NUMBER = /^[+-]?[0-9]+(?:[.,][0-9]+)?$/
const RATIO = /^([+-]?[0-9]+)\s*\/\s*([+-]?[0-9]+)$/
const GROUPED = /^[+-]?[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]+)?$/
const X_LEFT = /^[xXхХ]\s*=\s*(.+)$/
const X_RIGHT = /^(.+?)\s*=\s*[xXхХ]$/

function literal(text: string): Fraction | null {
  if (GROUPED.test(text)) text = text.replace(/ /g, '')
  if (NUMBER.test(text)) {
    const [whole, fraction = ''] = text.replace(',', '.').split('.')
    const den = 10n ** BigInt(fraction.length)
    const sign = whole.startsWith('-') ? -1n : 1n
    const intPart = BigInt(whole.replace(/^[+-]/, ''))
    return { num: sign * (intPart * den + BigInt(fraction || '0')), den }
  }
  const ratio = RATIO.exec(text)
  if (ratio) {
    const den = BigInt(ratio[2])
    return den === 0n ? null : { num: BigInt(ratio[1]), den }
  }
  return null
}

export function parseEquationAnswer(answer: string): Fraction | null {
  const text = answer
    .normalize('NFKC')
    .replace(/[−–]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text.length > 40) return null
  const m = X_LEFT.exec(text) ?? X_RIGHT.exec(text)
  return literal(m ? m[1].trim() : text)
}
