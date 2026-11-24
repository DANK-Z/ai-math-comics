import { useCallback } from 'react'
import { accounts, type Lang } from '../api'
import { useAccount } from '../account'
import { CLASSROOM_COPY } from '../classroomCopy'
import { SECTION_HREFS } from '../route'
import { usePolled } from '../usePolled'

// Home page cards while the class has a battle or a lesson going. Kept apart from the board
// screens, which load only when opened.

const LESSON_ALERT = {
  ru: { alertTitle: 'Идёт урок по комиксу', alertText: 'Учитель показывает главу на доске. Открой — ответ на задачу ты дашь отсюда.', join: 'Открыть' },
  kk: { alertTitle: 'Комикс бойынша сабақ жүріп жатыр', alertText: 'Мұғалім тарауды тақтада көрсетіп тұр. Аш — есептің жауабын осы жерден бересің.', join: 'Ашу' },
}

const HOME_POLL_MS = 20000

/** Home page: a bright card while the class has a battle going. */
export function BattleAlert({ lang }: { lang: Lang }) {
  const copy = CLASSROOM_COPY[lang].battle
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myBattle(lang, signal), [lang])
  const { value: battle } = usePolled(load, HOME_POLL_MS, inClass)
  if (!inClass || !battle || battle.status !== 'active') return null
  return (
    <a href={SECTION_HREFS.battle} className="boss-arena flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#2a1f6b,#e11d48)] p-3 text-white shadow-[0_4px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
      <span aria-hidden className="text-3xl">⚔️</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black leading-tight">{copy.alertTitle}</span>
        <span className="mt-0.5 block text-sm font-semibold text-white/90">{copy.alertText(battle.hp, battle.maxHp)}</span>
      </span>
      <span className="shrink-0 rounded-xl border-2 border-ink bg-sun px-3 py-1.5 font-black text-ink">{copy.join} →</span>
    </a>
  )
}


/** Home page: a card while the class has a lesson going. */
export function LessonAlert({ lang }: { lang: Lang }) {
  const copy = LESSON_ALERT[lang]
  const user = useAccount().user
  const inClass = user?.role === 'student' && !!user.schoolClass
  const load = useCallback((signal: AbortSignal) => accounts.myLesson(signal), [])
  const { value: lesson } = usePolled(load, 20000, inClass)
  if (!inClass || !lesson) return null
  return (
    <a href={SECTION_HREFS.lesson} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-[linear-gradient(135deg,#2a1f6b,#3366e0)] p-3 text-white shadow-[0_4px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun">
      <span aria-hidden className="text-3xl">📽️</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black leading-tight">{copy.alertTitle}</span>
        <span className="mt-0.5 block text-sm font-semibold text-white/90">{copy.alertText}</span>
      </span>
      <span className="shrink-0 rounded-xl border-2 border-ink bg-sun px-3 py-1.5 font-black text-ink">{copy.join} →</span>
    </a>
  )
}

