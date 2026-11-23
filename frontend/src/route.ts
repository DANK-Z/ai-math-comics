import { useCallback, useEffect, useState } from 'react'
import { parseGuardianAssignment, type GuardianAssignment } from './guardianAssignment'

export const SECTION_HREFS = {
  map: '#/',
  comics: '#/comics',
  myComics: '#/my-comics',
  backpack: '#/backpack',
  guardian: '#/guardian',
  roadGuardian: '#/road-guardian',
  motionLeague: '#/motion-league',
  operations: '#/operations',
  create: '#/create',
  login: '#/login',
  profile: '#/profile',
  teacher: '#/teacher',
} as const

export type Section = keyof typeof SECTION_HREFS
/** `replay` is set by a Replay link: a fresh token each time, so the reader remounts with clean state. */
export type Route =
  | { name: Section }
  | { name: 'comic'; comicId: string; ending: boolean; replay: string | null }
  | { name: 'teacherClass'; classId: number }
  | { name: 'operation'; id: string }
  | { name: 'guardianAssignment'; assignment: GuardianAssignment }
export const GUARDIAN_HREF = SECTION_HREFS.guardian

export const DEMO_COMIC_ID = 'pizza-fractions'
export const SCHOOL_STORE_COMIC_ID = 'school-store-discount'
export const SCHOOL_MAP_COMIC_ID = 'school-quest-map'
export const LIBRARY_BOXES_COMIC_ID = 'library-boxes'
export const LEMONADE_COMIC_ID = 'fair-lemonade'
export const GARLAND_COMIC_ID = 'fair-garland'

export function parseRoute(hash: string): Route {
  const assignment = parseGuardianAssignment(hash)
  if (assignment) return { name: 'guardianAssignment', assignment }
  for (const section of Object.keys(SECTION_HREFS) as Section[]) {
    if (hash === SECTION_HREFS[section]) return { name: section }
  }
  const operation = /^#\/operation\/([a-z0-9-]{1,40})$/.exec(hash)
  if (operation) return { name: 'operation', id: operation[1] }
  const teacherClass = /^#\/teacher\/class\/([0-9]{1,9})$/.exec(hash)
  if (teacherClass) return { name: 'teacherClass', classId: Number(teacherClass[1]) }
  const m = /^#\/comic\/([^/?#]+)/.exec(hash)
  if (m) {
    try {
      const comicId = decodeURIComponent(m[1])
      const replay = /[?&]replay=([a-z0-9]+)/i.exec(hash)?.[1] ?? null
      return { name: 'comic', comicId, ending: hash === comicHref(SCHOOL_MAP_COMIC_ID, true), replay }
    } catch {
      /* malformed id: fall through */
    }
  }
  return { name: 'map' }
}

export function teacherClassHref(classId: number) {
  return `#/teacher/class/${classId}`
}

export function comicHref(comicId: string, ending = false) {
  return `#/comic/${encodeURIComponent(comicId)}${ending ? '?ending' : ''}`
}

/** Opens a comic from the start: panel 1, no answer, no hints, ending locked. Never creates a job. */
export function replayHref(comicId: string) {
  return `${comicHref(comicId)}?replay=${Date.now().toString(36)}`
}

/** Hash routes preserve section and comic navigation in browser history. */
export function useRoute(): [Route, (href: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((href: string) => {
    window.location.hash = href.replace(/^#/, '')
  }, [])

  return [route, navigate]
}
