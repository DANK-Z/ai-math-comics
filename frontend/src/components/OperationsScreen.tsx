import type { Lang } from '../api'
import lightsCover from '../assets/lights/park-4.webp'
import museumCover from '../assets/museum/mirror-1.webp'
import roadsCover from '../assets/roads/cover.webp'
import { OPERATIONS, operationHref, type Operation } from '../operations'
import { comicHref, SECTION_HREFS } from '../route'

// The seasons after the School Fair: a list of operations and one page per operation
// with its chapters in story order and the finale.

const COPY = {
  ru: {
    title: 'Операции после ярмарки',
    lead: 'Новые истории с Алдияром, Аруной и Пификом. В каждой — четыре главы и финальное испытание.',
    chapters: (done: number, ready: number) => `Глав пройдено: ${done} из ${ready}`,
    soon: 'Скоро',
    soonLong: 'Готовим иллюстрации — глава скоро откроется.',
    open: 'Открыть',
    start: 'Начать',
    read: 'Читать',
    chapter: (n: number) => `Глава ${n}`,
    finale: 'Финал',
    finaleLocked: (left: number) => `Откроется после глав: осталось ${left}`,
    finaleOpen: 'Испытание открыто',
    finaleWon: 'Испытание пройдено',
    back: 'Все операции',
    solved: 'Пройдено',
    next: 'Следующая',
  },
  kk: {
    title: 'Жәрмеңкеден кейінгі операциялар',
    lead: 'Алдияр, Аруна және Пификпен жаңа оқиғалар. Әрқайсысында төрт тарау және соңғы сынақ бар.',
    chapters: (done: number, ready: number) => `Өтілген тараулар: ${done} / ${ready}`,
    soon: 'Жақында',
    soonLong: 'Суреттерін дайындап жатырмыз — тарау жақында ашылады.',
    open: 'Ашу',
    start: 'Бастау',
    read: 'Оқу',
    chapter: (n: number) => `${n}-тарау`,
    finale: 'Финал',
    finaleLocked: (left: number) => `Тараулардан кейін ашылады: ${left} қалды`,
    finaleOpen: 'Сынақ ашық',
    finaleWon: 'Сынақ өтілді',
    back: 'Барлық операциялар',
    solved: 'Өтілді',
    next: 'Келесі',
  },
}

// Covers are season panels that do not spoil the finale; seasons without art show their icon.
const COVERS: Record<string, string> = { roads: roadsCover, lights: lightsCover, museum: museumCover }
const TINTS: Record<string, string> = {
  roads: 'from-emerald-200 to-sky-200',
  lights: 'from-indigo-300 to-amber-200',
  museum: 'from-amber-100 to-rose-200',
  weather: 'from-sky-200 to-slate-200',
  mars: 'from-orange-300 to-rose-300',
}
const CTA = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-[3px] border-ink px-4 font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

function Cover({ operation, className = '' }: { operation: Operation; className?: string }) {
  const src = COVERS[operation.id]
  return (
    <div aria-hidden className={`relative overflow-hidden bg-gradient-to-br ${TINTS[operation.id] ?? 'from-sky-200 to-sun/40'} ${className}`}>
      {src
        ? <img src={src} alt="" className="h-full w-full object-cover" />
        : <span className="absolute inset-0 grid place-items-center text-6xl">{operation.icon}</span>}
    </div>
  )
}

function progress(operation: Operation, completed: ReadonlySet<string>) {
  const ready = operation.chapters.filter((c) => c.comicId)
  const done = ready.filter((c) => completed.has(c.comicId!)).length
  return { ready: ready.length, done }
}

