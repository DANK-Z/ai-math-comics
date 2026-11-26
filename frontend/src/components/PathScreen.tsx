import { useCallback } from 'react'
import { accounts, type BattleTopic, type Lang } from '../api'
import { useAccount } from '../account'
import { CLASSROOM_COPY } from '../classroomCopy'
import { CURRICULUM_COPY, curriculumFor, practiceTopicFor } from '../curriculum'
import { OPERATIONS } from '../operations'
import { comicHref, SECTION_HREFS } from '../route'
import { useLoaded } from '../usePolled'
import { CARD } from './AuthScreen'

// #/path: the learning path. Chapters go in season order; the next few unread ones are listed.
// When the student's mistakes show a weak topic, a review drill is put in front of the next
// chapter on that topic (or first of all when no upcoming chapter needs it).

const COPY = {
  ru: {
    title: 'Мой путь',
    lead: 'Следующие шаги по программе. Если тема пока даётся трудно, путь сам вставит тренировку.',
    done: (n: number, t: number) => `Пройдено глав: ${n} из ${t}`,
    drill: (topic: string) => `Тренировка: ${topic}`,
    drillWhy: (n: number) => `Добавлено, потому что недавно было ${n} ошиб. в этой теме`,
    now: 'Сейчас',
    next: 'Дальше',
    finished: 'Все главы пройдены! Попробуй пробный тест НИШ/БИЛ или дуэль.',
    prep: '🎓 Пробный тест',
    duel: '⚔️ Дуэль',
  },
  kk: {
    title: 'Менің жолым',
    lead: 'Бағдарлама бойынша келесі қадамдар. Тақырып әзірге қиын болса, жол өзі жаттығу қосады.',
    done: (n: number, t: number) => `Өтілген тараулар: ${t}-тен ${n}`,
    drill: (topic: string) => `Жаттығу: ${topic}`,
    drillWhy: (n: number) => `Жақында осы тақырыпта ${n} қате болғандықтан қосылды`,
    now: 'Қазір',
    next: 'Әрі қарай',
    finished: 'Барлық тарау өтілді! НЗМ/БИЛ сынақ тестін немесе жекпе-жекті көр.',
    prep: '🎓 Сынақ тест',
    duel: '⚔️ Жекпе-жек',
  },
}

type Step =
  | { kind: 'chapter'; comicId: string; title: string; icon: string; goal?: string; grade?: number }
  | { kind: 'drill'; topic: BattleTopic; mistakes: number }

const SHOWN = 6

export function buildPath(completed: ReadonlySet<string>, weak: { topic: BattleTopic; mistakes: number } | null, lang: Lang) {
  const all = OPERATIONS.flatMap((op) => op.chapters.filter((c) => c.comicId).map((c) => ({ op, c, comicId: c.comicId as string })))
  const upcoming: Step[] = all.filter((x) => !completed.has(x.comicId)).slice(0, SHOWN).map(({ op, c, comicId }) => {
    const cur = curriculumFor(comicId)
    return { kind: 'chapter', comicId, title: c.title[lang], icon: op.icon, goal: cur?.goal[lang], grade: cur?.grade }
  })
  if (weak) {
    const at = upcoming.findIndex((s) => s.kind === 'chapter' && practiceTopicFor(s.comicId) === weak.topic)
    upcoming.splice(at < 0 ? 0 : at, 0, { kind: 'drill', topic: weak.topic, mistakes: weak.mistakes })
  }
  return { steps: upcoming, done: all.filter((x) => completed.has(x.comicId)).length, total: all.length }
}

export function PathScreen({ lang, completed }: { lang: Lang; completed: ReadonlySet<string> }) {
  const c = COPY[lang]
  const isStudent = useAccount().user?.role === 'student'
  const weak = useLoaded(useCallback((s: AbortSignal) => (isStudent ? accounts.weakSpot(s) : Promise.resolve(null)), [isStudent])).value ?? null
  const { steps, done, total } = buildPath(completed, weak, lang)
  const topics = CLASSROOM_COPY[lang].board.topics

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black text-ink">🧭 {c.title}</h1>
        <p className="mt-1 font-semibold text-ink/80">{c.lead}</p>
      </div>
      <div className={`${CARD} flex flex-col gap-2`}>
        <p className="font-black text-ink">{c.done(done, total)}</p>
        <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full bg-[#3366e0]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
      {steps.length === 0 ? (
        <div className={`${CARD} flex flex-col gap-3`}>
          <p className="font-black text-ink">🏁 {c.finished}</p>
          <div className="flex flex-wrap gap-2">
            <a href={SECTION_HREFS.prep} className="rounded-xl border-[3px] border-ink bg-sun px-3 py-2 font-black text-ink">{c.prep}</a>
            <a href={SECTION_HREFS.duel} className="rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-black text-ink">{c.duel}</a>
          </div>
        </div>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-4 border-dashed border-ink/25 pl-5">
          {steps.map((step, i) => {
            const href = step.kind === 'drill' ? `#/practice/${step.topic}` : comicHref(step.comicId)
            const first = i === 0
            return (
              <li key={step.kind === 'drill' ? `drill-${step.topic}` : step.comicId} className="relative">
                <span className={`absolute top-4 -left-[33px] h-5 w-5 rounded-full border-[3px] border-ink ${first ? 'bg-sun' : 'bg-white'}`} aria-hidden="true" />
                <a href={href} className={`flex items-start gap-3 rounded-2xl border-[3px] border-ink p-3 shadow-[3px_3px_0_#17233a] transition hover:-translate-y-0.5 ${step.kind === 'drill' ? 'bg-amber-50' : first ? 'bg-sky-50' : 'bg-white'}`}>
                  <span className="text-2xl" aria-hidden="true">{step.kind === 'drill' ? '🏋️' : step.icon}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs font-black tracking-wide text-ink/60 uppercase">{first ? c.now : c.next}{step.kind === 'chapter' && step.grade ? ` · ${CURRICULUM_COPY[lang].grade(step.grade)}` : ''}</span>
                    <span className="font-black text-ink">{step.kind === 'drill' ? c.drill(topics[step.topic]) : step.title}</span>
                    <span className="text-sm font-semibold text-ink/75">{step.kind === 'drill' ? c.drillWhy(step.mistakes) : step.goal}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
