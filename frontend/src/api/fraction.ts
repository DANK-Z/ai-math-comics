// Exact fraction parsing for the mock checker (the real check happens on the backend).
// Accepts "a/b" or an integer "a", with optional whitespace and sign. Zero denominator → null.
export interface Fraction {
  num: bigint
  den: bigint
}

const FRACTION_RE = /^\s*([+-]?\d+)\s*(?:\/\s*([+-]?\d+)\s*)?$/

export function parseFraction(input: string): Fraction | null {
  const m = FRACTION_RE.exec(input)
  if (!m) return null
  const num = BigInt(m[1])
  const den = m[2] === undefined ? 1n : BigInt(m[2])
  if (den === 0n) return null
  return { num, den }
}

export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  return a.num * b.den === b.num * a.den
}
