interface ReadingProgress {
  index: number
  solved: boolean
  hints: Record<string, number>
  replay: string | null
}

const key = (comicId: string) => `amc.reading.${comicId}`

export function readReadingProgress(comicId: string): ReadingProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(key(comicId)) ?? 'null') as Partial<ReadingProgress> | null
    if (saved && typeof saved.index === 'number' && Number.isSafeInteger(saved.index) && saved.index >= 0) {
      const hints = saved.hints && typeof saved.hints === 'object' && !Array.isArray(saved.hints) ? saved.hints : {}
      return { index: saved.index, solved: saved.solved === true, hints, replay: typeof saved.replay === 'string' ? saved.replay : null }
    }
  } catch { /* use the beginning */ }
  return { index: 0, solved: false, hints: {}, replay: null }
}

function writeReadingProgress(comicId: string, progress: ReadingProgress) {
  try { localStorage.setItem(key(comicId), JSON.stringify(progress)) } catch { /* current visit still works */ }
}

export function updateReadingProgress(comicId: string, patch: Partial<Pick<ReadingProgress, 'index' | 'solved'>>) {
  writeReadingProgress(comicId, { ...readReadingProgress(comicId), ...patch })
}

export function startReadingReplay(comicId: string, replay: string) {
  writeReadingProgress(comicId, { index: 0, solved: false, hints: {}, replay })
}

export function readHintCount(comicId: string, exerciseId: string): number {
  const count = readReadingProgress(comicId).hints[exerciseId]
  return count === 1 || count === 2 ? count : 0
}

export function rememberHint(comicId: string, exerciseId: string, count: number) {
  const progress = readReadingProgress(comicId)
  const previous = progress.hints[exerciseId]
  if ((previous === 1 || previous === 2) && previous >= count) return
  writeReadingProgress(comicId, { ...progress, hints: { ...progress.hints, [exerciseId]: count } })
}
