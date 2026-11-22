// The signed-in user's JWT. Kept in localStorage so a reload keeps the session; cleared on
// sign-out or when the server rejects it.
const KEY = 'amc.auth.token'

export const authToken = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(KEY, token)
      else localStorage.removeItem(KEY)
    } catch {
      /* private mode: the session lasts until reload */
    }
  },
}
