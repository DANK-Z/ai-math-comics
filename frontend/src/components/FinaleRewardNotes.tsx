import type { Lang } from '../api'
import { useAccount } from '../account'
import { PROGRESS_REWARDS, REWARD_COPY, TROPHIES } from '../rewards'
import { SECTION_HREFS } from '../route'

/** Under a won finale: its trophy and the one-time coins (or a hint to sign in). */
export function FinaleRewardNotes({ lang, progressId }: { lang: Lang; progressId: string }) {
  const student = useAccount().user?.role === 'student'
  const trophy = TROPHIES.find((t) => t.unlockedBy === progressId)
  const coins = PROGRESS_REWARDS[progressId]
  const copy = REWARD_COPY[lang]
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
      {trophy && (
        <a href={SECTION_HREFS.backpack} className="rounded-lg border-2 border-ink bg-sun/40 px-2 py-0.5 text-ink hover:bg-sun focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span aria-hidden>{trophy.icon} </span>{copy.trophy(trophy.name[lang])}
        </a>
      )}
      {coins && (student
        ? <span className="rounded-lg border-2 border-amber-700 bg-sun px-2 py-0.5 text-ink"><span aria-hidden>🪙 </span>{copy.coins(coins)}</span>
        : <span className="text-ink/70">{copy.guest}</span>)}
    </div>
  )
}
