import { useCallback, useEffect, useState } from 'react'
import { api, describeError, isAbortError } from './api'
import type { CheckResponse, Comic, HintResponse, HintStep, Lang } from './api'

type Async<T> = { data: T | null; loading: boolean; error: boolean; errorDetail?: string }

/** Loads the comic for `lang`. Keeps the previous language's data visible while switching. */
export function useComic(comicId: string, lang: Lang) {
  const [state, setState] = useState<Async<Comic>>({ data: null, loading: true, error: false })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: false }))
    api
      .getComic(comicId, lang, ctrl.signal)
      .then((data) => setState({ data, loading: false, error: false }))
      .catch((e) => {
        if (!isAbortError(e)) setState((s) => ({ ...s, loading: false, error: true, errorDetail: describeError(e) }))
      })
    return () => ctrl.abort()
  }, [comicId, lang, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, retry }
}

/**
 * Answer checking. Feedback messages are localized by the server, so when the
 * language changes the last submitted answer is re-checked to refresh the message.
 */
export function useAnswerCheck(exerciseId: string, lang: Lang, onCorrect: (response: CheckResponse) => void) {
  const [submitted, setSubmitted] = useState<{ answer: string; nonce: number } | null>(null)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!submitted) return
    const ctrl = new AbortController()
    setChecking(true)
    setError(false)
    api
      .checkAnswer(exerciseId, { answer: submitted.answer, lang }, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return
        if (r.status === 'correct') onCorrect(r)
        setResult(r)
        setChecking(false)
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setResult(null)
        setError(true)
        setChecking(false)
      })
    return () => ctrl.abort()
  }, [exerciseId, lang, onCorrect, submitted])

  const submit = useCallback((answer: string) => {
    setSubmitted((prev) => ({ answer, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])

  return { result, checking, error, submit, solved: result?.status === 'correct' }
}

/**
 * Pifik's hints. Revealed steps are cached per language, so switching language
 * re-fetches the already revealed hints in the new language.
 */
export function useHints(exerciseId: string, lang: Lang, initialRevealed = 0) {
  const [revealed, setRevealed] = useState(initialRevealed)
  const [cache, setCache] = useState<Partial<Record<Lang, Partial<Record<number, HintResponse>>>>>({})
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const forLang = cache[lang] ?? {}
  const missing: HintStep[] = []
  for (let s = 1; s <= revealed; s++) if (!forLang[s]) missing.push(s as HintStep)
  const missingKey = missing.join(',')

  useEffect(() => {
    if (!missingKey) return
    const ctrl = new AbortController()
    setError(false)
    const steps = missingKey.split(',').map(Number) as HintStep[]
    Promise.all(steps.map((s) => api.getHint(exerciseId, lang, s, ctrl.signal)))
      .then((hints) =>
        setCache((c) => {
          const next = { ...(c[lang] ?? {}) }
          for (const h of hints) next[h.step] = h
          return { ...c, [lang]: next }
        }),
      )
      .catch((e) => {
        if (!isAbortError(e)) setError(true)
      })
    return () => ctrl.abort()
  }, [exerciseId, lang, missingKey, nonce])

  const hints = Array.from({ length: revealed }, (_, i) => forLang[i + 1]).filter(
    (h): h is HintResponse => h !== undefined,
  )
  const loading = missing.length > 0 && !error
  const last = forLang[revealed]
  // Before any hint is shown we can always ask; afterwards trust the server's hasMore.
  const hasMore = revealed === 0 || (last ? last.hasMore : false)

  const requestNext = useCallback(() => {
    if (loading) return
    if (error) {
      setNonce((n) => n + 1)
      return
    }
    if (hasMore && revealed < 2) setRevealed((r) => r + 1)
  }, [loading, error, hasMore, revealed])

  return { hints, revealed, loading, error, hasMore, requestNext }
}

const LANG_KEY = 'amc.lang'

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const v = localStorage.getItem(LANG_KEY)
      if (v === 'ru' || v === 'kk') return v
    } catch {
      /* storage unavailable */
    }
    return 'ru'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* storage unavailable */
    }
  }, [lang])

  return [lang, setLangState]
}
