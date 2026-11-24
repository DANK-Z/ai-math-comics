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
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border-[3px] border-ink bg-white p-4 shadow-[0_4px_0_var(--shadow-ink)] sm:p-6">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-black text-ink"><span aria-hidden>📘</span>{copy.title}</h2>
      <p className="mt-1 text-sm font-semibold text-ink/80">{copy.lead}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {sorted.map((group) => (
          <div key={`${group.grade}-${group.section}`} className="rounded-xl border-2 border-ink/20 bg-sky-50 p-3">
            <h3 className="text-sm font-black text-ink">
              <span className="mr-1.5 rounded-md bg-ink px-1.5 py-0.5 text-xs text-white">{copy.grade(group.grade)}</span>
              {group.section}
            </h3>
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
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/65">{copy.note}</p>
    </section>
  )
}
