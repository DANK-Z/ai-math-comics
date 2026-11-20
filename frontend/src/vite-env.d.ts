/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: string
  readonly VITE_API_BASE_URL?: string
  /** Mirror of the backend's COMIC_ART_MODE: 'prepared' (default) or 'live'. */
  readonly VITE_COMIC_ART_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
