import { useCallback, useEffect, useState } from 'react'

export const SECTION_HREFS = {
  map: '#/',
  comics: '#/comics',
  backpack: '#/backpack',
  guardian: '#/guardian',
  create: '#/create',
} as const

export type Section = keyof typeof SECTION_HREFS
export type Route = { name: Section } | { name: 'comic'; comicId: string; ending: boolean }
export const GUARDIAN_HREF = SECTION_HREFS.guardian

export const DEMO_COMIC_ID = 'pizza-fractions'
export const SCHOOL_STORE_COMIC_ID = 'school-store-discount'
export const SCHOOL_MAP_COMIC_ID = 'school-quest-map'
export const LIBRARY_BOXES_COMIC_ID = 'library-boxes'
export const LEMONADE_COMIC_ID = 'fair-lemonade'
export const GARLAND_COMIC_ID = 'fair-garland'

function parse(hash: string): Route {
  for (const section of Object.keys(SECTION_HREFS) as Section[]) {
    if (hash === SECTION_HREFS[section]) return { name: section }
  }
  const m = /^#\/comic\/([^/?#]+)/.exec(hash)
  if (m) {
    try {
      const comicId = decodeURIComponent(m[1])
      return { name: 'comic', comicId, ending: hash === comicHref(SCHOOL_MAP_COMIC_ID, true) }
    } catch {
      /* malformed id: fall through */
    }
  }
  return { name: 'map' }
}

export function comicHref(comicId: string, ending = false) {
  return `#/comic/${encodeURIComponent(comicId)}${ending ? '?ending' : ''}`
}

/** Hash routes preserve section and comic navigation in browser history. */
export function useRoute(): [Route, (href: string) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onHash = () => {
      setRoute(parse(window.location.hash))
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
