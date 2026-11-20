import { useCallback, useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'comic'; comicId: string; ending: boolean } | { name: 'guardian' }
export const GUARDIAN_HREF = '#/guardian'

export const DEMO_COMIC_ID = 'pizza-fractions'
export const SCHOOL_STORE_COMIC_ID = 'school-store-discount'
export const SCHOOL_MAP_COMIC_ID = 'school-quest-map'
export const LIBRARY_BOXES_COMIC_ID = 'library-boxes'
export const LEMONADE_COMIC_ID = 'fair-lemonade'
export const GARLAND_COMIC_ID = 'fair-garland'

function parse(hash: string): Route {
  if (hash === GUARDIAN_HREF) return { name: 'guardian' }
  const m = /^#\/comic\/([^/?#]+)/.exec(hash)
  if (m) {
    try {
      const comicId = decodeURIComponent(m[1])
      return { name: 'comic', comicId, ending: hash === comicHref(SCHOOL_MAP_COMIC_ID, true) }
    } catch {
      /* malformed id: fall through */
    }
  }
  return { name: 'home' }
}

export function comicHref(comicId: string, ending = false) {
  return `#/comic/${encodeURIComponent(comicId)}${ending ? '?ending' : ''}`
}

/** Hash routes for the catalog, reader and final challenge. */
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
