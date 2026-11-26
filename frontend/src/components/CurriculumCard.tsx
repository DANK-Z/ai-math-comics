import { useCallback, useId, useState } from 'react'
import { accounts, LOCAL_COMICS, type Lang } from '../api'
import { CURRICULUM, CURRICULUM_COPY, curriculumFor } from '../curriculum'
import { printSheet } from '../print'
import { comicHref } from '../route'
import { useLoaded } from '../usePolled'

const PIZZA_TITLE = { ru: 'Пицца для четырёх друзей', kk: 'Төрт досқа арналған пицца' }

export function chapterTitle(comicId: string, lang: Lang) {
  return LOCAL_COMICS.find((d) => d.id === comicId)?.text[lang].title ?? (comicId === 'pizza-fractions' ? PIZZA_TITLE[lang] : comicId)
}

const COPY = {
  ru: {
    codes: 'Коды целей',
    codesHint: 'например 5.1.2.1; 5.1.2.3',
    saved: 'Сохранено',
    print: '🖨 Печать',
    printTitle: (t: string) => `Глава «${t}»`,
    task: 'Задание',
    answerLine: 'Ответ: ____________',
    teacherAnswer: (a: number) => `Ответ для учителя: ${a}`,
    goal: 'Цель обучения',
    codesLine: (c: string) => `Коды целей обучения: ${c}`,
    note: 'Впишите коды целей обучения из своего КТП — они появятся на печати и в запуске урока.',
    error: 'Не сохранилось',
  },
  kk: {
    codes: 'Мақсат кодтары',
    codesHint: 'мысалы 5.1.2.1; 5.1.2.3',
    saved: 'Сақталды',
    print: '🖨 Басып шығару',
    printTitle: (t: string) => `«${t}» тарауы`,
    task: 'Тапсырма',
    answerLine: 'Жауабы: ____________',
    teacherAnswer: (a: number) => `Мұғалімге арналған жауап: ${a}`,
    goal: 'Оқу мақсаты',
    codesLine: (c: string) => `Оқу мақсаттарының кодтары: ${c}`,
    note: 'Өз ҚТЖ-ңыздан оқу мақсаттарының кодтарын жазыңыз — олар басып шығаруда және сабақты бастауда көрсетіледі.',
    error: 'Сақталмады',
  },
}

/** Print one chapter: its four panels with the dialogue, the task with an answer line, and the codes. */
export function printChapter(comicId: string, lang: Lang, codes?: string) {
  const def = LOCAL_COMICS.find((d) => d.id === comicId)
  if (!def) return
  const c = COPY[lang]
  const text = def.text[lang]
  const goal = curriculumFor(comicId)
  printSheet(c.printTitle(text.title), [
    { kind: 'h1', text: text.title },
    ...(goal ? [{ kind: 'p' as const, text: `${CURRICULUM_COPY[lang].grade(goal.grade)} · ${goal.section[lang]}. ${c.goal}: ${goal.goal[lang]}` }] : []),
    ...(codes ? [{ kind: 'small' as const, text: c.codesLine(codes) }] : []),
    { kind: 'panels', items: def.panels.map((p, i) => ({ image: p.image, caption: `${p.speaker}: ${text.dialogue[i]}` })) },
    { kind: 'h2', text: c.task },
    { kind: 'p', text: text.prompt },
    { kind: 'p', text: c.answerLine },
    { kind: 'small', text: c.teacherAnswer(def.answer) },
  ])
}

function CodesInput({ comicId, initial, lang, onSaved }: { comicId: string; initial: string; lang: Lang; onSaved: (codes: Record<string, string>) => void }) {
  const c = COPY[lang]
  const id = useId()
  const [value, setValue] = useState(initial)
  const [status, setStatus] = useState<'saved' | 'error' | null>(null)
  async function save() {
    if (value.trim() === initial) return
    try {
      onSaved(await accounts.setObjectiveCodes(comicId, value))
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <label htmlFor={id} className="text-xs font-black text-ink/70">{c.codes}</label>
      <input id={id} value={value} maxLength={120} placeholder={c.codesHint} onChange={(e) => { setValue(e.target.value); setStatus(null) }} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="min-h-8 w-44 rounded-lg border-2 border-ink/40 bg-white px-2 font-mono text-xs font-bold text-ink focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-sun" />
      {status && <span role="status" className={`text-xs font-bold ${status === 'saved' ? 'text-emerald-700' : 'text-rose-700'}`}>{status === 'saved' ? c.saved : c.error}</span>}
    </span>
  )
}

/** Teacher's class page: the bundled chapters grouped by grade and course section. */
export function CurriculumCard({ lang }: { lang: Lang }) {
  const copy = CURRICULUM_COPY[lang]
  const c = COPY[lang]
  const id = useId()
  const { value: codes, setValue: setCodes } = useLoaded(useCallback((s: AbortSignal) => accounts.objectiveCodes(s), []))
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
            <ul className="mt-2 flex flex-col gap-2.5">
              {group.items.map((item) => (
                <li key={item.comicId} className="text-sm leading-snug">
                  <a href={comicHref(item.comicId)} className="font-black text-brand-dark underline decoration-2 underline-offset-2 hover:text-ink">
                    {chapterTitle(item.comicId, lang)}
                  </a>
                  <span className="font-semibold text-ink/75"> — {item.goal}</span>
                  {codes && (
                    <span className="flex flex-wrap items-center gap-2">
                      <CodesInput comicId={item.comicId} initial={codes[item.comicId] ?? ''} lang={lang} onSaved={setCodes} />
                      {LOCAL_COMICS.some((d) => d.id === item.comicId) && (
                        <button type="button" onClick={() => printChapter(item.comicId, lang, codes[item.comicId])} className="mt-1 rounded-lg border-2 border-ink/40 bg-white px-2 py-0.5 text-xs font-black text-ink hover:bg-sky">{c.print}</button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/65">{codes ? c.note : copy.note}</p>
    </section>
  )
}
