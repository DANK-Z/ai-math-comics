import { useCallback, useEffect, useState } from 'react'
import { BOSS_COPY } from '../boss'
import { useBossProgress } from '../bossProgress'
import type { Comic, Lang } from '../api'
import { PANEL_ASPECT } from '../art/sheet'
import { chapterBonus, type BonusSticker } from '../bonusPuzzles'
import { CHARACTERS } from '../characters'
import type { ContinuationJob } from '../continuation'
import { useAnswerCheck } from '../hooks'
import { GUIDE_COPY } from '../guideCopy'
import { STRINGS } from '../i18n'
import { comicHref, DEMO_COMIC_ID, GARLAND_COMIC_ID, GUARDIAN_HREF, SCHOOL_MAP_COMIC_ID, SECTION_HREFS } from '../route'
import { operationChapter } from '../operations'
import { schoolFairChapter, type SchoolFairCollectible } from '../schoolFair'
import { BossFight } from './BossFight'
import { CastCard } from './CastCard'
import { Continuation } from './Continuation'
import { ExerciseCard } from './ExerciseCard'
import { PanelArt } from './PanelArt'
import { PifikHints } from './PifikHints'
import { BonusPuzzle } from './BonusPuzzle'

// Panels after the exercise panel stay locked until the answer is correct,
// so later panels don't spoil the solution.
const GATE_AFTER_EXERCISE = true

