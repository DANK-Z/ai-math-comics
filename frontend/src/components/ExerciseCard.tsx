import { useId, useState, type FormEvent } from 'react'
import type { CheckStatus, Exercise, Lang } from '../api'
import { STRINGS } from '../i18n'
import { PifikHints } from './PifikHints'
import type { useAnswerCheck } from '../hooks'

const STATUS_STYLE: Record<CheckStatus, { box: string; icon: string }> = {
  correct: { box: 'border-emerald-600 bg-emerald-50 text-emerald-900', icon: '✓' },
  incorrect: { box: 'border-rose-600 bg-rose-50 text-rose-900', icon: '✗' },
  invalid: { box: 'border-amber-600 bg-amber-50 text-amber-900', icon: '!' },
}

interface Props {
  exercise: Exercise
  lang: Lang
  check: ReturnType<typeof useAnswerCheck>
}

export function ExerciseCard({ exercise, lang, check }: Props) {
  const t = STRINGS[lang]
  const [answer, setAnswer] = useState('')
  const inputId = useId()
  const { result, checking, error, submit, solved } = check

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (answer.trim() && !checking) submit(answer.trim())
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="rounded-2xl border-[3px] border-stone-900 bg-white p-4 shadow-[5px_5px_0_#1c1917] sm:p-5"
    >
      <h2 id={`${inputId}-title`} className="mb-2 text-xs font-black tracking-widest text-amber-600 uppercase">
        {t.exerciseTitle}
      </h2>
      <p className="mb-4 text-lg leading-snug font-semibold text-stone-900">{exercise.prompt}</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label htmlFor={inputId} className="flex-1">
          <span className="mb-1 block text-sm font-bold text-stone-700">{t.answerLabel}</span>
          <input
            id={inputId}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t.answerPlaceholder}
            inputMode="text"
            autoComplete="off"
            disabled={solved}
            className="w-full rounded-xl border-2 border-stone-900 px-3 py-2 font-mono text-xl tabular-nums outline-none focus:ring-4 focus:ring-amber-300 disabled:bg-stone-100"
          />
        </label>
        <button
          type="submit"
          disabled={!answer.trim() || checking || solved}
          className="rounded-xl border-2 border-stone-900 bg-amber-400 px-5 py-2 text-lg font-black text-stone-900 shadow-[3px_3px_0_#1c1917] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? t.checking : t.check}
        </button>
      </form>

      <div aria-live="polite" className="mt-3 min-h-[1.5rem]">
        {error && <p className="font-semibold text-rose-700">{t.checkError}</p>}
        {result && !error && (
          <div className={`flex items-start gap-3 rounded-xl border-2 p-3 ${STATUS_STYLE[result.status].box}`}>
            <span aria-hidden className="text-2xl leading-none font-black">
              {STATUS_STYLE[result.status].icon}
            </span>
            <div>
              <p className="font-black">{t.status[result.status]}</p>
              <p>{result.message}</p>
            </div>
          </div>
        )}
      </div>

      {!solved && <PifikHints exerciseId={exercise.id} lang={lang} />}
    </section>
  )
}
