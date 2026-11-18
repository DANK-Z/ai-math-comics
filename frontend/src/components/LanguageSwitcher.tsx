import { LANGS, type Lang } from '../api'
import { STRINGS } from '../i18n'

export function LanguageSwitcher({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label={STRINGS[lang].langLabel}
      className="inline-flex rounded-full border-[3px] border-ink bg-white p-1 shadow-[0_3px_0_var(--color-ink)]"
    >
      {LANGS.map((l) => {
        const active = l === lang
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l}
            onClick={() => onChange(l)}
            className={`min-h-9 rounded-full px-2.5 text-sm sm:px-3 font-black transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sun ${
              active ? 'bg-brand-dark text-white' : 'text-ink hover:bg-sky'
            }`}
          >
            <span className="sm:hidden" aria-hidden>
              {STRINGS[l].langShort}
            </span>
            <span className="sr-only sm:not-sr-only">{STRINGS[l].langName}</span>
          </button>
        )
      })}
    </div>
  )
}
