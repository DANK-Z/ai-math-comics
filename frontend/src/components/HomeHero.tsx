import { LOCAL_COMICS, type Lang } from '../api'
import { useAccount } from '../account'
import pizzaCover from '../assets/pizza/cover.png'
import { CURRICULUM_COPY, curriculumFor } from '../curriculum'
import { OPERATIONS, operationHref, type Operation, type OperationChapter } from '../operations'
import { comicHref } from '../route'
import { PifikSprite } from './PifikSprite'
import { COSMETICS, frameClass, isCosmetic } from '../cosmetics'
import { PORTRAITS } from '../art/sheet'

// The first tab: one big scene that says what to do now. Pifik greets the student, the next
// chapter (or finale) of the stories fills the stage with its art and a big Play button, and a
// strip shows every story's progress. Live classroom cards (battle, lesson, homework…) sit
// around it in the home page.

const COPY = {
  ru: {
    hello: (name: string | null) => (name ? `Салем, ${name}!` : 'Салем!'),
    next: 'Следующая глава',
    finale: 'Финальное испытание',
    done: 'Все истории пройдены!',
    doneText: 'Ты прошёл все главы и финалы. Создай свой комикс или помоги классу в батле.',
    play: 'Играть',
    playFinale: 'К испытанию',
    create: 'Создать комикс',
    chapterOf: (n: number, total: number) => `Глава ${n} из ${total}`,
    finaleOf: 'Все главы пройдены — открыт финал',
    stories: 'Мои истории',
    progress: (done: number, total: number) => `${done} из ${total}`,
    won: 'Финал пройден',
  },
  kk: {
    hello: (name: string | null) => (name ? `Сәлем, ${name}!` : 'Сәлем!'),
    next: 'Келесі тарау',
    finale: 'Финалдық сынақ',
    done: 'Барлық оқиғалар өтілді!',
    doneText: 'Сен барлық тарау мен финалдан өттің. Өз комиксіңді жаса немесе шайқаста сыныпқа көмектес.',
    play: 'Ойнау',
    playFinale: 'Сынаққа',
    create: 'Комикс жасау',
    chapterOf: (n: number, total: number) => `${total} тараудың ${n}-і`,
    finaleOf: 'Барлық тарау өтілді — финал ашық',
    stories: 'Менің оқиғаларым',
    progress: (done: number, total: number) => `${total}-ден ${done}`,
    won: 'Финал өтілді',
  },
}

type Step =
  | { kind: 'chapter'; operation: Operation; chapter: OperationChapter }
  | { kind: 'finale'; operation: Operation }
  | { kind: 'done' }

const finaleId = (operation: Operation) => `${operation.id}-finale`

/** The first unread chapter in story order; a season's finale comes before the next season. */
export function nextStep(progress: ReadonlySet<string>, finalesWon: ReadonlySet<string>): Step {
  for (const operation of OPERATIONS) {
    const chapter = operation.chapters.find((c) => c.comicId && !progress.has(c.comicId))
    if (chapter) return { kind: 'chapter', operation, chapter }
    if (operation.finale.href && !finalesWon.has(finaleId(operation))) return { kind: 'finale', operation }
  }
  return { kind: 'done' }
}

/** First-panel art of a chapter (the pizza chapter has its own cover). */
function chapterArt(comicId: string | undefined): string {
  if (!comicId || comicId === 'pizza-fractions') return pizzaCover
  return LOCAL_COMICS.find((d) => d.id === comicId)?.panels[0]?.image ?? pizzaCover
}

