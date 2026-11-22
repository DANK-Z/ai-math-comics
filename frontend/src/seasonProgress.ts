import { useCallback, useRef, useState } from 'react'
import { schoolFairChapter } from './schoolFair'

const STORAGE_KEY = 'amc.schoolFair.completedChapters'

function readCompleted(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (Array.isArray(saved)) {
      return new Set(saved.filter((id): id is string => typeof id === 'string' && !!schoolFairChapter(id)))
    }
  } catch {
    // A bad or inaccessible save starts with empty progress.
  }
  return new Set()
}

export function useSeasonProgress() {
  const [completedChapters, setCompletedChapters] = useState(readCompleted)
  const current = useRef(completedChapters)

  const completeChapter = useCallback((comicId: string) => {
    const chapter = schoolFairChapter(comicId)
    if (!chapter || current.current.has(comicId)) return null

    // Merge anything saved by another tab before writing the new completion.
    const saved = readCompleted()
    const next = new Set([...current.current, ...saved, comicId])
    current.current = next
    setCompletedChapters(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // Keep progress in memory for this session when storage cannot be written.
    }
    return saved.has(comicId) ? null : chapter.collectible
  }, [])

  /** Add chapters saved on the server (a signed-in student on a new device). */
  const mergeChapters = useCallback((ids: readonly string[]) => {
    const known = ids.filter((id) => schoolFairChapter(id) && !current.current.has(id))
    if (known.length === 0) return
    const next = new Set([...current.current, ...readCompleted(), ...known])
    current.current = next
    setCompletedChapters(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // In memory only.
    }
  }, [])

  return { completedChapters, completeChapter, mergeChapters }
}
