import { Fragment, type ReactNode } from 'react'

const FRACTION = /(\d+)\s*\/\s*(\d+)/g

/** Stacked fraction, like the ones lettered in the reference comic. Reads as "3/4". */
export function Fraction({ num, den, className = '' }: { num: string; den: string; className?: string }) {
  return (
    <span className={`mx-[0.12em] inline-flex flex-col items-center align-middle leading-none font-black ${className}`}>
      <span className="sr-only">
        {num}/{den}
      </span>
      <span aria-hidden className="px-[0.15em] text-[0.85em]">
        {num}
      </span>
      <span aria-hidden className="my-[0.1em] h-[0.12em] min-h-[2px] w-full rounded-full bg-current" />
      <span aria-hidden className="px-[0.15em] text-[0.85em]">
        {den}
      </span>
    </span>
  )
}

/** Plain text with any `a/b` rendered as a stacked fraction. Text stays real, translatable UI text. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(FRACTION)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    parts.push(<Fraction key={i} num={m[1]} den={m[2]} />)
    last = i + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>
}
