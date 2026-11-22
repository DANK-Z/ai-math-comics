# AGENTS.md — AI Math Comics

Guide for any coding agent (Codex, Claude Code, …) working in this repository.
Read it before changing anything. The owner speaks Russian: reply in Russian unless asked otherwise.

## What this is

Interactive math comics for grades 5–6 in **Russian and Kazakh**. A student reads a six-panel
comic, fights a boss on panel 4 by solving exercises (with Pifik's hints), and unlocks the ending.
There is a bundled season «Операция: школьная ярмарка», a Road Guardian boss, and AI-generated
comics («Математический экспресс» and «Моя история»).

- `frontend/` — React 19 + TypeScript + Tailwind v4 (Vite). Hash routes (`#/`, `#/comics`,
  `#/my-comics`, `#/create`, `#/comic/{id}`, `#/guardian`, `#/road-guardian`, `#/backpack`).
- `backend/` — FastAPI API (`app/main.py`) + separate generation worker (`app/worker.py`),
  SQLite in `backend/data/` (git-ignored, holds private answers).
- `docs/api-contract.md` — the API contract; keep frontend types, mocks and backend in sync with it.
- `docs/ROADMAP.md` — what is done / in progress / planned. Update it when you finish an item.

## One folder, no worktrees

Everything lives in `C:\Users\Danial\Documents\ai-math-comics` on branch `main`.
Earlier sibling folders (`ai-math-comics-backend`, `-frontend`, `-resumable`) were git worktrees;
they are merged and removed. Their old test databases are in `backend/data/_archive/`.
Do **not** create new worktrees or sibling folders. For a bigger change, make a branch in this
folder (`git switch -c feature/<name>`), and merge back into `main` when the owner agrees.

Remote: `origin` = https://github.com/DANK-Z/ai-math-comics (private). Commit and push only
when the owner asks; never force-push `main`.

## Setup (PowerShell, Windows)

```powershell
# backend
cd backend
python -m venv .venv                      # already exists; recreate if missing
.venv\Scripts\python -m pip install -r requirements-dev.txt
# backend/.env already holds the owner's keys (COMIC_PROVIDER=gemini, prepared art). Never print,
# copy or commit it. Template: backend/.env.example

# PostgreSQL (+pgvector) and Redis in Docker (from the repo root; Docker Desktop must be running)
docker compose up -d
# backend/.env has DATABASE_URL (port 5433) and JWT_SECRET; without DATABASE_URL the API uses
# backend/data/accounts.sqlite3 instead

# frontend
cd ..\frontend
npm install
```

## Run

```powershell
# API (from backend/)
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# worker, second terminal (from backend/)
.venv\Scripts\python -m app.worker
# frontend with in-browser mocks, no backend needed (from frontend/)
npm run dev          # http://localhost:5173
# frontend against the real backend
npm run dev:live     # uses .env.live (+ git-ignored .env.live.local overrides)
```

CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173`.
Real generation costs money (Gemini/OpenAI). Ask the owner before running a real provider job.

## Checks (run before saying something is done)

```powershell
cd backend
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m ruff format --check .
.venv\Scripts\python -m pytest            # no credentials, no paid calls
cd ..\frontend
npm run build                             # tsc -b + vite build
```

For UI changes also open the app (mock mode is enough) and check desktop 1440 px and phone
360 px in **both** languages: no horizontal scroll, text fits.

## Rules that must not be broken

1. **Russian + Kazakh everywhere.** Every user-facing string has `ru` and `kk` (see
   `frontend/src/i18n.ts`, `myStory.ts`, `boss.ts`, backend problem templates).
2. **The server owns the math.** Operands, exercise text, hints and answers come from
   `backend/app/problems.py` (fractions, equations) and `library_episode.py`. The text model only
   writes narrative. It never chooses numbers, and answers never go to the model or the client.
3. **Narrative validation** (`backend/app/story.py`, `validate_narrative`): titles and dialogue
   outside panel 4 must be Cyrillic and have no digits, math symbols or number words
   (RU/KK, including collective numerals like «двое», «трое»). Panel 4 text is exactly the
   server exercise. Do not loosen these checks to make a model pass — retries handle it.
4. **Student input is data** («Моя история»): validated on input (`schemas.clean_student_text`),
   marked as data in the prompt, never sent to the image model except the custom setting.
5. **Secrets and local files never go into commits:** `backend/.env`, `backend/data/`,
   `frontend/.env*.local`, `frontend/dist/`, `.claude/`, and the reference PNGs in `docs/`
   (untracked on purpose).
6. **Design system:** card radius 16px (`rounded-2xl`), inputs/buttons 12px (`rounded-xl`),
   chips/badges 8px (`rounded-lg`); 3px ink borders with a solid ink drop shadow; a selected
   option is **yellow (`bg-sun`) with a ✓**; the primary action button is yellow. Errors: red
   border via `aria-invalid`, the message linked with `aria-describedby`, and focus moved to
   the field.
7. Keep `docs/api-contract.md`, `frontend/src/api/types.ts`, the mocks (`frontend/src/api/mock*.ts`)
   and the backend models in sync. Add backend tests for every backend change.

## Where things are

| Feature | Backend | Frontend |
| --- | --- | --- |
| Problem templates (fractions, equations), boss rounds | `app/problems.py` | — |
| Classic story prompt + validation, scenes per topic | `app/story.py` | — |
| «Моя история» prompt, validation, placeholders | `app/my_story.py` | `myStory.ts`, `components/MyStoryFields.tsx` |
| Job queue, publish, boss_rounds table | `app/storage.py` | `jobs.ts`, `components/GenerateCard.tsx` |
| Worker: storyboard retries (`TEXT_ATTEMPTS`), images, boss block | `app/worker.py` | `components/GenerationProgress.tsx` |
| Answer check (fraction `a/b`; equations via SymPy: `x=3`, `3`, `3.0`, `3,0`) | `app/main.py`, `app/answers.py` | `hooks.ts`, mock mirror `api/answers.ts` |
| Panel-4 boss fight (90 HP, 3 rounds × 30), draft pad, victory screen | `schemas.Boss` | `components/BossFight.tsx`, `components/TriumphModal.tsx`, `boss.ts`, `components/ComicReader.tsx` |
| Road Guardian (motion problems) | — | `roadGuardian.ts`, `components/RoadGuardianScreen.tsx` |
| Season, catalog, backpack, Guardian | — | `schoolFair.ts`, `guardian.ts`, `components/*` |
| My Comics history (localStorage `amc.myComics`) | — | `myComics.ts`, `components/MyComicsScreen.tsx` |
| Providers (Gemini/OpenAI) | `app/gemini.py`, `app/providers.py`, `app/config.py` | — |
| Accounts, roles, JWT | `app/auth.py`, `app/db.py` (tables) | `account.tsx`, `api/authToken.ts`, `components/AuthScreen.tsx` |
| Fair shop, Pifik skins | `app/shop.py` | `components/FairShop.tsx`, `components/PifikSprite.tsx` (skin overlay in sheet coordinates) |
| Story cache (Redis exact, pgvector semantic; fresh math) | `app/story_cache.py`, `Worker.cached_story` | — |
| Classes, codes, progress, coins, analytics, dashboard | `app/accounts.py` | `components/TeacherScreen.tsx`, `components/ProfileScreen.tsx`, `bossProgress.ts`, `accountCopy.ts`, mock `api/mockAccounts.ts` |

## Current state (2026-11-22, `main` at `86b6800`, pushed to GitHub)

Done: «Моя история»; topics «Дроби» and «Уравнения» (SymPy answer parsing: `x=3`, `3`, `3.0`,
`3,0`); storyboard retries (verified live with Gemini); panel-4 boss fight with victory screen and
draft pad; Road Guardian; accounts (students by login, teachers by e-mail, JWT roles), class codes,
server-side coins/stars, teacher dashboard with error heatmap; fair shop with Pifik skins;
story cache (Redis for Express, pgvector + local multilingual embeddings for «Моя история»; the
math is always new). 314 backend tests pass with the real services, the frontend builds.

Before working: start Docker Desktop, then `docker compose up -d` (PostgreSQL with pgvector on
5433, Redis on 6380). Tests against the real services:
`$env:TEST_REDIS_URL="redis://127.0.0.1:6380/15"; $env:TEST_DATABASE_URL="postgresql+asyncpg://amc:amc-dev-password@127.0.0.1:5433/amc_test"`.

Known gaps / good next steps (see `docs/ROADMAP.md` for the full list):
- Power-ups (potions) for boss fights: the boss uses typed answers, so «remove a wrong answer»
  needs a new design first.
- Alembic migrations before a pilot (tables are created with `create_all`), sign-in rate limiting,
  password reset.
- Sprint 5: Docker images for API/worker/frontend, HTTPS, deployment, backups.
- In mock mode the teacher dashboard shows fixed demo statistics.
- With prepared art, style/setting choices do not change pictures; custom heroes are never drawn.
- Live image generation with the real provider has not been re-checked since the equations/boss work.
- Moderation of student text is rule- and prompt-based only.
- `backend/README.md` has a small uncommitted doc edit (library episode paragraph) — keep it.
- Branch `feat/frontend-redesign` is an old, superseded redesign; do not merge it.
