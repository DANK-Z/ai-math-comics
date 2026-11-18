import type { Lang } from '../api'
import { useHints } from '../hooks'
import { STRINGS } from '../i18n'

function PifikAvatar() {
  return (
    <svg viewBox="-45 -50 90 95" aria-hidden className="h-12 w-12 shrink-0">
      <ellipse cx={0} cy={0} rx={40} ry={44} fill="#34d399" stroke="#1c1917" strokeWidth={4} />
      <circle cx={-14} cy={-12} r={8} fill="#fff" stroke="#1c1917" strokeWidth={3} />
      <circle cx={14} cy={-12} r={8} fill="#fff" stroke="#1c1917" strokeWidth={3} />
      <circle cx={-13} cy={-11} r={3.5} fill="#1c1917" />
      <circle cx={15} cy={-11} r={3.5} fill="#1c1917" />
      <path d="M-12,6 Q0,18 12,6" fill="none" stroke="#1c1917" strokeWidth={3} strokeLinecap="round" />
      <text x={0} y={34} textAnchor="middle" fontSize={22} fontWeight={700} fill="#1c1917">
        π
      </text>
    </svg>
  )
}

export function PifikHints({ exerciseId, lang }: { exerciseId: string; lang: Lang }) {
  const t = STRINGS[lang]
  const { hints, revealed, loading, error, hasMore, requestNext } = useHints(exerciseId, lang)

  const buttonLabel = error ? t.retry : revealed === 0 ? t.askHint : t.nextHint
  const canAsk = error || (hasMore && !loading)

  return (
    <div className="mt-4 border-t-2 border-dashed border-stone-300 pt-4">
      <ul aria-live="polite" className="mb-3 space-y-3 empty:hidden">
        {hints.map((h) => (
          <li key={h.step} className="flex items-start gap-3">
            <PifikAvatar />
            <div className="relative rounded-2xl border-2 border-stone-900 bg-emerald-50 px-3 py-2 before:absolute before:top-4 before:-left-[9px] before:h-4 before:w-4 before:rotate-45 before:border-b-2 before:border-l-2 before:border-stone-900 before:bg-emerald-50">
              <p className="text-xs font-black tracking-wide text-emerald-700 uppercase">
                {t.pifikName} · {t.hintN(h.step)}
              </p>
              <p className="text-stone-900">{h.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {loading && <p className="mb-2 text-sm font-semibold text-emerald-700">{t.hintLoading}</p>}
      {error && <p className="mb-2 text-sm font-semibold text-rose-700">{t.hintError}</p>}

      {canAsk ? (
        <button
          type="button"
          onClick={requestNext}
          className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-emerald-300 px-4 py-1.5 font-bold text-stone-900 shadow-[3px_3px_0_#1c1917] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <span aria-hidden>💡</span> {buttonLabel}
        </button>
      ) : (
        !loading && revealed > 0 && <p className="text-sm font-semibold text-stone-600">{t.noMoreHints}</p>
      )}
    </div>
  )
}
