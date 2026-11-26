import type { ChildSummary, Lang } from '../api'
import { skillCopy } from '../accountCopy'
import { OPERATIONS } from '../operations'

// «Сводка Пифика» as a picture: four tiles with big numbers and small bars, then the skills the
// child is good at (green) and the one to work on (amber). Only the child's real data is shown:
// nothing is a target or a grade made up for the parent.

const STORY_CHAPTERS = OPERATIONS.reduce((sum, operation) => sum + operation.chapters.length, 0)

const COPY = {
  ru: {
    title: 'Сводка Пифика',
    lead: 'Последние 30 дней — по ответам ребёнка в игре.',
    noData: 'В этом месяце ребёнок ещё не играл. Предложите начать со следующей главы на главной — это минут десять.',
    chapters: 'Глав за месяц',
    chaptersSub: (total: number) => `всего пройдено ${total} из ${STORY_CHAPTERS}`,
    bosses: 'Побед над боссами',
    bossesSub: (clean: number) => (clean ? `без единой ошибки: ${clean}` : 'пока с ошибками — это нормально'),
    drills: 'Тренировок за неделю',
    drillsSub: (n: number) => (n ? 'повторял слабые места' : 'на этой неделе не было'),
    homework: 'Домашние задания',
    homeworkDone: 'всё сделано',
    homeworkOpen: (open: number, overdue: number) => `не сделано: ${open}${overdue ? `, просрочено: ${overdue}` : ''}`,
    good: 'Хорошо получается',
    goodEmpty: 'Пока мало ответов, чтобы сказать точно.',
    work: 'Над чем поработать',
    workMistakes: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ошибка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ошибки' : 'ошибок'} за месяц`,
    workNote: 'Обычная трудность 5–6 класса. Пифик даёт к ней подсказки, а в игре уже предложена тренировка.',
    workNone: 'Заметных трудностей нет.',
  },
  kk: {
    title: 'Пификтің шолуы',
    lead: 'Соңғы 30 күн — баланың ойындағы жауаптары бойынша.',
    noData: 'Бала бұл айда әлі ойнаған жоқ. Басты беттегі келесі тараудан бастауды ұсыныңыз — он минуттай.',
    chapters: 'Айдағы тараулар',
    chaptersSub: (total: number) => `барлығы ${STORY_CHAPTERS}-ден ${total} өтілді`,
    bosses: 'Босстарды жеңу',
    bossesSub: (clean: number) => (clean ? `бір де қатесіз: ${clean}` : 'әзірге қателермен — бұл қалыпты'),
    drills: 'Аптадағы жаттығулар',
    drillsSub: (n: number) => (n ? 'әлсіз тұстарын қайталады' : 'осы аптада болмады'),
    homework: 'Үй тапсырмалары',
    homeworkDone: 'бәрі орындалды',
    homeworkOpen: (open: number, overdue: number) => `орындалмаған: ${open}${overdue ? `, мерзімі өткен: ${overdue}` : ''}`,
    good: 'Жақсы шығады',
    goodEmpty: 'Нақты айту үшін жауаптар әзірге аз.',
    work: 'Неге көңіл бөлу керек',
    workMistakes: (n: number) => `айына ${n} қате`,
    workNote: '5–6-сыныптың әдеттегі қиындығы. Пифик оған кеңес береді, ал ойында жаттығу ұсынылған.',
    workNone: 'Байқалатын қиындық жоқ.',
  },
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const share = max > 0 ? Math.min(1, value / max) : 0
  return (
    <span aria-hidden className="mt-1 block h-2.5 overflow-hidden rounded-full border border-ink/30 bg-ink/10">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(share * 100, value > 0 ? 6 : 0)}%` }} />
    </span>
  )
}

function Tile({ icon, label, value, sub, tone, children }: {
  icon: string
  label: string
  value: string | number
  sub: string
  tone: string
  children?: React.ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border-[3px] border-ink p-3 ${tone}`}>
      <dt className="flex items-start gap-1.5 text-sm leading-tight font-bold text-ink/80"><span aria-hidden>{icon}</span>{label}</dt>
      <dd className="mt-1">
        <span className="block text-3xl leading-none font-black text-ink">{value}</span>
        <span className="mt-1 block text-xs font-bold text-ink/70">{sub}</span>
        {children}
      </dd>
    </div>
  )
}

export function ParentSummary({ child, lang }: { child: ChildSummary; lang: Lang }) {
  const c = COPY[lang]
  const name = (key: string) => skillCopy(lang, key)?.name ?? key
  const quiet = !child.chaptersMonth && !child.bossWins && !child.drillsWeek
  const overdue = child.homeworkOverdue > 0
  return (
    <section aria-labelledby={`summary-${child.id}`} className="rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-5">
      <h3 id={`summary-${child.id}`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>🤖</span>{c.title}</h3>
      <p className="text-sm font-semibold text-ink/65">{c.lead}</p>
      {quiet && <p className="mt-3 rounded-xl border-2 border-dashed border-ink/40 bg-cream px-3 py-2 font-semibold text-ink">{c.noData}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Tile icon="📖" label={c.chapters} value={child.chaptersMonth} sub={c.chaptersSub(child.chaptersTotal)} tone="bg-sky/50">
          <Bar value={child.chaptersTotal} max={STORY_CHAPTERS} tone="bg-brand" />
        </Tile>
        <Tile icon="⚔️" label={c.bosses} value={child.bossWins} sub={c.bossesSub(child.cleanWins)} tone="bg-violet-50">
          <Bar value={child.cleanWins} max={child.bossWins} tone="bg-violet-500" />
        </Tile>
        <Tile icon="🏋️" label={c.drills} value={child.drillsWeek} sub={c.drillsSub(child.drillsWeek)} tone="bg-sun/30" />
        {child.className && (
          <Tile icon="📚" label={c.homework} value={child.homeworkOpen ? child.homeworkOpen : '✓'}
            sub={child.homeworkOpen ? c.homeworkOpen(child.homeworkOpen, child.homeworkOverdue) : c.homeworkDone}
            tone={overdue ? 'bg-rose-100' : child.homeworkOpen ? 'bg-amber-50' : 'bg-emerald-50'} />
        )}
      </dl>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-emerald-700/50 bg-emerald-50 p-3">
          <p className="text-sm font-black text-emerald-900">{c.good}</p>
          {child.strengths.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {child.strengths.map((skill) => (
                <li key={skill} className="rounded-full border-2 border-emerald-700 bg-white px-2.5 py-0.5 text-sm font-bold text-emerald-900">✓ {name(skill)}</li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm font-semibold text-ink/70">{c.goodEmpty}</p>}
        </div>
        <div className={`rounded-2xl border-2 p-3 ${child.weakSkill ? 'border-amber-600/60 bg-amber-50' : 'border-ink/20 bg-cream'}`}>
          <p className={`text-sm font-black ${child.weakSkill ? 'text-amber-900' : 'text-ink/80'}`}>{c.work}</p>
          {child.weakSkill ? (
            <>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border-2 border-amber-600 bg-white px-2.5 py-0.5 text-sm font-bold text-amber-900">⚠ {skillCopy(lang, child.weakSkill)?.review ?? child.weakSkill}</span>
                <span className="text-xs font-bold text-amber-900/80">{c.workMistakes(child.weakMistakes)}</span>
              </p>
              <p className="mt-1.5 text-xs font-semibold text-ink/70">{c.workNote}</p>
            </>
          ) : <p className="mt-1 text-sm font-semibold text-ink/70">{c.workNone}</p>}
        </div>
      </div>
    </section>
  )
}
