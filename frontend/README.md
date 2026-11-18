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

## Screens

- `#/` — **home**: the Generate Comic form plus the ready-to-play *Pizza for Everyone* demo.
- `#/comic/{comicId}` — **reader** for the demo (`pizza-fractions`) or any generated comic.

## Generate Comic flow

1. The form (grade 5/6, topic `fractions`, comic language `ru`/`kk`, difficulty
   `basic`/`intermediate`/`advanced`) sends `POST /api/comic-jobs` → `202 {jobId, status}`.
2. `GET /api/comic-jobs/{jobId}` is polled every 1.5 s until `ready` or `failed`
   (`src/jobs.ts`). On `ready` the UI switches to the comic's language and opens
   `#/comic/{comicId}`, which loads `GET /api/comics/{comicId}?lang=…`. Answer checks and hints
   use the exercise id from that response.
3. Only one job runs at a time: the form is locked and submit is guarded while a job is in flight.
   The active job is kept in `sessionStorage`, so leaving the screen stops polling and coming back
   resumes the same job instead of creating a new one. Polling also pauses while the tab is hidden
   and gives up after 3 minutes or 3 consecutive request errors.
4. Failures show a localized message with *Try again* / *Change settings*; the technical detail
   (HTTP status + FastAPI `detail`, or the job's `errorCode`) is under *Details*.

Generated panels carry `imageUrl`. Absolute URLs are used as-is; relative ones are resolved
against `VITE_API_BASE_URL` in live mode. The dialogue is shown in a bubble under the image
(server art is assumed to have no lettering), so text and fractions stay UI text.

**Mocks.** `src/api/mockApi.ts` simulates the job lifecycle (queued → running → ready in ~4.5 s);
`src/api/mockGenerated.ts` holds one bilingual fraction problem per grade × difficulty, with
panel images in `public/mock-images/` (cropped from the style sheet). Job and comic ids encode
their parameters, so the mock is stateless and survives reloads. Failure paths:

- `http://localhost:5173/?mockJob=fail` — the job ends `failed` with `errorCode: generation_failed`
- `http://localhost:5173/?mockJob=reject` — `POST /api/comic-jobs` answers HTTP 503

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
  api/          contract types, HTTP client, mocks (incl. generated comics), mode switch
  art/          style-sheet regions and bubble placement per imageKey
  assets/       reference-sheet.jpg (all artwork)
  components/   HomeScreen, GenerateCard, ReaderScreen, ComicReader, PanelArt, SheetCrop,
                RichText, CastCard, ExerciseCard, PifikHints, LanguageSwitcher
  jobs.ts       generation job submit + polling hook
  route.ts      hash routes (#/ and #/comic/{id})
  characters.ts cast, colours, speaker-name matching
  hooks.ts      data hooks (comic, answer check, hints, language)
  i18n.ts       UI strings for ru / kk
```
