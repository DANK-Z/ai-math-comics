import { useEffect, useId, useRef, useState } from 'react'
import type { Lang } from '../api/types'
import type { UiStrings } from '../i18n'
import { SECTION_HREFS, type Section } from '../route'
import { SCHOOL_FAIR_CHAPTER_COUNT } from '../schoolFair'
import { OPERATIONS } from '../operations'

const NAV = {
  ru: {
    home: 'Главная',
    homeDetail: 'Что делать сейчас',
    stories: 'Истории',
    myClass: 'Мой класс',
    myClassDetail: 'Уроки, батлы, лига',
    storiesDetail: (n: number, total: number) => (n ? `Глав пройдено: ${n} из ${total}` : `${SEASONS} сезонов, ${total} глав`),
  },
  kk: {
    home: 'Басты бет',
    homeDetail: 'Қазір не істеу керек',
    stories: 'Оқиғалар',
    myClass: 'Менің сыныбым',
    myClassDetail: 'Сабақ, шайқас, лига',
    storiesDetail: (n: number, total: number) => (n ? `Өтілген тараулар: ${total}-ден ${n}` : `${SEASONS} маусым, ${total} тарау`),
  },
}
const SEASONS = OPERATIONS.length
const STORY_CHAPTERS = OPERATIONS.reduce((sum, operation) => sum + operation.chapters.length, 0)

interface Props {
  t: UiStrings
  active: Section
  completed: number
  remaining: number
  /** The School Fair finale (the arch keeper) was completed. */
  guardianWon: boolean
  /** Saved generated comics in this browser. */
  myComics: number
  /** Chapters solved across the operations after the fair. */
  operationsDone: number
  /** The student's class, shown under «Мой класс». */
  className?: string | null
  lang: Lang
}

/**
 * One entry per season plus the student's own things. Finales live inside their season
 * (the fair route, the operation pages), so they are not separate menu entries.
 */
function SectionLinks({ t, active, completed, myComics, operationsDone, className, lang, onSelect }: Props & { onSelect?: () => void }) {
  const id = useId()
  const links = [
    { section: 'map', icon: '🏠', label: NAV[lang].home, detail: NAV[lang].homeDetail },
    { section: 'operations', icon: '📚', label: NAV[lang].stories, detail: NAV[lang].storiesDetail(operationsDone, STORY_CHAPTERS) },
    { section: 'myClass', icon: '👥', label: NAV[lang].myClass, detail: className ?? NAV[lang].myClassDetail },
    { section: 'myComics', icon: '🖍️', label: t.myComics.title, detail: myComics > 0 ? t.myComics.count(myComics) : undefined },
    { section: 'backpack', icon: '🎒', label: t.backpack.title, detail: t.backpack.progress(completed, SCHOOL_FAIR_CHAPTER_COUNT) },
    { section: 'create', icon: '✨', label: t.createOwn },
  ] satisfies { section: Section; icon: string; label: string; detail?: string }[]

  return (
    <nav aria-label={t.navigation.label}>
      <ul role="list" className="grid gap-2">
        {links.map(({ section, icon, label, detail }) => (
          <li key={section}>
            <a
              href={SECTION_HREFS[section]}
              onClick={onSelect}
              aria-label={label}
              aria-describedby={detail ? `${id}-${section}` : undefined}
              aria-current={section === active ? 'page' : undefined}
              className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-transparent px-3 py-2.5 leading-tight text-ink hover:bg-sky focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[current=page]:border-ink aria-[current=page]:bg-sun"
            >
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg border border-ink/35 bg-white text-base">{icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black">{label}</span>
                {detail && <span id={`${id}-${section}`} className="mt-1 block text-[13px] leading-snug font-semibold text-ink/90">{detail}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function DesktopNavigation(props: Props) {
  return (
    <div className="sticky top-5 hidden self-start rounded-2xl border-2 border-ink bg-cream p-3 shadow-[0_4px_0_var(--shadow-ink)] lg:block">
      <SectionLinks {...props} />
    </div>
  )
}

export function MobileNavigation(props: Props) {
  const { t } = props
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    dialog.current?.close()
  }, [props.active])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)')
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close() }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <div className="lg:hidden">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
          closeButton.current?.focus()
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-cream px-3 text-sm font-black shadow-[0_2px_0_var(--shadow-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden className="text-lg leading-none">☰</span>{t.navigation.menu}
      </button>
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false)
          trigger.current?.focus({ preventScroll: true })
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[calc(100%_-_2rem)] overflow-y-auto border-r-[3px] border-ink bg-cream p-3 text-ink backdrop:bg-ink/50"
      >
        <div className="mb-3 flex items-center justify-between gap-2 border-b-2 border-ink/15 pb-2">
          <h2 id={`${id}-title`} className="text-lg font-black">{t.navigation.menu}</h2>
          <button
            ref={closeButton}
            type="button"
            aria-label={t.navigation.close}
            onClick={() => dialog.current?.close()}
            className="grid size-11 place-items-center rounded-xl border-2 border-ink bg-white text-xl font-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <SectionLinks {...props} onSelect={() => dialog.current?.close()} />
      </dialog>
    </div>
  )
}
