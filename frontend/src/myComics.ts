import { useEffect, useState } from 'react'
import { LANGS, type Lang } from './api'

// "My Comics": IDs of comics this browser generated successfully (new comics and
// continuations). Only IDs and metadata are stored; titles and thumbnails come from
// the existing GET /api/comics/{id} when the list is shown.

const STORAGE_KEY = 'amc.myComics'
const CHANGE_EVENT = 'amc:my-comics'
const MAX_ENTRIES = 50
export const MY_COMIC_TITLE_LIMIT = 100

export type MyComicKind = 'generated' | 'continuation' | 'story'

export interface MyComic {
  comicId: string
  kind: MyComicKind
  /** Language the comic was generated in; used to load its title first. */
  lang: Lang
  savedAt: number
  customTitle?: string
}

function isEntry(v: unknown): v is MyComic {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.comicId === 'string' &&
    e.comicId.length > 0 &&
    (e.kind === 'generated' || e.kind === 'continuation' || e.kind === 'story') &&
    LANGS.includes(e.lang as Lang) &&
    typeof e.savedAt === 'number' &&
    Number.isFinite(e.savedAt) &&
    (e.customTitle === undefined || (typeof e.customTitle === 'string' && e.customTitle.length <= MY_COMIC_TITLE_LIMIT))
  )
}

/** Newest first. Invalid or unreadable storage yields an empty list. */
export function loadMyComics(): MyComic[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

function write(list: MyComic[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch {
    /* storage unavailable or full: history is best-effort */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Records a successfully generated comic. Saving the same ID again keeps its original date. */
export function saveMyComic(entry: Omit<MyComic, 'savedAt'>) {
  const list = loadMyComics()
  if (list.some((c) => c.comicId === entry.comicId)) return
  write([{ ...entry, savedAt: Date.now() }, ...list])
}

export function removeMyComic(comicId: string) {
  write(loadMyComics().filter((c) => c.comicId !== comicId))
}

export function renameMyComic(comicId: string, title: string) {
  const customTitle = title.trim().slice(0, MY_COMIC_TITLE_LIMIT) || undefined
  write(loadMyComics().map((entry) => entry.comicId === comicId ? { ...entry, customTitle } : entry))
}

export function restoreMyComic(entry: MyComic) {
  const list = loadMyComics().filter((item) => item.comicId !== entry.comicId)
  write([...list, entry].sort((a, b) => b.savedAt - a.savedAt))
}

/** Live view of the saved list (this tab and other tabs). */
export function useMyComics(): MyComic[] {
  const [list, setList] = useState(loadMyComics)
  useEffect(() => {
    const refresh = () => setList(loadMyComics())
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null) refresh() }
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return list
}

/** The comic language of a job request: new comics use `lang`, continuations `locale`. */
export function requestLang(request: unknown): Lang | null {
  if (!request || typeof request !== 'object') return null
  const r = request as { lang?: unknown; locale?: unknown }
  const lang = r.lang ?? r.locale
  return LANGS.includes(lang as Lang) ? (lang as Lang) : null
}
