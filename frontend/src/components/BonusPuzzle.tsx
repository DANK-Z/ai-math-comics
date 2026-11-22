import { useId, useRef, useState } from 'react'
import { checkWholeNumberAnswer } from '../api/localComics'
import type { CheckStatus, Lang } from '../api/types'
import { bonusPuzzle, type BonusSticker } from '../bonusPuzzles'
import { STRINGS } from '../i18n'

const BUTTON = 'min-h-11 rounded-xl border-2 border-ink px-3 py-2 text-sm font-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50'

export function BonusPuzzle({ lang, sticker, onEarnSticker }: { lang: Lang; sticker: BonusSticker; onEarnSticker: (id: BonusSticker) => boolean }) {
  const t = STRINGS[lang]
  const puzzle = bonusPuzzle(sticker, lang, t)
  const { copy } = puzzle
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<CheckStatus | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [awarded, setAwarded] = useState(false)
  const solved = result === 'correct'

  return (
    <div className="w-full" onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation()
      if (event.key === 'Escape' && open) {
        setOpen(false)
        trigger.current?.focus()
      }
    }}>
      <button
        ref={trigger}
        type="button"
        className={`${BUTTON} bg-white`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{puzzle.icon} </span>{copy.inspect}
      </button>
      <section
        id={id}
        hidden={!open}
        aria-labelledby={`${id}-title`}
        className="mt-3 max-w-xl rounded-xl border-2 border-ink bg-white p-3 sm:p-4"
      >
        <h3 id={`${id}-title`} className="font-black">{copy.title}</h3>
        <p id={`${id}-prompt`} className="mt-1 text-sm font-semibold">{copy.prompt}</p>
        <form className="mt-3" onSubmit={event => {
          event.preventDefault()
          if (solved || !answer.trim()) return
          const status = checkWholeNumberAnswer(answer, puzzle.answer)
          setResult(status)
          if (status === 'correct' && onEarnSticker(sticker)) setAwarded(true)
        }}>
          <label htmlFor={`${id}-answer`} className="block text-sm font-bold">{t.answerLabel}</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id={`${id}-answer`}
              aria-describedby={`${id}-prompt`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={256}
              value={answer}
              onChange={event => setAnswer(event.target.value)}
              readOnly={solved}
              className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-ink px-2 font-mono focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand read-only:bg-sky"
            />
            <button type="submit" disabled={solved || !answer.trim()} className={`${BUTTON} bg-sun`}>{t.check}</button>
          </div>
        </form>
        <div aria-live="polite">
          {result && (
            <div className={`mt-3 rounded-lg p-2 text-sm font-semibold ${solved ? 'bg-emerald-100' : 'bg-rose-50'}`}>
              <p className="font-black">{copy.feedback[result]}</p>
              {solved && <p className="mt-1">{copy.explanation}</p>}
              {awarded && <p className="mt-1 font-black">{copy.reward}</p>}
            </div>
          )}
        </div>
        {!solved && (
          <>
            <button
              type="button"
              aria-controls={`${id}-hint`}
              aria-expanded={showHint}
              onClick={() => setShowHint(!showHint)}
              className={`${BUTTON} mt-3 bg-sky`}
            >
              {t.askHint}
            </button>
            <p id={`${id}-hint`} hidden={!showHint} className="mt-2 rounded-lg bg-sky p-2 text-sm font-semibold">
              <span className="block font-black text-brand-dark">{t.pifikName}</span>
              {copy.hint}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
