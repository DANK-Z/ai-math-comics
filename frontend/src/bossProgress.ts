import { useCallback, useEffect, useRef, useState } from 'react'
import { accounts, API_MODE, isAbortError } from './api'
import { useAccount } from './account'

// Boss-fight progress (rounds cleared, misses) that survives a reload: saved in this browser
// for everyone, and restored from the server's answer log for a signed-in student.

interface Progress {
  cleared: number
  misses: number
}

const key = (comicId: string) => `amc.boss.${comicId}`

function read(comicId: string): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(key(comicId)) ?? 'null') as Partial<Progress> | null
    if (saved && Number.isInteger(saved.cleared) && Number.isInteger(saved.misses)) {
      return { cleared: Math.max(0, saved.cleared!), misses: Math.max(0, saved.misses!) }
    }
  } catch {
    /* nothing saved */
  }
  return { cleared: 0, misses: 0 }
}

function write(comicId: string, progress: Progress) {
  try {
    localStorage.setItem(key(comicId), JSON.stringify(progress))
  } catch {
    /* this fight only */
  }
}

/** `fresh` (a Replay link) starts from round one and ignores saved progress. */
export function useBossProgress(comicId: string, enabled: boolean, fresh: boolean, syncRemote: boolean) {
  const [progress, setProgress] = useState<Progress>(() => (enabled && !fresh ? read(comicId) : { cleared: 0, misses: 0 }))
  const latest = useRef(progress)
  const { user } = useAccount()
  const studentId = user?.role === 'student' ? user.id : null

  useEffect(() => {
    if (enabled && fresh) write(comicId, { cleared: 0, misses: 0 })
  }, [comicId, enabled, fresh])

  const update = useCallback(
    (next: Progress) => {
      latest.current = next
      setProgress(next)
      write(comicId, next)
    },
    [comicId],
  )

  useEffect(() => {
    if (!enabled || fresh || !syncRemote || studentId === null || API_MODE !== 'live') return
    const ctrl = new AbortController()
    accounts.bossState(comicId, ctrl.signal).then(
      (server) => {
        if (!server) return
        const local = latest.current
        // Take whichever side got further; the server knows the misses of a won fight.
        if (server.cleared >= local.cleared) {
          update({ cleared: server.cleared, misses: server.result?.misses ?? Math.max(server.misses, local.misses) })
        }
      },
      (e) => {
        if (!isAbortError(e)) {
          /* offline: keep this browser's progress */
        }
      },
    )
    return () => ctrl.abort()
  }, [comicId, enabled, fresh, syncRemote, studentId, update])

  const roundCleared = useCallback(() => {
    const next = { ...latest.current, cleared: latest.current.cleared + 1 }
    update(next)
    return next.cleared
  }, [update])

  const miss = useCallback(() => update({ ...latest.current, misses: latest.current.misses + 1 }), [update])

  return { cleared: progress.cleared, misses: progress.misses, roundCleared, miss }
}
