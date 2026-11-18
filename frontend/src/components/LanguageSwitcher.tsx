import { LANGS, type Lang } from '../api'
import { STRINGS } from '../i18n'

export function LanguageSwitcher({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label={STRINGS[lang].langLabel} className="inline-flex rounded-full border-2 border-stone-900 bg-white p-1 shadow-[3px_3px_0_#1c1917]">
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
            className={`rounded-full px-3 py-1 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
              active ? 'bg-stone-900 text-amber-50' : 'text-stone-700 hover:bg-amber-100'
            }`}
          >
            {STRINGS[l].langName}
          </button>
        )
      })}
    </div>
  )
}
