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
the `http://localhost:5173` or `http://127.0.0.1:5173` origin in CORS.

The mocks (`src/api/mockApi.ts`, `src/api/mockData.ts`) follow the contract: six panels, exercise
on panel 4, exact fraction checking (`3/4` and equivalents are correct, zero denominator is
`invalid`), localized feedback, and two hint steps with `hasMore`. The mock only parses `a/b` and
integers; the backend is the source of truth for what else counts as valid input.

## Screens

- `#/` — **home**: the ready-to-read comic catalog, followed by the Generate Comic form.
- `#/comic/{comicId}` — **reader** for *Pizza for Everyone* (`pizza-fractions`),
  *School Store Discount* (`school-store-discount`), or a generated comic.

Both catalog entries are independent of the generation worker. School Store Discount bundles
its four panels and whole-number exercise in the frontend, so it works in both API modes.

## Generate Comic flow

1. The form (grade 5/6, topic `fractions`, comic language `ru`/`kk`, difficulty
   `basic`/`intermediate`/`advanced`) sends `POST /api/comic-jobs` → `202 {jobId, status}`.
2. `GET /api/comic-jobs/{jobId}` is polled every 1.5 s until `ready` or `failed`
   (`src/jobs.ts`). On `ready` the UI switches to the comic's language and opens
   `#/comic/{comicId}`, which loads `GET /api/comics/{comicId}?lang=…`. Answer checks and hints
   use the exercise id from that response.
3. Only one job runs at a time: the form is locked and submit is guarded while a job is in flight.
   The active job is kept in `sessionStorage`, so leaving the screen stops polling and coming back
   resumes the same job. After 3 minutes, 3 consecutive poll errors, or a manual pause, use
   *Check status* to start a fresh polling window for the same job. This option survives reloads
   in the same tab and only sends status GETs. Polling also waits while the tab is hidden.
4. Terminal failures show a localized message with *Try again* / *Change settings*; the technical detail
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
- **Illustrations** — Pizza for Everyone and School Store Discount use their own bundled panels
  and covers. Generated comics use their own image URLs. `PanelArt` displays the dialogue beneath
  these images, and `RichText` renders fractions as stacked numerators and denominators.
- **Cast** — Aldiyar, Aruna and Pifik portraits come from the same sheet; the current speaker is
  highlighted. Speakers are matched by name (`src/characters.ts`), so the backend should use
  `Алдияр` / `Аруна` / `Пифик`.

## Layout

```
src/
  api/          contract types, HTTP client, mocks (incl. generated comics), mode switch
  art/          style-sheet regions and bubble placement per imageKey
  assets/       catalog covers and panels, plus the cast reference sheet
  components/   HomeScreen, GenerateCard, ReaderScreen, ComicReader, PanelArt, SheetCrop,
                RichText, CastCard, ExerciseCard, PifikHints, LanguageSwitcher
  jobs.ts       generation job submit + polling hook
  route.ts      hash routes (#/ and #/comic/{id})
  characters.ts cast, colours, speaker-name matching
  hooks.ts      data hooks (comic, answer check, hints, language)
  i18n.ts       UI strings for ru / kk
```

### Catalog covers and art mode

- Catalog entries live in `src/components/HomeScreen.tsx` (`CATALOG`). Each cover keeps its original
  file and gets its own `framing` (phone and wide aspect ratio + object-position focal point), so the
  cast and the story object stay visible. Show a grade only if the comic's metadata provides one.
  Vary cover compositions as comics are added rather than repeating one layout.
- `VITE_COMIC_ART_MODE` (`prepared` by default, or `live`) must match the backend's
  `COMIC_ART_MODE`. In prepared mode the generation form says Pifik writes a story and a fractions
  problem with prepared illustrations, and never promises new drawings.
