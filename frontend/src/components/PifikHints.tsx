import type { Lang } from '../api'
import { PORTRAITS } from '../art/sheet'
import { useHints } from '../hooks'
import { STRINGS } from '../i18n'
import { RichText } from './RichText'
import { SheetCrop } from './SheetCrop'

function PifikAvatar() {
  return <SheetCrop rect={PORTRAITS.pifikFace} className="w-12 shrink-0 rounded-full border-[3px] border-ink bg-white" />
}

export function PifikHints({ exerciseId, lang }: { exerciseId: string; lang: Lang }) {
  const t = STRINGS[lang]
  const { hints, revealed, loading, error, hasMore, requestNext } = useHints(exerciseId, lang)

  const buttonLabel = error ? t.retry : revealed === 0 ? t.askHint : t.nextHint
  const canAsk = error || (hasMore && !loading)

  return (
    <div>
      <ul aria-live="polite" className="mb-3 space-y-3 empty:hidden">
        {hints.map((h) => (
          <li key={h.step} className="flex items-start gap-3">
            <PifikAvatar />
            <div className="relative rounded-2xl border-[3px] border-ink bg-white px-3 py-2 before:absolute before:top-4 before:-left-[10px] before:h-4 before:w-4 before:rotate-45 before:border-b-[3px] before:border-l-[3px] before:border-ink before:bg-white">
              <p className="text-xs font-black tracking-wide text-sky-700 uppercase">
                {t.pifikName} · {t.hintN(h.step)}
              </p>
              <p className="font-semibold text-ink">
                <RichText text={h.text} />
              </p>
            </div>
          </li>
        ))}
      </ul>

      {loading && <p className="mb-2 text-sm font-bold text-sky-700">{t.hintLoading}</p>}
      {error && <p className="mb-2 text-sm font-bold text-rose-700">{t.hintError}</p>}

      {canAsk ? (
        <button
          type="button"
          onClick={requestNext}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-ink bg-sky-300 py-1 pr-4 pl-1 font-black text-ink shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          <SheetCrop rect={PORTRAITS.pifikFace} className="w-8 rounded-full border-2 border-ink bg-white" />
          {buttonLabel}
        </button>
      ) : (
        !loading && revealed > 0 && <p className="text-sm font-bold text-ink/70">{t.noMoreHints}</p>
      )}
    </div>
  )
}
