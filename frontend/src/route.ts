import { useCallback, useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'comic'; comicId: string }

export const DEMO_COMIC_ID = 'pizza-fractions'

function parse(hash: string): Route {
  const m = /^#\/comic\/([^/?#]+)/.exec(hash)
  if (m) {
    try {
      return { name: 'comic', comicId: decodeURIComponent(m[1]) }
    } catch {
      /* malformed id: fall through */
    }
  }
  return { name: 'home' }
}

export function comicHref(comicId: string) {
  return `#/comic/${encodeURIComponent(comicId)}`
}

/** Tiny hash router: `#/` = home, `#/comic/{id}` = reader. Keeps back/forward working. */
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
