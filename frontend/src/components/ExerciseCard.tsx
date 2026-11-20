import { useId, useState, type FormEvent } from 'react'
import type { CheckStatus, Exercise, Lang } from '../api'
import { STRINGS } from '../i18n'
import type { SchoolFairCollectible } from '../schoolFair'
import { CollectibleIcon } from './BackpackCollection'
import { PifikHints } from './PifikHints'
import { RichText } from './RichText'
import type { useAnswerCheck } from '../hooks'

const STATUS_STYLE: Record<CheckStatus, { box: string; icon: string }> = {
  correct: { box: 'border-emerald-700 bg-emerald-50 text-emerald-950', icon: '✓' },
  incorrect: { box: 'border-rose-600 bg-rose-50 text-rose-950', icon: '✗' },
  invalid: { box: 'border-amber-600 bg-amber-50 text-amber-950', icon: '!' },
}

interface Props {
  exercise: Exercise
  lang: Lang
  check: ReturnType<typeof useAnswerCheck>
  reward: SchoolFairCollectible | null
}

export function ExerciseCard({ exercise, lang, check, reward }: Props) {
  const t = STRINGS[lang]
  const [answer, setAnswer] = useState('')
  const inputId = useId()
  const { result, checking, error, submit, solved } = check
  const wholeNumber = exercise.answerFormat === 'whole-number'

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (answer.trim() && !checking) submit(answer.trim())
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="overflow-hidden rounded-[28px] border-[4px] border-ink bg-cream shadow-[0_6px_0_var(--color-ink)]"
    >
      <h2 id={`${inputId}-title`} className="flex items-center gap-2 bg-brand px-4 py-2 text-lg font-black text-white">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-sun text-sm text-ink">
          ?
        </span>
        {t.exerciseTitle}
      </h2>

      <div className="p-4 sm:p-5">
        <p className="mb-4 text-lg leading-snug font-bold text-ink">
          <RichText text={exercise.prompt} />
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-black text-ink/80">
            {t.answerLabel}
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={wholeNumber ? t.wholeNumberPlaceholder : t.answerPlaceholder}
              inputMode="text"
              autoComplete="off"
              disabled={solved}
              className="min-h-12 w-full min-w-0 flex-1 rounded-2xl border-[3px] border-ink bg-white px-3 font-mono text-2xl font-bold tabular-nums outline-none placeholder:text-base placeholder:font-sans placeholder:font-semibold focus:ring-4 focus:ring-sun disabled:bg-stone-100"
            />
            <button
              type="submit"
              disabled={!answer.trim() || checking || solved}
              className="min-h-12 shrink-0 rounded-2xl border-[3px] border-ink bg-sun px-4 text-lg font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {checking ? t.checking : t.check}
            </button>
          </div>
        </form>

        <div aria-live="polite" className="mt-3 min-h-[1.5rem]">
          {error && <p className="font-bold text-rose-700">{t.checkError}</p>}
          {result && !error && (
            <div className={`flex items-start gap-3 rounded-2xl border-[3px] p-3 ${STATUS_STYLE[result.status].box}`}>
              <span aria-hidden className="text-2xl leading-none font-black">
                {STATUS_STYLE[result.status].icon}
              </span>
              <div>
                <p className="font-black">{t.status[result.status]}</p>
                <p className="font-semibold">
                  <RichText text={result.message} />
                </p>
              </div>
            </div>
          )}
          {result?.status === 'correct' && !error && reward && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-ink/70 bg-[#fff2bd] p-2 text-sm font-extrabold text-ink">
              <CollectibleIcon item={reward} />
              <p>{t.backpack.reward(t.backpack.items[reward].name)}</p>
            </div>
          )}
        </div>

        {!solved && <PifikHints exerciseId={exercise.id} lang={lang} />}
      </div>
    </section>
  )
}
