# AI Math Comics — frontend demo

React + TypeScript + Tailwind (Vite) client for the "pizza fractions" comic described in
[`../docs/api-contract.md`](../docs/api-contract.md).

## Start

```sh
cd frontend
npm install
npm run dev        # http://localhost:5173, uses built-in mocks (no backend needed)
npm run dev:live   # http://localhost:5173, talks to the FastAPI backend at http://127.0.0.1:8000
```

Other scripts: `npm run build` (type-check + production build to `dist/`), `npm run preview`.

## API mode

| Variable            | Default                  | Meaning                                     |
| ------------------- | ------------------------ | ------------------------------------------- |
| `VITE_API_MODE`     | `mock`                   | `mock` = in-browser mocks, `live` = HTTP    |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000`  | Backend origin used in `live` mode          |

`.env` sets mock mode; `.env.live` (loaded by `npm run dev:live`) sets live mode. Override
locally with `.env.local` / `.env.live.local` (git-ignored). Live mode needs the backend to allow
the `http://localhost:5173` origin in CORS.

The mocks (`src/api/mockApi.ts`, `src/api/mockData.ts`) follow the contract: six panels, exercise
on panel 4, exact fraction checking (`3/4` and equivalents are correct, zero denominator is
`invalid`), localized feedback, and two hint steps with `hasMore`. The mock only parses `a/b` and
integers; the backend is the source of truth for what else counts as valid input.

## Features

- **Comic reader** — one panel at a time, prev/next buttons, dot navigation, ← / → keys.
  Panels after the exercise unlock once the answer is correct (`GATE_AFTER_EXERCISE` in
  `src/components/ComicReader.tsx`).
- **Russian / Kazakh** — switcher in the header; choice is remembered. Switching re-fetches the
  comic, re-checks the last answer and re-fetches revealed hints so all server text matches the
  language. UI strings live in `src/i18n.ts`.
- **Answer feedback** — `correct` / `incorrect` / `invalid` states with the server's message.
- **Pifik's hints** — step 1 then step 2, driven by `hasMore`.
- **Illustrations** — `imageKey` (`pizza-01`…`pizza-06`) maps to inline SVG scenes in
  `src/components/PanelArt.tsx`; unknown keys render a placeholder.

## Layout

```
src/
  api/          contract types, HTTP client, mocks, mode switch (index.ts)
  components/   ComicReader, ExerciseCard, PifikHints, LanguageSwitcher, PanelArt
  hooks.ts      data hooks (comic, answer check, hints, language)
  i18n.ts       UI strings for ru / kk
```
