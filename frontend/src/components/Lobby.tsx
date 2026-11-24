import { useState } from 'react'
import { accounts, type Lang, type LobbyStudent } from '../api'

// The lobby on a class board (battle or lesson): who is in right now, in order of arrival.
// «Убрать» takes a student out of the class — for a joke name or a stranger with the QR.

const COPY = {
  ru: {
    title: (n: number) => `Подключились: ${n}`,
    empty: 'Ждём первых учеников…',
    remove: (name: string) => `Убрать ${name} из класса`,
    confirm: (name: string) => `Убрать «${name}» из класса? Он потеряет доступ к доске, батлам и заданиям класса. Аккаунт останется.`,
    error: 'Не получилось убрать. Попробуйте ещё раз.',
  },
  kk: {
    title: (n: number) => `Қосылғандар: ${n}`,
    empty: 'Алғашқы оқушыларды күтеміз…',
    remove: (name: string) => `${name} оқушысын сыныптан шығару`,
    confirm: (name: string) => `«${name}» сыныптан шығарылсын ба? Ол тақтаға, шайқастарға және сынып тапсырмаларына кіре алмайды. Аккаунт сақталады.`,
    error: 'Шығару мүмкін болмады. Қайта көріңіз.',
  },
}

export function Lobby({ classId, present, lang, dark = false }: { classId: number; present: LobbyStudent[]; lang: Lang; dark?: boolean }) {
  const copy = COPY[lang]
  const [removed, setRemoved] = useState<number[]>([])
  const [error, setError] = useState(false)
  const shown = present.filter((p) => !removed.includes(p.id))

  async function remove(student: LobbyStudent) {
    if (!window.confirm(copy.confirm(student.name))) return
    setError(false)
    try {
      // Demo classmates (negative ids) only disappear from this board.
      if (student.id > 0) await accounts.removeStudent(classId, student.id)
      setRemoved((ids) => [...ids, student.id])
    } catch {
      setError(true)
    }
  }

  return (
    <section aria-live="polite" className={`rounded-2xl border-[3px] border-ink p-3 ${dark ? 'bg-white/10 text-white' : 'bg-white text-ink'}`}>
      <h2 className="text-lg font-black">👥 {copy.title(shown.length)}</h2>
      {shown.length === 0 ? <p className="mt-1 text-sm font-semibold opacity-75">{copy.empty}</p> : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {shown.map((s) => (
            <li key={s.id} className="boss-enter flex items-center gap-1 rounded-full border-2 border-ink bg-sun py-0.5 pr-1 pl-2.5 text-sm font-black text-ink">
              {s.name}
              <button type="button" onClick={() => remove(s)} aria-label={copy.remove(s.name)} title={copy.remove(s.name)}
                className="grid size-6 place-items-center rounded-full text-base leading-none hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-brand">
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-1 text-sm font-bold text-rose-700">{copy.error}</p>}
    </section>
  )
}