export function HomeHero({ lang, progress, finalesWon }: { lang: Lang; progress: ReadonlySet<string>; finalesWon: ReadonlySet<string> }) {
  const copy = COPY[lang]
  const { user, frame, title } = useAccount()
  const worn = title && isCosmetic(title) ? COSMETICS[title] : null
  const name = user?.role === 'student' ? user.displayName.trim().split(/\s+/)[0] || null : null
  const step = nextStep(progress, finalesWon)
  const operation = step.kind === 'done' ? null : step.operation
  const chapter = step.kind === 'chapter' ? step.chapter : null
  const goal = chapter?.comicId ? curriculumFor(chapter.comicId) : undefined
  const href = step.kind === 'chapter' ? comicHref(step.chapter.comicId!) : step.kind === 'finale' ? step.operation.finale.href ?? operationHref(step.operation.id) : '#/create'
  const art = chapterArt(chapter?.comicId ?? operation?.chapters[0]?.comicId)

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="home-hero-title"
        className="home-hero relative overflow-hidden rounded-[32px] border-[4px] border-ink bg-[linear-gradient(135deg,#3366e0_0%,#6a4fd0_55%,#8b62d6_100%)] text-white shadow-[0_8px_0_var(--shadow-ink)]">
        <span aria-hidden className="home-hero-stars pointer-events-none absolute inset-0" />
        <div className="relative grid items-center gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:p-9">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center gap-3">
              <PifikSprite rect={PORTRAITS.pifik} eager className={`home-hero-pifik w-20 shrink-0 rounded-3xl border-[3px] border-white/80 bg-white/20 sm:w-24 ${frameClass(frame)}`} />
              <div className="min-w-0">
                <p className="text-2xl font-black sm:text-3xl">{copy.hello(name)}</p>
                {worn && <p className="hero-title mt-1">{worn.icon} {worn.name[lang]}</p>}
              </div>
            </div>
            {operation ? (
              <>
                <p className="w-fit rounded-full bg-sun px-3 py-1 text-sm font-black text-ink">
                  {operation.icon} {step.kind === 'finale' ? copy.finale : copy.next}
                </p>
                <h1 id="home-hero-title" className="text-3xl leading-tight font-black text-balance sm:text-4xl lg:text-5xl">
                  {chapter ? chapter.title[lang] : operation.finale.title[lang]}
                </h1>
                <p className="text-base font-semibold text-white/90 sm:text-lg">
                  {operation.title[lang]} · {chapter ? copy.chapterOf(chapter.number, operation.chapters.length) : copy.finaleOf}
                </p>
                {goal && (
                  <p className="text-sm font-bold text-white/85">📘 {CURRICULUM_COPY[lang].grade(goal.grade)} · {goal.goal[lang]}</p>
                )}
              </>
            ) : (
              <>
                <h1 id="home-hero-title" className="text-3xl leading-tight font-black sm:text-4xl">{copy.done}</h1>
                <p className="text-lg font-semibold text-white/90">{copy.doneText}</p>
              </>
            )}
            <a href={href}
              className="home-hero-play mt-1 inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-[4px] border-ink bg-sun px-8 text-2xl font-black text-ink shadow-[0_6px_0_var(--shadow-ink)] transition hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[0_2px_0_var(--shadow-ink)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-fit">
              <span aria-hidden>▶</span>{step.kind === 'finale' ? copy.playFinale : step.kind === 'done' ? copy.create : copy.play}
            </a>
          </div>
          <a href={href} tabIndex={-1} aria-hidden className="home-hero-art relative block">
            <img src={art} alt="" loading="eager" className="aspect-[16/10] w-full rounded-3xl border-[4px] border-ink object-cover shadow-[0_10px_0_rgb(0_0_0/0.25)]" />
            {step.kind === 'finale' && <span className="absolute top-3 right-3 rounded-xl border-[3px] border-ink bg-sun px-3 py-1 text-lg font-black text-ink">🏆</span>}
          </a>
        </div>
      </section>

      <section aria-labelledby="home-stories-title">
        <h2 id="home-stories-title" className="mb-2 text-lg font-black text-ink">{copy.stories}</h2>
        <ol className="flex snap-x gap-3 overflow-x-auto pb-2">
          {OPERATIONS.map((op) => {
            const total = op.chapters.length
            const done = op.chapters.filter((c) => c.comicId && progress.has(c.comicId)).length
            const won = finalesWon.has(finaleId(op))
            const current = operation?.id === op.id
            return (
              <li key={op.id} className="w-40 shrink-0 snap-start sm:w-44">
                <a href={operationHref(op.id)}
                  className={`block overflow-hidden rounded-2xl border-[3px] bg-white shadow-[0_3px_0_var(--shadow-ink)] transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${current ? 'border-ink ring-4 ring-sun' : 'border-ink/70'}`}>
                  <img src={chapterArt(op.chapters[0]?.comicId)} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                  <span className="block px-2.5 pt-1.5 pb-2">
                    <span className="line-clamp-2 block min-h-10 text-sm leading-tight font-black text-ink">{op.icon} {op.title[lang].replace(/^Операция |операциясы$/g, '').replace(/[«»]/g, '').trim()}</span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} />
                    </span>
                    <span className="mt-1 block text-xs font-bold text-ink/70">{won ? `🏆 ${copy.won}` : copy.progress(done, total)}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
