# AI Math Comics frontend

React + TypeScript + Tailwind (Vite) client for the School Fair season, generated comics, and
classroom assignments. See the [API contract](../docs/api-contract.md).

## Start

```sh
cd frontend
npm ci
npm run dev        # http://localhost:5173, uses built-in mocks (no backend needed)
npm run dev:live   # http://localhost:5173, talks to the FastAPI backend at http://127.0.0.1:8000
```

Other scripts: `npm run build` (type-check + production build to `dist/`), `npm run preview`.

### End-to-end tests

`e2e/app.spec.ts` drives the demo mode in a real browser: reading and solving a chapter, coins
and secrets paid once, a review drill, a class battle from the teacher's board to a student's
phone, and the night theme. Playwright starts its own dev server on port 5179.

```sh
npx playwright install chromium   # once; or use an installed browser: PW_CHANNEL=msedge
npm run test:e2e
```

## API mode

| Variable            | Default                  | Meaning                                     |
| ------------------- | ------------------------ | ------------------------------------------- |
| `VITE_API_MODE`     | `mock`                   | `mock` = in-browser mocks, `live` = HTTP    |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000`  | Backend origin used in `live` mode          |
| `VITE_COMIC_ART_MODE` | `prepared` | Sets the generation copy. Match the backend's `COMIC_ART_MODE`. |

`.env` sets mock mode; `.env.live` (loaded by `npm run dev:live`) sets live mode. Override
locally with `.env.local` / `.env.live.local` (git-ignored). Live mode needs the backend to allow
the `http://localhost:5173` or `http://127.0.0.1:5173` origin in CORS.

The mocks simulate six-panel comics with an exercise on panel 4, exact fraction and equation
answers, localized feedback, and two hints. Classroom publishing and reports use the live API.

## Screens

- `#/` — the **School Fair Map**, with six stops in story order.
- `#/comics` — the six-chapter comic catalog.
- `#/backpack` — chapter collectibles and bonus stickers.
- `#/guardian` — the Final Challenge, unlocked after all six chapters.
- `#/create` — the Create Comic form.
- `#/my-comics` — browser history for generated comics, with open and replay actions.
- `#/comic/{comicId}` — the reader for catalog comics, generated stories and class assignments.
- `#/login` — sign in or register as a teacher or student.
- `#/teacher` and `#/teacher/class/{classId}` — teacher workspace and class analytics.

Catalog chapters are independent of the generation worker. Chapters 2–6 bundle their
panels and exercises in the frontend and work in both API modes.

## Generate Comic flow

1. The form (grade 5/6, topic `fractions`/`equations`, comic language `ru`/`kk`, difficulty
   `basic`/`intermediate`/`advanced`) sends `POST /api/comic-jobs` → `202 {jobId, status}`.
2. `GET /api/comic-jobs/{jobId}` is polled every 1.5 s until `ready` or `failed`
   (`src/jobs.ts`). If Create Comic is the selected section, a ready job opens the reader
   in the comic's language. Otherwise, return to Create Comic and choose Read. The reader
   loads `GET /api/comics/{comicId}?lang=…`. Answer checks and hints
   use the exercise id from that response.
3. Only one job runs at a time: the form is locked and submit is guarded while a job is in flight.
   The job is kept in `sessionStorage` and polling continues across sections. After 3 minutes,
   3 consecutive poll errors, or a manual pause, use
   *Check status* to start a fresh polling window for the same job. This option survives reloads
   in the same tab and only sends status GETs. Polling also waits while the tab is hidden.
4. Terminal failures show a localized message with *Try again* / *Change settings*; the technical detail
   (HTTP status + FastAPI `detail`, or the job's `errorCode`) is under *Details*.
   A resumable live-art failure also offers *Resume generation*. This continues the same job
   and draws only missing panels. *Check status* only resumes polling.

Generated panels carry `imageUrl`. Absolute URLs are used as-is; relative ones are resolved
against `VITE_API_BASE_URL` in live mode. The dialogue is shown in a bubble under the image
(server art is assumed to have no lettering), so text and fractions stay UI text.

**Mocks.** `src/api/mockApi.ts` simulates the job lifecycle (queued → running → ready in ~4.5 s);
`src/api/mockGenerated.ts` holds one bilingual fraction problem per grade × difficulty, with
panel images in `public/mock-images/` (cropped from the style sheet). Job and comic ids encode
their parameters, so the mock is stateless and survives reloads. Failure paths:

- `http://localhost:5173/?mockJob=fail` — the job ends `failed` with `errorCode: generation_failed`
- `http://localhost:5173/?mockJob=reject` — `POST /api/comic-jobs` answers HTTP 503

## Chapter 3 continuations

Solve Chapter 3 and open its ending. In live mode the key, route note, fair ticket, and
student-written premise can become generated continuations. The prepared previews stay
available for the three preset choices. The flow saves a separate job ID so you can reopen
it to resume checking or read the finished episode. Continuations reuse local artwork.
Their reader links lead back to Chapter 3 and onward to the canonical Chapter 4. They are
outside season progress.

## Classroom assignments

1. Start the live frontend and backend. In [the sign-in screen](http://localhost:5173/#/login),
   register as a teacher or use your existing teacher login. Create a class in the teacher
   dashboard and copy its class code.
2. Open **Создать авторский комикс / Авторлық комикс жасау**, select the cast, style and setting,
   and generate the draft. The draft uses the configured worker and artwork mode.
3. In the editor, review the title and dialogue for each of the six panels in both languages.
   On panel 4 choose the boss and fill the problem, expected answer, and both Pifik hints.
   Enter your own task, select a demonstration equation, or ask AI to pick a server-generated
   problem and write hints. For example, use `2x + 5 = 15` with the expected answer `x = 5`.
4. Select the class, optionally set a due date, and publish. The assignment ID identifies a
   published copy of the draft. The due date is displayed on the map.
5. As a student, register with that class code or join from your profile. The map checks for
   new assignments every five seconds while visible. Open **Задание от учителя / Мұғалімнің
   тапсырмасы**, solve the boss round on panel 4 and read the ending.
6. In the class dashboard, review the assignment report. Each student is shown as pending,
   solved independently, or solved with hints. A completed entry counts hints opened before
   the first correct submission.

## Features

- **Comic reader** — one panel at a time, prev/next buttons, dot navigation, ← / → keys.
  Panels after the exercise unlock once the answer is correct (`GATE_AFTER_EXERCISE` in
  `src/components/ComicReader.tsx`).
- **Russian / Kazakh** — switcher in the header; choice is remembered. Switching re-fetches the
  comic, re-checks the last answer and re-fetches revealed hints so all server text matches the
  language. UI strings live in `src/i18n.ts`.
- **Answer feedback** — `correct` / `incorrect` / `invalid` states with the server's message.
- **Voice answers** — when the live API has a local voice model, panel 4 offers a microphone.
  The recognized answer is editable and uses the same check button as manual input.
- **Item stories** — signed-in students can inspect a shop skin, wardrobe item, or earned
  School Fair collectible. Stories open inline and local achievement details appear separately.
- **Pifik's hints** — step 1 then step 2, driven by `hasMore`.
- **Dialogue motion** — generated dialogue can include a validated emotion. The bubble
  changes colour and shape, and a named character can show an expression beside it.
  Dialogue animates on entry while the complete line stays available to assistive technology.
  Exercise text appears immediately. Pifik reacts to a missed answer and to boss victory.
- **Panel depth** — layered artwork responds to scrolling, with optional phone tilt on
  supported devices after the reader enables the sensor. Tilt needs a secure origin.
  Thumbnails and reduced-motion mode use the original image.
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