export function OperationsScreen({ lang, completed }: { lang: Lang; completed: ReadonlySet<string> }) {
  const c = COPY[lang]
  return (
    <section aria-labelledby="operations-title" className="flex flex-col gap-4">
      <div>
        <h1 id="operations-title" className="text-2xl font-black text-ink sm:text-3xl">{c.title}</h1>
        <p className="mt-1 font-semibold text-ink/85">{c.lead}</p>
      </div>
      <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {OPERATIONS.map((operation) => {
          const { ready, done } = progress(operation, completed)
          return (
            <li key={operation.id} className="flex flex-col overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]">
              <Cover operation={operation} className="aspect-[2/1] border-b-[3px] border-ink" />
              <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                <h2 className="text-lg leading-tight font-black text-ink"><span aria-hidden>{operation.icon} </span>{operation.title[lang]}</h2>
                <p className="flex-1 text-sm font-semibold text-ink/80">{operation.lead[lang]}</p>
                <p className="text-sm font-bold text-brand-dark">{ready ? c.chapters(done, ready) : c.soon}</p>
                <a href={operationHref(operation.id)} className={`${CTA} ${ready ? 'bg-sun' : 'bg-white'}`}>
                  {ready ? (done ? c.open : c.start) : c.open} <span aria-hidden>→</span>
                </a>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const MARKER = 'fair-route-marker grid size-8 place-items-center rounded-full border-[3px] border-ink text-sm font-black sm:size-9'

export function OperationScreen({ lang, operation, completed, finaleWon }: {
  lang: Lang
  operation: Operation
  completed: ReadonlySet<string>
  finaleWon: boolean
}) {
  const c = COPY[lang]
  const { ready, done } = progress(operation, completed)
  const next = operation.chapters.find((ch) => ch.comicId && !completed.has(ch.comicId))
  const left = operation.chapters.length - done
  const finaleOpen = !!operation.finale.href && left === 0

  return (
    <section aria-labelledby="operation-title" className="flex flex-col gap-4">
      <div>
        <a href={SECTION_HREFS.operations} className={`${CTA} bg-white`}><span aria-hidden>←</span> {c.back}</a>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,48rem)_minmax(15rem,20rem)]">
        <div className="flex max-w-3xl min-w-0 flex-col gap-4">
          <div>
            <h1 id="operation-title" className="text-2xl leading-tight font-black text-ink sm:text-3xl">
              <span aria-hidden>{operation.icon} </span>{operation.title[lang]}
            </h1>
            <p className="mt-1.5 font-semibold text-ink/85">{operation.lead[lang]}</p>
          </div>
          <div className="rounded-2xl border-[3px] border-ink bg-cream p-3 shadow-[0_5px_0_var(--color-ink)] sm:p-6">
            {ready > 0 && (
              <p className="mb-4 w-fit rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold">{c.chapters(done, ready)}</p>
            )}
            <ol className="fair-route-path list-none" role="list">
              {operation.chapters.map((chapter) => {
                const solved = !!chapter.comicId && completed.has(chapter.comicId)
                const isNext = chapter === next
                const body = (
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-tight font-bold">
                      <span className="tracking-wide text-ink/75 uppercase">{c.chapter(chapter.number)}</span>
                      <span className="rounded-full border border-ink/40 bg-sky/60 px-2 py-0.5">{chapter.math[lang]}</span>
                      {solved && <span className="text-emerald-800"><span aria-hidden>✓ </span>{c.solved}</span>}
                      {isNext && <span className="rounded-full bg-brand-dark px-2 py-0.5 text-white"><span aria-hidden>→ </span>{c.next}</span>}
                      {!chapter.comicId && <span className="rounded-full bg-ink/10 px-2 py-0.5">{c.soon}</span>}
                    </span>
                    <span className="mt-1 block text-[15px] leading-snug font-black sm:text-lg">{chapter.title[lang]}</span>
                    <span className="mt-0.5 block text-sm leading-snug font-semibold text-ink/75">{chapter.story[lang]}</span>
                  </span>
                )
                const card = 'flex min-h-16 items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-ink shadow-[0_2px_0_var(--color-ink)] sm:gap-4 sm:px-4'
                return (
                  <li key={chapter.number}>
                    <span aria-hidden className={`${MARKER} ${solved ? 'bg-emerald-300' : isNext ? 'bg-sun' : 'bg-white'}`}>{solved ? '✓' : chapter.number}</span>
                    {chapter.comicId ? (
                      <a href={comicHref(chapter.comicId)} aria-current={isNext ? 'step' : undefined}
                        className={`${card} transition hover:border-brand hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${isNext ? 'border-brand-dark bg-[#fff2bd]' : 'border-ink/60 bg-white'}`}>
                        {body}
                      </a>
                    ) : (
                      <div className={`${card} border-dashed border-ink/40 bg-white/60`}>{body}</div>
                    )}
                  </li>
                )
              })}
              <li>
                <span aria-hidden className={`${MARKER} ${finaleOpen ? 'bg-sun' : 'bg-white'}`}>{finaleWon ? '✓' : finaleOpen ? '★' : '🔒'}</span>
                {(() => {
                  const status = !operation.finale.href ? c.soon : finaleWon ? c.finaleWon : finaleOpen ? c.finaleOpen : c.finaleLocked(left)
                  const inner = (
                    <span className="min-w-0 flex-1">
                      <span className="text-xs font-bold tracking-wide text-ink/75 uppercase">{c.finale} · {operation.finale.math[lang]}</span>
                      <span className="mt-1 block text-lg leading-snug font-black">{operation.finale.title[lang]}</span>
                      <span className="mt-0.5 block text-sm font-semibold text-ink/75">{operation.finale.story[lang]}</span>
                      <span className="mt-1 block text-sm font-bold text-brand-dark">{status}</span>
                    </span>
                  )
                  const card = `flex min-h-20 items-center gap-2.5 rounded-2xl border-[3px] px-2.5 py-2 text-ink shadow-[0_2px_0_var(--color-ink)] sm:px-4 ${finaleOpen ? 'border-ink bg-sun/40' : 'border-dashed border-ink/60 bg-white'}`
                  return operation.finale.href
                    ? <a href={operation.finale.href} className={`${card} hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand`}>{inner}</a>
                    : <div className={card}>{inner}</div>
                })()}
              </li>
            </ol>
          </div>
        </div>

        <aside className="flex max-w-3xl flex-col gap-4 xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-2xl border-[3px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]">
            <Cover operation={operation} className="aspect-[2/1] border-b-[3px] border-ink" />
            <div className="flex flex-col gap-2 p-3 sm:p-4">
              {next ? (
                <>
                  <p className="text-xs font-black tracking-wide text-brand-dark uppercase">{c.chapter(next.number)}</p>
                  <p className="text-lg leading-tight font-black">{next.title[lang]}</p>
                  <a href={comicHref(next.comicId!)} className={`${CTA} bg-sun`}>{c.read} <span aria-hidden>→</span></a>
                </>
              ) : finaleOpen ? (
                <>
                  <p className="text-lg leading-tight font-black">{operation.finale.title[lang]}</p>
                  <a href={operation.finale.href} className={`${CTA} bg-sun`}>{c.open} <span aria-hidden>→</span></a>
                </>
              ) : (
                <p className="text-sm font-bold text-ink/80">{c.soonLong}</p>
              )}
            </div>
          </section>
          {operation.practice && (
            <a href={operation.practice.href} className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-white p-3 text-ink shadow-[0_4px_0_var(--color-ink)] hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <span aria-hidden className="text-2xl">🏁</span>
              <span className="min-w-0 flex-1">
                <span className="block font-black leading-tight">{operation.practice.title[lang]}</span>
                <span className="mt-0.5 block text-sm font-semibold text-ink/75">{operation.practice.lead[lang]}</span>
              </span>
              <span aria-hidden>→</span>
            </a>
          )}
        </aside>
      </div>
    </section>
  )
}