interface Props {
  comic: Comic
  lang: Lang
  index: number
  onIndexChange: (i: number) => void
  onChapterComplete: (comicId: string) => SchoolFairCollectible | null
  onEarnBonusSticker: (id: BonusSticker) => boolean
  continuationJob: ContinuationJob
  chapterThreeSolved: boolean
  /** Opened with a Replay link: the boss fight starts from round one. */
  replay?: boolean
  syncBossProgress: boolean
  rememberReading: boolean
  savedSolved: boolean
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-[3px] border-ink px-4 py-2 font-black shadow-[0_4px_0_var(--color-ink)] transition active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

/** Ending line and onward link for a School Fair or operation chapter. */
function chapterEnding(comicId: string) {
  const fair = schoolFairChapter(comicId)
  if (fair) return { ...fair, doneHref: SECTION_HREFS.map, doneLabel: undefined }
  const op = operationChapter(comicId)
  if (!op) return undefined
  return { speaker: op.speaker, ending: op.ending, nextComicId: op.nextComicId, doneHref: op.doneHref, doneLabel: op.operation.finale.href ? op.operation.finale.title : op.operation.title }
}

/** Wide screens: which panels are open, where the task is, and why the ending is still closed. */
function ProgressCard({ lang, total, current, maxIndex, exerciseIndex, solved, boss, onGoTo }: {
  lang: Lang
  total: number
  current: number
  maxIndex: number
  exerciseIndex: number
  solved: boolean
  boss: { cleared: number; rounds: number } | null
  onGoTo: (i: number) => void
}) {
  const g = GUIDE_COPY[lang].reader
  const taskPanel = exerciseIndex + 1
  const closed = !solved && exerciseIndex >= 0 && maxIndex < total - 1
  return (
    <section aria-label={g.title} className="rounded-2xl border-2 border-ink bg-white p-3 shadow-[0_3px_0_var(--color-ink)] sm:p-4">
      <h2 className="text-base font-black">{g.title}</h2>
      <p className="mt-1 text-sm font-bold text-ink/80">{g.panels(maxIndex + 1, total)}</p>
      <ol aria-hidden className="mt-2 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={`grid h-7 flex-1 place-items-center rounded-md border-2 text-xs font-black ${
              i > maxIndex ? 'border-dashed border-ink/30 bg-sky-50 text-ink/40'
                : i === current ? 'border-ink bg-sun text-ink'
                  : 'border-ink/70 bg-emerald-100 text-ink'
            }`}
          >
            {i > maxIndex ? '🔒' : i === exerciseIndex ? '★' : i + 1}
          </li>
        ))}
      </ol>
      {exerciseIndex >= 0 && (
        <p className="mt-1.5 text-xs font-bold text-ink/65">★ — {g.legendTask}</p>
      )}
      {closed ? (
        <div className="mt-3 rounded-xl bg-sun/30 p-2.5">
          <p className="text-sm leading-snug font-extrabold text-ink">
            <span aria-hidden>🔒 </span>
            {boss ? g.bossReason(taskPanel, boss.cleared, boss.rounds) : g.lockReason(taskPanel)}
          </p>
          {current !== exerciseIndex && (
            <button type="button" onClick={() => onGoTo(exerciseIndex)}
              className="mt-2 min-h-10 w-full rounded-xl border-[3px] border-ink bg-sun px-3 text-sm font-black shadow-[0_3px_0_var(--color-ink)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
              {g.toTask(taskPanel)} <span aria-hidden>→</span>
            </button>
          )}
        </div>
      ) : exerciseIndex >= 0 && (
        <p className="mt-3 rounded-xl bg-emerald-100 p-2.5 text-sm font-extrabold text-emerald-900">
          <span aria-hidden>✓ </span>{g.open}
        </p>
      )}
    </section>
  )
}

export function ComicReader({ comic, lang, index, onIndexChange, onChapterComplete, onEarnBonusSticker, continuationJob, chapterThreeSolved, replay = false, syncBossProgress, rememberReading, savedSolved }: Props) {
  const t = STRINGS[lang]
  const comicId = comic.id
  const [reward, setReward] = useState<SchoolFairCollectible | null>(null)
  const onCorrect = useCallback(() => {
    const item = onChapterComplete(comicId)
    if (item) setReward(item)
  }, [comicId, onChapterComplete])
  const check = useAnswerCheck(comic.exercise.id, lang, onCorrect)
  // Generated comics fight a boss on the exercise panel: every round must be won.
  const boss = comic.boss
  const bossProgress = useBossProgress(comicId, !!boss, replay, syncBossProgress)
  const bossCleared = boss ? Math.min(bossProgress.cleared, boss.rounds.length) : 0
  const bossDefeated = !!boss && bossCleared >= boss.rounds.length
  const { roundCleared } = bossProgress
  const onRoundCleared = useCallback(() => {
    const next = roundCleared()
    if (boss && next >= boss.rounds.length) onCorrect()
  }, [boss, roundCleared, onCorrect])
  const exerciseSolved = boss ? bossDefeated : check.solved || savedSolved
  const hintExerciseId = boss ? boss.rounds[Math.min(bossCleared, boss.rounds.length - 1)].exerciseId : comic.exercise.id
  const solved = exerciseSolved || chapterThreeSolved
  const total = comic.panels.length
  const exerciseIndex = comic.panels.findIndex((p) => p.id === comic.exercise.panelId)
  const maxIndex = GATE_AFTER_EXERCISE && exerciseIndex >= 0 && !solved ? exerciseIndex : total - 1
  const current = Math.min(index, maxIndex)
  const panel = comic.panels[current]
  const isExercisePanel = panel.id === comic.exercise.panelId
  const showCast = comic.id === DEMO_COMIC_ID || !comic.panels.some((p) => p.imageUrl)
  const showHints = isExercisePanel && !exerciseSolved
  const arena = !!boss && isExercisePanel && !bossDefeated
  const showSidebar = showCast || showHints
  const locked = current === maxIndex && maxIndex < total - 1
  const justUnlocked = exerciseSolved && isExercisePanel && current < total - 1
  const ending = solved && current === total - 1 ? chapterEnding(comic.id) : undefined
  const bonusSticker = ending ? chapterBonus(comicId) : undefined

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable], dialog[open]')) return
      if (e.key === 'ArrowRight' && current < maxIndex) onIndexChange(current + 1)
      if (e.key === 'ArrowLeft' && current > 0) onIndexChange(current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, maxIndex, onIndexChange])

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <section
        aria-label={comic.title}
        className="min-w-0 rounded-[28px] border-[3px] border-ink/10 bg-white p-3 shadow-[0_10px_30px_rgb(36_57_159/0.15)] sm:p-4 xl:col-start-1 xl:row-start-1"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="rounded-full bg-brand px-4 py-1 text-sm font-black text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)] sm:text-base">
            {comic.title}
          </h2>
          <p className="shrink-0 text-sm font-extrabold text-ink/70" aria-live="polite">
            {t.panelOf(current + 1, total)}
          </p>
        </div>
        {comic.artwork === 'prepared' && (
          <p className="mb-3 px-1 text-sm font-semibold text-ink/70">{t.preparedArtwork}</p>
        )}

        <figure
          key={panel.id}
          className={`panel-enter relative overflow-hidden rounded-2xl border-[5px] border-ink bg-sky-100 transition-[border-color,box-shadow] duration-500 ${arena ? 'boss-arena' : ''}`}
          aria-label={`${panel.speaker}: ${panel.text}`}
        >
          <PanelArt imageKey={panel.imageKey} imageUrl={panel.imageUrl} lang={lang} speaker={panel.speaker} text={panel.text} imageAspect={panel.imageAspect} placeholder={panel.placeholder}
            emotion={panel.emotion} layers={panel.layers} animateDialogue={!isExercisePanel} priority />
          <span className={`absolute ${panel.imageUrl ? 'top-2' : 'bottom-2'} left-2 grid h-9 w-9 place-items-center rounded-full border-[3px] border-ink bg-sun text-lg font-black text-ink`}>
            {panel.id}
          </span>
          {arena && (
            <span className="boss-enter absolute top-2 right-2 rounded-lg border-2 border-ink bg-rose-600 px-2 py-0.5 text-xs font-black text-white sm:text-sm">
              <span aria-hidden>⚔️ </span>{BOSS_COPY[lang].arena}
            </span>
          )}
        </figure>

        {ending && (
          <div className="mt-4 rounded-2xl border-[3px] border-ink bg-cream p-4">
            <span className={`inline-block rounded-lg border-2 border-ink px-2 py-0.5 text-sm font-black ${CHARACTERS[ending.speaker].tag}`}>
              {t.cast[ending.speaker].name}
            </span>
            <p className="mt-2 font-bold text-ink">{ending.ending[lang]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={ending.nextComicId ? comicHref(ending.nextComicId) : ending.doneHref}
                className={`${BTN} w-full bg-sun sm:w-auto`}
              >
                {ending.nextComicId ? t.nextChapter : ending.doneLabel?.[lang] ?? t.fairRoute.title}
                <span aria-hidden>→</span>
              </a>
              {comicId === GARLAND_COMIC_ID && (
                <a href={GUARDIAN_HREF} className={`${BTN} w-full bg-white sm:w-auto`}>{t.guardian.title}</a>
              )}
              {bonusSticker && <BonusPuzzle sticker={bonusSticker} lang={lang} onEarnSticker={onEarnBonusSticker} />}
              {comicId === SCHOOL_MAP_COMIC_ID && ending.nextComicId && (
                <Continuation
                  sourceChapterId={SCHOOL_MAP_COMIC_ID}
                  nextComicId={ending.nextComicId}
                  lang={lang}
                  buttonClass={BTN}
                  job={continuationJob}
                />
              )}
            </div>
          </div>
        )}

        <nav aria-label={t.panelOf(current + 1, total)} className="mt-4 flex flex-col gap-3">
          <ol className="mx-auto grid w-full max-w-xl gap-1.5 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {comic.panels.map((p, i) => {
              const reachable = i <= maxIndex
              const active = i === current
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-label={reachable ? t.goToPanel(i + 1) : `${t.goToPanel(i + 1)} — ${t.locked}`}
                    aria-current={active ? 'step' : undefined}
                    disabled={!reachable}
                    onClick={() => onIndexChange(i)}
                    className={`relative block w-full overflow-hidden rounded-lg border-[3px] transition sm:rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun ${
                      active
                        ? 'border-ink ring-4 ring-sun'
                        : reachable
                          ? 'border-ink/70 hover:-translate-y-0.5 hover:border-ink'
                          : 'cursor-not-allowed border-ink/30'
                    }`}
                  >
                    {reachable ? (
                      <PanelArt imageKey={p.imageKey} imageUrl={p.imageUrl} lang={lang} speaker={p.speaker} text="" imageAspect={p.imageAspect} placeholder={p.placeholder} thumb />
                    ) : (
                      <div aria-hidden className="bg-sky-100" style={{ aspectRatio: p.imageAspect ?? PANEL_ASPECT }} />
                    )}
                    <span
                      className={`absolute top-0.5 left-0.5 grid h-4 min-w-4 place-items-center rounded-full border-[1.5px] border-ink px-0.5 text-[10px] font-black sm:top-1 sm:left-1 sm:h-5 sm:min-w-5 sm:border-2 sm:text-[11px] ${
                        active ? 'bg-sun text-ink' : 'bg-white text-ink'
                      }`}
                    >
                      {p.id}
                    </span>
                    {!reachable && (
                      <span aria-hidden className="absolute inset-0 grid place-items-center bg-ink/30 text-base sm:text-xl">
                        🔒
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => onIndexChange(current - 1)} disabled={current === 0} className={`${BTN} bg-white text-ink`}>
              <span aria-hidden>←</span> {t.prev}
            </button>
            {current < total - 1 ? (
              <button
                type="button"
                onClick={() => onIndexChange(current + 1)}
                disabled={locked}
                title={locked ? t.locked : undefined}
                className={`${BTN} bg-sun text-ink`}
              >
                {t.next} <span aria-hidden>→</span>
              </button>
            ) : (
              <button type="button" onClick={() => onIndexChange(0)} className={`${BTN} bg-white text-ink`}>
                <span aria-hidden>↺</span> {t.restart}
              </button>
            )}
          </div>
          {locked && (
            <p className="rounded-xl bg-sun/30 px-3 py-2 text-center text-sm font-extrabold text-ink">
              <span aria-hidden>🔒 </span>
              {t.locked}
            </p>
          )}
          {justUnlocked && (
            <button
              type="button"
              onClick={() => onIndexChange(current + 1)}
              className="rounded-xl bg-emerald-100 px-3 py-2 text-center text-sm font-extrabold text-emerald-900 hover:bg-emerald-200"
            >
              {t.unlocked}
            </button>
          )}
        </nav>
      </section>

      {/* Kept mounted between panels to preserve the typed answer and revealed hints. */}
      <div hidden={!isExercisePanel} inert={!isExercisePanel} className="min-w-0 xl:col-start-1 xl:row-start-2">
        {boss ? (
          <BossFight boss={boss} lang={lang} active={isExercisePanel} cleared={bossCleared} onRoundCleared={onRoundCleared}
            misses={bossProgress.misses} onMiss={bossProgress.miss}
            onReadOn={exerciseIndex + 1 < total ? () => onIndexChange(exerciseIndex + 1) : undefined} />
        ) : (
          <ExerciseCard exercise={comic.exercise} lang={lang} check={{ ...check, solved: exerciseSolved }} reward={reward} />
        )}
      </div>
      {/* The progress card only shows on wide screens; narrow ones keep the sidebar for hints and cast. */}
      <div className={`min-w-0 flex-col gap-5 xl:sticky xl:top-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:flex ${showSidebar ? 'flex' : 'hidden'}`}>
        <div className="hidden xl:block">
          <ProgressCard lang={lang} total={total} current={current} maxIndex={maxIndex} exerciseIndex={exerciseIndex}
            solved={solved} boss={boss ? { cleared: bossCleared, rounds: boss.rounds.length } : null} onGoTo={onIndexChange} />
        </div>
        <aside hidden={!showHints} aria-label={t.navigation.hints} className="rounded-2xl border-2 border-ink bg-cream p-3 shadow-[0_3px_0_var(--color-ink)] sm:p-4">
          <h2 className="mb-3 text-base font-black">{t.navigation.hints}</h2>
          <PifikHints key={hintExerciseId} exerciseId={hintExerciseId} lang={lang} mapHints={comicId === SCHOOL_MAP_COMIC_ID}
            structured={!!schoolFairChapter(comicId) || !!operationChapter(comicId)} savedComicId={rememberReading ? comicId : undefined} />
        </aside>
        <div hidden={!showCast}>
          {showCast && <CastCard lang={lang} activeSpeaker={panel.speaker} compact={isExercisePanel} />}
        </div>
      </div>
    </div>
  )
}
