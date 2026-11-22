import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { accounts, ApiError, type AuthResponse, type Me } from './api'
import { authToken } from './api/authToken'

// The signed-in user (student or teacher), shared by the header, navigation and screens.

interface AccountContextValue {
  user: Me | null
  /** False while a saved session is being restored. */
  ready: boolean
  logIn(login: string, password: string): Promise<Me>
  signUpStudent(body: { login: string; password: string; displayName: string; classCode?: string }): Promise<Me>
  signUpTeacher(body: { email: string; password: string; displayName: string }): Promise<Me>
  logOut(): void
  joinClass(code: string): Promise<Me>
  saveProgress(completedChapters: string[], stickers: string[]): Promise<void>
  /** Update the coin balance after the server awarded a boss reward. */
  setCoins(total: number): void
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [ready, setReady] = useState(() => !authToken.get())

  useEffect(() => {
    if (!authToken.get()) return
    accounts
      .me()
      .then(setUser)
      .catch((e) => {
        // An expired token signs the user out; a network error keeps it for the next visit.
        if (e instanceof ApiError && e.status === 401) authToken.set(null)
      })
      .finally(() => setReady(true))
  }, [])

  const finish = useCallback((response: AuthResponse) => {
    authToken.set(response.token)
    setUser(response.user)
    return response.user
  }, [])

  const value = useMemo<AccountContextValue>(
    () => ({
      user,
      ready,
      logIn: (login, password) => accounts.logIn({ login, password }).then(finish),
      signUpStudent: (body) => accounts.signUpStudent(body).then(finish),
      signUpTeacher: (body) => accounts.signUpTeacher(body).then(finish),
      logOut() {
        authToken.set(null)
        // Go home first, so a guest is not bounced from a private page to the sign-in page.
        window.location.hash = '#/'
        setUser(null)
      },
      joinClass: (code) =>
        accounts.joinClass(code).then((me) => {
          setUser(me)
          return me
        }),
      async saveProgress(completedChapters, stickers) {
        setUser(await accounts.saveProgress({ completedChapters, stickers }))
      },
      setCoins(total) {
        setUser((u) => (u?.profile ? { ...u, profile: { ...u.profile, coins: total } } : u))
      },
    }),
    [user, ready, finish],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useAccount needs <AccountProvider>')
  return value
}
