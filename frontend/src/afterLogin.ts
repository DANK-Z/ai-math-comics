// Where a guest was heading before the sign-in page (the battle QR on the board, a drill link).
const KEY = 'amc.afterLogin'

export function rememberAfterLogin(hash: string) {
  try {
    sessionStorage.setItem(KEY, hash)
  } catch {
    // Without storage the student lands on the home page, which shows the battle card too.
  }
}

const SAFE = /^#\/(battle|lesson|practice)(\/[a-z]+)?(\?skill=[a-z_]+)?$/

/** The remembered address, if any (kept until taken). */
export function peekAfterLogin(): string | null {
  try {
    const hash = sessionStorage.getItem(KEY)
    return hash && SAFE.test(hash) ? hash : null
  } catch {
    return null
  }
}

/** The remembered address, once. */
export function takeAfterLogin(): string | null {
  const hash = peekAfterLogin()
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
  return hash
}
