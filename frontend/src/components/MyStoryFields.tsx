import { useId, type ReactNode } from 'react'
import { ART_MODE, type CastHeroId, type Lang, type StorySetting, type StoryStyle } from '../api'
import cartoonPreview from '../assets/story-styles/cartoon.webp'
import comicPreview from '../assets/story-styles/comic.webp'
import pixelPreview from '../assets/story-styles/pixel.webp'
import { CHARACTERS } from '../characters'
import { STRINGS } from '../i18n'
import {
  CAST_ORDER,
  SETTING_ICON,
  STORY_COPY,
  STORY_LIMITS,
  STORY_SETTINGS,
  STORY_STYLES,
  type StoryDraft,
  type StoryErrors,
} from '../myStory'
import { SheetCrop } from './SheetCrop'

const STYLE_PREVIEW: Record<StoryStyle, string> = { comic: comicPreview, cartoon: cartoonPreview, pixel: pixelPreview }

// Choice cards follow the 16px card / yellow + ✓ selection pattern.
const CHOICE =
  'group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-[3px] border-ink bg-white p-2 text-center font-black text-ink shadow-[0_3px_0_var(--color-ink)] transition select-none hover:bg-sky has-checked:translate-y-[2px] has-checked:bg-sun has-checked:shadow-[0_1px_0_var(--color-ink)] has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-default'
const CHECK = 'absolute top-1.5 right-1.5 hidden size-6 place-items-center rounded-full border-2 border-ink bg-white text-sm group-has-checked:grid'
const INPUT =
  'min-h-11 w-full min-w-0 rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold text-ink placeholder:font-normal placeholder:text-ink/50 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand aria-invalid:border-rose-600'

function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-base font-black text-ink">{title}</legend>
      {children}
      {note && <p className="mt-2 text-sm font-semibold text-ink/80">{note}</p>}
    </fieldset>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="mt-1 text-sm font-bold text-rose-700">{message}</p>
}

