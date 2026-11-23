import type { CheckResponse, CheckStatus, Comic, HintResponse, HintStep, Lang, StorySetting } from './types'

// Comics bundled with the frontend (artwork + text + answer checking), so they are
// readable without the backend's generator. Every one has four panels with the
// exercise on panel 3; panel 4 (the ending) stays locked until the answer is correct.

export interface LocalComicText {
  title: string
  /** Catalog story hook. */
  hook: string
  /** One line per panel, in panel order. */
  dialogue: [string, string, string, string]
  /** Exercise prompt; keeps the units visible. */
  prompt: string
  hints: [string, string]
  feedback: Record<CheckStatus, string>
  commonMistakes?: Readonly<Partial<Record<number, string>>>
}

export interface LocalComicDef {
  id: string
  exerciseId: string
  /** Panels without `image` show a placeholder scene until their artwork is ready. */
  panels: { image?: string; speaker: string }[]
  /** Width / height of the panel artwork. */
  imageAspect: number
  exercisePanelId: number
  /** Placeholder scene for panels that have no artwork yet. */
  placeholder?: StorySetting
  /** Whole-number answer. */
  answer: number
  text: Record<Lang, LocalComicText>
}

export function buildLocalComic(def: LocalComicDef, lang: Lang): Comic {
  const text = def.text[lang]
  return {
    id: def.id,
    lang,
    title: text.title,
    panels: def.panels.map(({ image, speaker }, index) => ({
      id: index + 1,
      speaker,
      imageKey: `${def.id}-${index + 1}`,
      // Vite serves these assets on the frontend origin, including in live API mode.
      imageUrl: image ? new URL(image, window.location.href).href : undefined,
      placeholder: image ? undefined : { setting: def.placeholder ?? 'custom' },
      imageAspect: def.imageAspect,
      text: text.dialogue[index],
    })),
    exercise: {
      id: def.exerciseId,
      panelId: def.exercisePanelId,
      prompt: text.prompt,
      answerFormat: 'whole-number',
    },
  }
}

/** Plain whole numbers, optionally grouped in thousands with a (narrow/no-break) space: "1500", "1 500". */
const WHOLE_NUMBER = /^(?:[0-9]+|[0-9]{1,3}(?:[   ][0-9]{3})+)$/

export function parseWholeNumber(answer: string): number | null {
  const value = answer.trim()
  return WHOLE_NUMBER.test(value) ? Number(value.replace(/[   ]/g, '')) : null
}

export function checkWholeNumberAnswer(answer: string, expected: number): CheckStatus {
  const value = parseWholeNumber(answer)
  return value === null ? 'invalid' : value === expected ? 'correct' : 'incorrect'
}

export function checkLocalAnswer(def: LocalComicDef, answer: string, lang: Lang): CheckResponse {
  const status = checkWholeNumberAnswer(answer, def.answer)
  const copy = def.text[lang]
  const value = status === 'incorrect' ? parseWholeNumber(answer) : null
  const targeted = value === null ? undefined : copy.commonMistakes?.[value]
  return { status, message: targeted ?? copy.feedback[status] }
}

export function localHint(def: LocalComicDef, lang: Lang, step: HintStep): HintResponse {
  return { step, text: def.text[lang].hints[step - 1], hasMore: step === 1 }
}
