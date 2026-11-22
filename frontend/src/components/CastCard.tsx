import type { Lang } from '../api'
import { CAST, CHARACTERS, characterFor } from '../characters'
import { STRINGS } from '../i18n'
import { SheetCrop } from './SheetCrop'
import { PifikSprite } from './PifikSprite'

/** The three heroes from the style sheet; highlights whoever speaks in the current panel. */
export function CastCard({ lang, activeSpeaker, compact }: { lang: Lang; activeSpeaker: string; compact: boolean }) {
  const t = STRINGS[lang]
  const active = characterFor(activeSpeaker)?.id

  return (
    <section className="rounded-[28px] border-[3px] border-ink/10 bg-white p-4 shadow-[0_10px_30px_rgb(36_57_159/0.12)]">
      <h2 className="mb-3 inline-block rounded-full bg-brand px-4 py-1 text-sm font-black text-white">{t.castTitle}</h2>
      <ul className={compact ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3'}>
        {CAST.map((id) => {
          const c = CHARACTERS[id]
          const info = t.cast[id]
          const on = active === id
          return (
            <li
              key={id}
              className={`flex flex-col items-center gap-2 rounded-2xl border-[3px] p-2 text-center transition ${
                compact ? '' : 'lg:flex-row lg:text-left'
              } ${on ? 'border-ink bg-sun/25' : 'border-transparent bg-sky'}`}
            >
              {id === 'pifik' ? (
                <PifikSprite
                  rect={c.portrait}
                  className={`w-full max-w-[96px] shrink-0 rounded-xl border-[3px] border-ink bg-white ${compact ? '' : 'lg:w-20'}`}
                />
              ) : (
                <SheetCrop
                  rect={c.portrait}
                  className={`w-full max-w-[96px] shrink-0 rounded-xl border-[3px] border-ink bg-white ${compact ? '' : 'lg:w-20'}`}
                />
              )}
              <div className="min-w-0">
                <p className="leading-tight font-black text-ink">
                  <span className={`mr-1 inline-block rounded-md px-1.5 ${c.tag}`}>{info.name}</span>
                </p>
                <p className="mt-0.5 text-xs font-extrabold text-ink/70">{info.role}</p>
                {!compact && <p className="mt-1 hidden text-sm leading-snug text-ink/80 lg:block">{info.about}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
