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
- **Illustrations** — art direction follows the style sheet in `docs/visual-guide.jpeg.jpeg`
  (copied to `src/assets/reference-sheet.jpg`). `imageKey` maps to a region of that sheet in
  `src/art/sheet.ts`; `PanelArt` crops it and draws a live speech bubble on top, so dialogue,
  fractions (`a/b` is rendered stacked by `RichText`) and the problem statement stay real UI text
  in both languages. Each bubble is positioned to fully cover the Russian lettering baked into the
  source art. Unknown keys render a placeholder.
- **Cast** — Aldiyar, Aruna and Pifik portraits come from the same sheet; the current speaker is
  highlighted. Speakers are matched by name (`src/characters.ts`), so the backend should use
  `Алдияр` / `Аруна` / `Пифик`.

### Artwork status

There are no dedicated panel images yet; every panel is cropped from the 1280×720 style sheet,
so art is upscaled (~2.5× on desktop) and slightly soft.

| imageKey   | Source on the sheet                         | Needed                                   |
| ---------- | ------------------------------------------- | ---------------------------------------- |
| `pizza-01` | Pifik from the cast poster                  | **New panel**: Pifik greets the reader    |
| `pizza-02` | Aruna from the cast poster                  | **New panel**: Aruna ordering 3 pizzas    |
| `pizza-03` | Comic frame 1 (Aldiyar, three pizzas)       | Clean hi-res frame without lettering      |
| `pizza-04` | Comic frame 3 (Pifik)                       | Clean hi-res frame without lettering      |
| `pizza-05` | Comic frame 2 (Aruna at the board, 3/4)     | Clean hi-res frame without lettering      |
| `pizza-06` | Comic frame 4 (Aldiyar celebrates)          | **New panel**: four friends sharing pizza |

The story has four friends but the sheet only defines two kids; the other two have no design.
Drop clean frames (4:3, no speech bubbles) into `src/assets/` and point the scene at them.

## Layout

```
src/
  api/          contract types, HTTP client, mocks, mode switch (index.ts)
  art/          style-sheet regions and bubble placement per imageKey
  assets/       reference-sheet.jpg (all artwork)
  components/   ComicReader, PanelArt, SheetCrop, RichText, CastCard, ExerciseCard,
                PifikHints, LanguageSwitcher
  characters.ts cast, colours, speaker-name matching
  hooks.ts      data hooks (comic, answer check, hints, language)
  i18n.ts       UI strings for ru / kk
```
