import { useEffect, useId, useState } from 'react'
import { accounts, isAbortError, type Lang, type Leaderboard, type LeaderRow } from '../api'
import { useAccount } from '../account'
import { CLASSROOM_COPY } from '../classroomCopy'
import { PORTRAITS } from '../art/sheet'
import { COSMETICS, frameClass, isCosmetic } from '../cosmetics'
import { PifikSprite } from './PifikSprite'

// Weekly class league: classmates ranked by stars, then coins earned this week. Students see
// it on the home page; teachers on the class page. Only the student's own class is shown.

/** Clean boss wins (3 stars, 40 coins each) the student needs to pass the 3rd place. */
export function winsToPodium(rows: LeaderRow[]): number | null {
  const me = rows.find((r) => r.me)
  // The lowest row still on the podium (rows are sorted; equal scores share a rank).
  const third = rows.filter((r) => r.rank <= 3).at(-1)
  if (!me || !third || me.rank <= 3) return null
  for (let wins = 1; wins < 100; wins++) {
    const stars = me.stars + 3 * wins
    const coins = me.coins + 40 * wins
    if (stars > third.stars || (stars === third.stars && coins > third.coins)) return wins
  }
  return null
}

export function LeagueTable({ board, lang }: { board: Leaderboard; lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].league
  return (
    <ol className="flex flex-col gap-1">
      {board.rows.map((row) => (
        <li
          key={`${row.rank}-${row.name}-${row.me}`}
          aria-current={row.me ? 'true' : undefined}
          className={`grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border-2 px-2 py-1 text-sm font-bold ${
            row.me ? 'border-ink bg-sun' : 'border-transparent bg-sky-50'
          }`}
        >
          <span className={`grid size-7 place-items-center rounded-full text-xs font-black ${row.rank <= 3 ? 'border-2 border-ink bg-white' : 'text-ink/60'}`}>
            {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
          </span>
          <PifikSprite rect={PORTRAITS.pifikFace} skin={row.skin ?? null} eager
            className={`aspect-square w-10 overflow-hidden rounded-full border-2 border-ink bg-sky ${row.frame ? `league-frame ${frameClass(row.frame)}` : ''}`} />
          <span className="min-w-0">
            <span className="block truncate">
              {row.name}
              {row.me && <span className="ml-1 rounded-md bg-ink px-1 text-[11px] text-white">{copy.you}</span>}
            </span>
            {row.title && isCosmetic(row.title) && (
              <span className="mt-0.5 block w-fit max-w-full truncate rounded-full border border-ink/60 bg-sun/70 px-1.5 text-[11px] leading-tight font-black text-ink">
                {COSMETICS[row.title].icon} {COSMETICS[row.title].name[lang]}
              </span>
            )}
          </span>
          <span className="tabular-nums" title={copy.stars}><span aria-hidden>⭐</span> {row.stars}<span className="sr-only"> {copy.stars}</span></span>
          <span className="w-14 text-right tabular-nums" title={copy.coins}><span aria-hidden>🪙</span> {row.coins}<span className="sr-only"> {copy.coins}</span></span>
        </li>
      ))}
    </ol>
  )
}

/** Home page card for a student in a class. */
export function ClassLeague({ lang }: { lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].league
  const user = useAccount().user
  const id = useId()
  const inClass = user?.role === 'student' && !!user.schoolClass
  const coins = user?.profile?.coins
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!inClass) return
    const ctrl = new AbortController()
    accounts.leaderboard(ctrl.signal).then(
      (b) => { setBoard(b); setFailed(false) },
      (err) => { if (!isAbortError(err)) setFailed(true) },
    )
    return () => ctrl.abort()
    // Coins change after a win or a reward: refresh the table then.
  }, [inClass, coins])

  if (user?.role !== 'student') return null
  const wins = board ? winsToPodium(board.rows) : null
  const me = board?.rows.find((r) => r.me)
  const nobody = board && board.rows.every((r) => r.stars === 0 && r.coins === 0)
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[0_4px_0_var(--shadow-ink)] sm:p-4">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-black text-ink">
        <span aria-hidden>🏆</span>{copy.title}{board && <span className="text-sm font-bold text-ink/60">· {board.className}</span>}
      </h2>
      {!inClass ? (
        <p className="mt-1 text-sm font-semibold text-ink/80">{copy.noClass}</p>
      ) : failed ? (
        <p className="mt-1 text-sm font-bold text-rose-700">{copy.error}</p>
      ) : board && (
        <>
          <p className="mt-0.5 mb-2 text-xs font-bold text-ink/65">{copy.week}</p>
          <LeagueTable board={board} lang={lang} />
          <p className="mt-2 rounded-xl bg-sun/30 px-2.5 py-1.5 text-sm leading-snug font-extrabold text-ink">
            {nobody ? copy.empty : me?.rank === 1 ? copy.leader : me && me.rank <= 3 ? copy.podium(me.rank) : wins ? copy.gap(wins) : copy.empty}
          </p>
          <p className="mt-1.5 text-xs font-semibold text-ink/65">{copy.howTo}</p>
        </>
      )}
    </section>
  )
}

/** Class page: the same weekly table for the teacher (no "you" row). */
export function TeacherLeague({ classId, lang }: { classId: number; lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].league
  const id = useId()
  const [board, setBoard] = useState<Leaderboard | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    accounts.classLeaderboard(classId, ctrl.signal).then(setBoard, () => {})
    return () => ctrl.abort()
  }, [classId])
  if (!board) return null
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-6">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🏆</span>{copy.title}</h2>
      <p className="mt-0.5 mb-2 text-sm font-bold text-ink/65">{copy.week}</p>
      <div className="max-w-xl"><LeagueTable board={board} lang={lang} /></div>
      <p className="mt-2 text-xs font-semibold text-ink/65">{copy.howTo}</p>
    </section>
  )
}
