import { useSyncExternalStore } from 'react'

// Site theme: light, dark, or following the system (default). The resolved theme is set as
// data-theme on <html>; index.css repaints the palette for dark.

export type ThemeChoice = 'light' | 'dark' | 'auto'
const KEY = 'amc.theme'
const QUERY = '(prefers-color-scheme: dark)'

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

const media = typeof matchMedia === 'function' ? matchMedia(QUERY) : null
let choice = readChoice()
const listeners = new Set<() => void>()

const resolved = () => (choice === 'auto' ? !!media?.matches : choice === 'dark')

function apply() {
  document.documentElement.dataset.theme = resolved() ? 'dark' : 'light'
  listeners.forEach((l) => l())
}

media?.addEventListener('change', apply)
apply()

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    if (next === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // This visit only.
  }
  apply()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True while the site is dark (chosen, or the system's dark mode). */
export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, resolved)
}