export function MyStoryFields({ lang, draft, onChange, errors }: {
  lang: Lang
  draft: StoryDraft
  onChange: (next: StoryDraft) => void
  errors: StoryErrors
}) {
  const t = STRINGS[lang]
  const c = STORY_COPY[lang]
  const id = useId()
  const set = (patch: Partial<StoryDraft>) => onChange({ ...draft, ...patch })
  const errorText = (key: string) => (errors[key] ? c.errors[errors[key]!] : undefined)

  function toggleHero(hero: CastHeroId) {
    if (hero === 'pifik') return
    set({ heroes: draft.heroes.includes(hero) ? draft.heroes.filter((h) => h !== hero) : [...draft.heroes, hero] })
  }

  function updateCustom(index: number, patch: Partial<StoryDraft['customHeroes'][number]>) {
    set({ customHeroes: draft.customHeroes.map((h, i) => (i === index ? { ...h, ...patch } : h)) })
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="font-semibold text-ink/85">{c.lead}</p>

      <Section title={c.heroesTitle}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {CAST_ORDER.map((hero) => (
            <label key={hero} className={CHOICE}>
              <input
                type="checkbox"
                className="sr-only"
                checked={draft.heroes.includes(hero)}
                disabled={hero === 'pifik'}
                onChange={() => toggleHero(hero)}
              />
              <span aria-hidden className={CHECK}>✓</span>
              <SheetCrop rect={CHARACTERS[hero].portrait} className="w-full max-w-24 rounded-xl border-2 border-ink/40 bg-white" />
              <span className="text-sm sm:text-base">{t.cast[hero].name}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm font-semibold text-ink/80">{c.pifikAlways}</p>

        <ul className="mt-3 flex flex-col gap-3">
          {draft.customHeroes.map((hero, index) => {
            const nameId = `${id}-hero-${index}-name`
            const descriptionId = `${id}-hero-${index}-description`
            return (
              <li key={index} className="rounded-2xl border-[3px] border-ink bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-black text-ink"><span aria-hidden>🌟 </span>{c.heroN(index + 1)}</p>
                  <button
                    type="button"
                    onClick={() => set({ customHeroes: draft.customHeroes.filter((_, i) => i !== index) })}
                    className="min-h-9 rounded-lg border-2 border-ink/50 px-2.5 text-sm font-bold text-ink hover:bg-rose-50"
                  >
                    {c.removeHero}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div className="min-w-0">
                    <label htmlFor={nameId} className="mb-1 block text-sm font-black text-ink/80">{c.heroName}</label>
                    <input
                      id={nameId}
                      value={hero.name}
                      maxLength={STORY_LIMITS.heroName}
                      placeholder={c.heroNamePlaceholder}
                      aria-invalid={!!errors[`hero-${index}-name`] || undefined}
                      aria-describedby={errors[`hero-${index}-name`] ? `${nameId}-error` : undefined}
                      onChange={(e) => updateCustom(index, { name: e.target.value })}
                      className={INPUT}
                    />
                    <FieldError id={`${nameId}-error`} message={errorText(`hero-${index}-name`)} />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={descriptionId} className="mb-1 block text-sm font-black text-ink/80">{c.heroDescription}</label>
                    <input
                      id={descriptionId}
                      value={hero.description}
                      maxLength={STORY_LIMITS.heroDescription}
                      placeholder={c.heroDescriptionPlaceholder}
                      aria-invalid={!!errors[`hero-${index}-description`] || undefined}
                      aria-describedby={errors[`hero-${index}-description`] ? `${descriptionId}-error` : undefined}
                      onChange={(e) => updateCustom(index, { description: e.target.value })}
                      className={INPUT}
                    />
                    <FieldError id={`${descriptionId}-error`} message={errorText(`hero-${index}-description`)} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {draft.customHeroes.length < STORY_LIMITS.customHeroes ? (
          <button
            type="button"
            onClick={() => set({ customHeroes: [...draft.customHeroes, { name: '', description: '' }] })}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-[3px] border-dashed border-ink/60 bg-white px-4 font-black text-ink hover:border-ink hover:bg-sky"
          >
            <span aria-hidden className="text-lg leading-none">+</span>{c.addHero}
          </button>
        ) : (
          <p className="mt-3 text-sm font-semibold text-ink/80">{c.heroLimit}</p>
        )}
        {draft.customHeroes.length > 0 && <p className="mt-2 text-sm font-semibold text-ink/80">{c.customHeroNote}</p>}
      </Section>

      <Section title={c.styleTitle} note={ART_MODE === 'prepared' ? c.preparedStyleNote : undefined}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {STORY_STYLES.map((style) => (
            <label key={style} className={CHOICE}>
              <input type="radio" name={`${id}-style`} className="sr-only" checked={draft.style === style} onChange={() => set({ style })} />
              <span aria-hidden className={CHECK}>✓</span>
              <img src={STYLE_PREVIEW[style]} alt="" className={`aspect-[4/3] w-full rounded-xl border-2 border-ink/40 object-cover ${style === 'pixel' ? '[image-rendering:pixelated]' : ''}`} />
              <span className="text-sm leading-tight sm:text-base">{c.styles[style]}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title={c.settingTitle}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {STORY_SETTINGS.map((setting: StorySetting) => (
            <label key={setting} className={`${CHOICE} min-h-24 justify-center`}>
              <input type="radio" name={`${id}-setting`} className="sr-only" checked={draft.setting === setting} onChange={() => set({ setting })} />
              <span aria-hidden className={CHECK}>✓</span>
              <span aria-hidden className="text-3xl">{SETTING_ICON[setting]}</span>
              <span className="text-sm leading-tight sm:text-base">{c.settings[setting]}</span>
            </label>
          ))}
        </div>
        {draft.setting === 'custom' && (
          <div className="mt-3">
            <label htmlFor={`${id}-custom-setting`} className="mb-1 block text-sm font-black text-ink/80">{c.customSettingLabel}</label>
            <input
              id={`${id}-custom-setting`}
              value={draft.customSetting}
              maxLength={STORY_LIMITS.customSetting}
              placeholder={c.customSettingPlaceholder}
              aria-invalid={!!errors.customSetting || undefined}
              aria-describedby={errors.customSetting ? `${id}-custom-setting-error` : undefined}
              onChange={(e) => set({ customSetting: e.target.value })}
              className={INPUT}
            />
            <FieldError id={`${id}-custom-setting-error`} message={errorText('customSetting')} />
          </div>
        )}
      </Section>

      <Section title={c.premiseTitle}>
        <label htmlFor={`${id}-premise`} className="sr-only">{c.premiseTitle}</label>
        <textarea
          id={`${id}-premise`}
          value={draft.premise}
          rows={3}
          maxLength={STORY_LIMITS.premise}
          placeholder={c.premisePlaceholder}
          aria-invalid={!!errors.premise || undefined}
          aria-describedby={`${id}-premise-note${errors.premise ? ` ${id}-premise-error` : ''}`}
          onChange={(e) => set({ premise: e.target.value })}
          className={`${INPUT} resize-y leading-snug`}
        />
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <p id={`${id}-premise-note`} className="text-sm font-semibold text-ink/80">{c.premiseNote}</p>
          <p className="text-sm font-bold text-ink/70 tabular-nums" aria-hidden>{draft.premise.length} / {STORY_LIMITS.premise}</p>
        </div>
        <FieldError id={`${id}-premise-error`} message={errorText('premise')} />
      </Section>
    </div>
  )
}
