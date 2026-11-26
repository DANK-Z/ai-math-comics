import { useId } from 'react'
import { LOCAL_COMICS, type Lang } from '../api'
import { CURRICULUM, CURRICULUM_COPY } from '../curriculum'
import { comicHref } from '../route'

const PIZZA_TITLE = { ru: 'Пицца для четырёх друзей', kk: 'Төрт досқа арналған пицца' }

export function chapterTitle(comicId: string, lang: Lang) {
  return LOCAL_COMICS.find((d) => d.id === comicId)?.text[lang].title ?? (comicId === 'pizza-fractions' ? PIZZA_TITLE[lang] : comicId)
}

/** Teacher's class page: the bundled chapters grouped by grade and course section. */
export function CurriculumCard({ lang }: { lang: Lang }) {
  const copy = CURRICULUM_COPY[lang]
  const id = useId()
  const groups = new Map<string, { grade: number; section: string; items: { comicId: string; goal: string }[] }>()
  for (const [comicId, goal] of Object.entries(CURRICULUM)) {
    const key = `${goal.grade}|${goal.section[lang]}`
    const group = groups.get(key) ?? { grade: goal.grade, section: goal.section[lang], items: [] }
    group.items.push({ comicId, goal: goal.goal[lang] })
    groups.set(key, group)
  }
  const sorted = [...groups.values()].sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section, lang))
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-5">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📘</span>{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      <div className="mt-3 grid items-start gap-2 md:grid-cols-2">
        {sorted.map((group) => (
          <details key={`${group.grade}-${group.section}`} className="group rounded-xl border-2 border-ink/20 bg-sky-50 px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-black text-ink [&::-webkit-details-marker]:hidden">
              <span className="rounded-md bg-ink px-1.5 py-0.5 text-xs text-white">{copy.grade(group.grade)}</span>
              <span className="min-w-0 flex-1">{group.section}</span>
              <span className="text-xs font-bold text-ink/60">{group.items.length}</span>
              <span aria-hidden className="transition group-open:rotate-90">›</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {group.items.map((item) => (
                <li key={item.comicId} className="text-sm leading-snug">
                  <a href={comicHref(item.comicId)} className="font-black text-brand-dark underline decoration-2 underline-offset-2 hover:text-ink">
                    {chapterTitle(item.comicId, lang)}
                  </a>
                  <span className="font-semibold text-ink/75"> — {item.goal}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/65">{copy.note}</p>
    </section>
  )
}
