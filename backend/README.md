# AI Math Comics backend

FastAPI backend implementing [the API contract](../docs/api-contract.md), with the original
Pizza for Everyone demo, real AI generation, and teacher-authored assignments. The project
container uses Python 3.13. Commands run from `backend/` unless specified otherwise.

## Install and configure

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `COMIC_PROVIDER=gemini` and `GEMINI_API_KEY` in `backend/.env` to use Gemini for both
story and images. For OpenAI, keep the default `COMIC_PROVIDER=openai` and set
`OPENAI_API_KEY`. Provider keys stay on the server. Draft and assignment responses can include
signed artwork URLs for the browser.
`.env` and local data are ignored by Git. Existing process environment
variables override `.env`. On macOS/Linux use `.venv/bin/python`; use `cp` to copy the example.
For a runtime-only installation, install `requirements.txt`.

The static pizza comic works without credentials or a worker and still uses frontend assets
`pizza-01` through `pizza-06`. Its existing response fields, answer check, and hints are preserved.

### Accounts database (PostgreSQL)

Accounts, classes, progress, coins, assignments and answer analytics live in PostgreSQL
(SQLAlchemy async).
From the repository root:

```powershell
docker compose up -d db
```

and in `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://amc:amc-dev-password@127.0.0.1:5433/amc
JWT_SECRET=<a long random string>
```

Without `DATABASE_URL` the API falls back to `accounts.sqlite3` in `COMIC_DATA_DIR`, so tests
and a quick demo need no PostgreSQL server. Set a stable `JWT_SECRET` to preserve sign-ins
across API restarts. A disposable demo can create tables on first use. For an existing or pilot
database, follow the [Alembic migration guide](../docs/account-migrations.md). Revision `0003`
adds `assigned_comics` and `assignment_hints`.
Run the account tests on PostgreSQL too with
`$env:TEST_DATABASE_URL="postgresql+asyncpg://amc:amc-dev-password@127.0.0.1:5433/amc_test"`.
They drop and recreate that database's tables, so never point it at `amc`. Create it once with
`docker compose exec db psql -U amc -d amc -c "CREATE DATABASE amc_test"`.

### Story cache (Redis + pgvector)

The worker reuses stories to save model calls and time (`app/story_cache.py`). It reuses the
**story and pictures only**. The exercise, hints and boss rounds are rebuilt from the new
job's math and validated again. Teacher drafts bypass this cache.

* Express comics: exact key topic + grade + difficulty + art mode in Redis (`REDIS_URL`), up to
  `CACHE_VARIANTS` stories per key (default 1); a different language is the same story.
* «Моя история»: all choices except the premise must match exactly (the student's heroes, style,
  setting, topic, grade, difficulty). The premise is compared by meaning with a local multilingual
  embedding model (fastembed, `paraphrase-multilingual-MiniLM-L12-v2`, ~220 MB, downloaded once into
  `backend/data/models`, ~4 ms per premise on CPU) and pgvector; a story is reused at cosine
  similarity ≥ `SEMANTIC_THRESHOLD` (0.92). Measured: «Пифик летит на Луну» / «…отправляется на
  Луну» 0.95 (reused), «…на Марс» 0.78, «потеряла ключ» / «нашла ключ» 0.80 (new stories).
  Kazakh paraphrases score lower (~0.84), so they are reused less often.
* Without `REDIS_URL` / PostgreSQL the cache uses tables in `comics.sqlite3`. `STORY_CACHE=0`
  turns it off. Any cache error falls back to normal generation.

## Start API and worker

Start the API in one terminal:

```powershell
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Start the worker in another terminal, also from `backend/`:

```powershell
.venv\Scripts\python -m app.worker
```

The API is at `http://127.0.0.1:8000`, with interactive docs at `/docs`.
CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`, including generated PNG
responses. Both processes must use the same `COMIC_DATA_DIR`. The separate worker runs
generation independently of HTTP connections and API restarts. Without a worker, accepted
jobs remain `queued`.
`python -m app.worker --once` processes at most one job and exits.
For a different port, update the API bind port, `PUBLIC_BASE_URL` and the frontend's
`VITE_API_BASE_URL` together. Match the frontend's `VITE_COMIC_ART_MODE` to the backend's
`COMIC_ART_MODE`.

## Generate and read a comic

```powershell
$body = @{grade=5; topic="fractions"; lang="ru"; difficulty="basic"} | ConvertTo-Json
$job = Invoke-RestMethod http://127.0.0.1:8000/api/comic-jobs -Method Post -ContentType application/json -Body $body
Invoke-RestMethod "http://127.0.0.1:8000/api/comic-jobs/$($job.jobId)"
```

Creation returns HTTP 202 with `{"jobId":"...","status":"queued"}`. Poll the job endpoint
until `ready` or `failed`. Every poll includes `jobId`, `status`, `comicId`, and `errorCode`;
the latter two are null until the corresponding terminal status. Once ready, fetch
`GET /api/comics/{comicId}?lang=ru` or `?lang=kk`. Each comic has both translations and six
shared illustrations, with absolute `imageUrl` fields alongside unique `imageKey` fields.
Use `imageUrl` for generated comics and the existing local asset mapping for the pizza demo.

Supported creation inputs are integer grades **5, 6**, topics **fractions, equations**, languages **ru, kk**,
and difficulties **basic, intermediate, advanced**. All creation fields are required.
Unsupported values, extra fields, and malformed bodies return HTTP 422. Unknown IDs return 404.

The exercise ID in each generated comic is unique. Reuse:

- `POST /api/exercises/{exerciseId}/check` with `{"answer":"6/8","lang":"ru"}`.
- `GET /api/exercises/{exerciseId}/hints?lang=kk&step=1` (steps 1 and 2).

These also retain the static `pizza-share` exercise, whose expected answer remains `3/4`.
`lang` defaults to `ru` on read/check endpoints. Hints default to step 1. Answers are strings
of at most 256 characters. Standard fraction exercises use integer fraction form (`a/b`)
and accept whitespace, signs, and equivalent fractions with exact `Fraction` arithmetic.
Equation exercises use the exact value parser described below.
Unequal fractions return `incorrect`; malformed input and zero denominators return `invalid`.
These outcomes use HTTP 200 with localized feedback; numeric JSON answers return HTTP 422.

### My Story jobs

`POST /api/comic-jobs` accepts an optional `story` object (heroes, up to two student
heroes, style, setting, premise; see the contract). The logic lives in `app/my_story.py`:

- Input validation (`schemas.StoryOptions`) allows only letters, spaces and basic
  punctuation in student text, requires Pifik, and limits lengths.
- `my_story_prompt` passes student text as clearly marked data with child-safety rules;
  the problem, exercise, hints and answer stay server-owned exactly as in classic comics.
- `validate_my_story` applies the classic checks (exact exercise and hints, ordered scenes,
  no numbers outside panel 4) after masking the student's own names and place, and also
  requires selected speakers only, Pifik on panel 4, and a line for every student hero.
- Live images use `my_story_image_prompt` (style, setting, selected cast only). Prepared
  mode maps cast speakers to the bundled portraits and gives student-hero panels a
  `placeholder`. Live jobs resume with the saved storyboard like classic jobs.

### Chapter 3 continuation jobs

The frontend sends `POST /api/continuation-jobs` for `sourceChapterId: "school-quest-map"`.
The available choices are `library-cabinet-key`, `new-route-note`, `fair-attraction-ticket`,
and `free-premise`. The free choice requires a moderated premise. The response uses the
regular 202 job shape and the same status and reader APIs.

The configured text provider writes a bilingual episode around a server-owned problem.
The library episode keeps the six pictured loose books and three boxes fixed and renders
Pifik's equation directly from server-owned values. All continuations use four prepared
panels and require no image-provider calls. Panel 3 uses the check and hint endpoints with
a whole-number answer.

### Teacher drafts and assignments

The teacher starts a private My Story job and polls it through the usual status endpoint.
The SQLite comic store links the job to its author and keeps the generated draft. On
publication the API creates an assignment snapshot in the accounts database, with six
edited panels, one boss round on panel 4, localized hints, and an optional due date.
Class membership gates access to the snapshot and its exercise.

Teacher-entered expected answers use the exact parser in `app/answers.py`. For an equation
boss the parsed value must be an integer. The teacher checks that the expected answer
matches the editable problem text. AI task assistance selects from server-generated
problems and drafts hints. The bundled problem bank contains demonstration equations.

Assignment answers use the existing analytics logs. The accounts database records the
first opening of each hint per student and assignment. See the
[assignment endpoints](../docs/api-contract.md#teacher-authored-class-assignments).

## Provider configuration

See [`.env.example`](.env.example) for all settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMIC_PROVIDER` | `openai` | Selects `openai` or `gemini` for both story and images |
| `COMIC_ART_MODE` | `live` | Use `prepared` for the six bundled illustrations and zero image API calls |
| `GEMINI_API_KEY` | empty | Gemini Developer API key with access to the selected models |
| `GEMINI_TEXT_MODEL` | `gemini-3.8-flash` | Gemini model supporting structured JSON output |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image` | Native Gemini model supporting image generation and reference images |
| `OPENAI_API_KEY` | empty | OpenAI API key with text/image model access and billing |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Server-controlled REST base URL |
| `OPENAI_TEXT_MODEL` | `gpt-6-luna` | Chat Completions model supporting strict JSON Schema |
| `OPENAI_TEXT_REASONING_EFFORT` | `none` | Set empty to omit for models that do not accept this field |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-flare` | Image generations and reference-image edits with base64 PNG output |
| `PROVIDER_TIMEOUT_SECONDS` | `180` | Wall-clock limit per upstream request |
| `JOB_TIMEOUT_SECONDS` | `1500` | Wall-clock limit for the complete job |
| `WORKER_POLL_SECONDS` | `1` | Idle queue polling interval |
| `TEXT_ATTEMPTS` | `3` | Storyboard attempts (1-5) before a job fails |
| `DATABASE_URL` | `data/accounts.sqlite3` | Accounts DB (`postgresql+asyncpg://…`) |
| `JWT_SECRET` | random per process | Signs sign-in tokens; set a long random value |
| `JWT_HOURS` | `12` | Token lifetime |
| `STORY_CACHE` | `1` | Reuse stories (see Story cache) |
| `REDIS_URL` | empty (SQLite) | Express story cache, e.g. `redis://127.0.0.1:6380/0` |
| `CACHE_VARIANTS` | `1` | Stories kept per Express key before reuse starts |
| `SEMANTIC_THRESHOLD` | `0.92` | Minimum premise similarity for «Моя история» reuse |
| `EMBEDDING_MODEL` | multilingual MiniLM | fastembed model for premises |
| `COMIC_DATA_DIR` | `data` | Shared SQLite and image directory; relative to `backend/` |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:8000` | Externally reachable API base, including any reverse-proxy prefix |

The Gemini adapters use the official [Google Gen AI SDK](https://googleapis.github.io/python-genai/)
with [structured output](https://ai.google.dev/gemini-api/docs/structured-output) for stories
and [native image generation](https://ai.google.dev/gemini-api/docs/image-generation) for panels.
Each live panel uses the same bundled character reference for Aldiyar, Aruna, and Pifik.

The OpenAI adapters use [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and the [Image API](https://developers.openai.com/api/docs/guides/image-generation).
Defaults use [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) and
[GPT-Image-2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
Alternative OpenAI endpoints must implement the same REST contracts. OpenAI requests
low-quality 1024×1024 images. Each standalone live-art job validates its bilingual
storyboard before making six reference-image edits. Panels 5 and 6 show the resolution
and the reader unlocks them after a correct answer. Dialogue and math are rendered by the UI.
Set `COMIC_PROVIDER=openai`, `OPENAI_TEXT_MODEL=gpt-6-luna`, and `COMIC_ART_MODE=live`
for both the API and worker. Set `VITE_COMIC_ART_MODE=live` for the live frontend.
Use `prepared` for both art settings to switch back to bundled artwork.
Failed jobs require an explicit retry.

### Prepared artwork demo

Set `COMIC_PROVIDER=gemini` and `COMIC_ART_MODE=prepared` in `backend/.env`, then restart
the worker. Gemini generates the bilingual story and the server verifies the exercise and
hints as usual. The prompt describes the six bundled portraits in order, and validation fixes
each panel to its depicted speaker. The reader displays the dialogue as UI text and labels the
comic as an AI-generated story with prepared artwork.

Serve the app from the combined checkout so the backend can read the six existing JPEGs in
`frontend/public/mock-images/`. The API serves them at `/api/prepared-art/{panelId}.jpg`.
The worker skips all image provider calls and saves only comic data. Setting
`COMIC_ART_MODE=live` restores image generation for future jobs. Existing comics retain their
own artwork source when the setting changes.

## Math, validation, and persistence

The server chooses and persists fixed operands at enqueue time. For a new fractions story the
text model first chooses a resource from a vetted shortlist based on the setting or the student's
premise. The worker uses that choice throughout the dialogue, math prompts, boss rounds, and
live illustration directions. Basic problems divide whole units among friends, intermediate
problems divide a fractional quantity, and advanced problems
add unlike fractions before dividing. Grade 6 uses larger operands/denominators. The expected
answer is computed with exact server-side fraction arithmetic and stored privately.

Equations (`topic: "equations"`) use the same flow with server templates in `app/problems.py`:
unknown addend/minuend (basic), unknown factor/dividend (intermediate) and two-step
`a · x ± b = c` (advanced). Answers are always positive whole numbers. `app/answers.py` checks
them exactly with SymPy and accepts `3`, `3.0`, `3,0`, `x = 3`, `х = 3`, `3 = x` or `6/2`.
Student text is matched against a strict ASCII-digit pattern first and is never passed to
`sympify`/`parse_expr` (they use `eval`). Equation scenes show a chest sealed by a riddle lock,
with no digits in the pictures.

Each standalone generated comic also stores two extra boss rounds (same topic, grade and difficulty) in the
`boss_rounds` table; the reader's panel-four boss fight checks them through the usual exercise
endpoints.

Storyboard retries: if the text model returns invalid JSON, breaks a validation rule, times out
or is unavailable, the worker asks again, up to `TEXT_ATTEMPTS` times. A retry tells the model the
broken rule by name only (for example `story_application_validation:ru.panels[0].text:no_number_words`),
never the rejected text. Authentication, rate-limit and configuration errors fail at once.

The text provider receives only the fixed inputs, grade/difficulty, character descriptions,
and trusted RU/KK exercise/hint text. It writes localized narrative and echoes the exercise
and two hints. Validation requires exact trusted math text, ordered panels, fixed scene IDs,
stable speaker IDs across translations, and no extra fields. Free narrative/title fields must
be Cyrillic and exclude digits, fraction symbols, and common Russian/Kazakh number words.
This deliberately conservative check may reject otherwise reasonable model wording; a rejection
fails the job instead of publishing it. Exercise and hints are server-authored to keep all
math instructions reliable without disclosing the final answer.

Image prompts come from server-owned scene directions and a shared character description.
They contain no dialogue, problem operands, or solution. In fractions stories the same prop
appears throughout the story. The last two scenes show the friends using it without revealing
quantities or servings. Resuming live illustration work keeps the selected resource.
Reference-image editing encourages consistent faces and clothes. Visual consistency and absence
of accidental lettering still depend on the image model; deterministic checks cannot assess
real artwork. Returned files are decoded, validated, normalized to PNG, and stripped of metadata.

`data/comics.sqlite3` holds queued requests, statuses, bilingual comics, hints, and **private
answers**. `data/images/` holds generated files. The API serves artwork from finished comics or
drafts with signed artwork URLs. Publication of a standalone comic, exercise, and `ready`
status is one SQLite transaction after all live panels are saved. Resumable image failures
keep the validated storyboard and completed panels.

Workers atomically claim jobs with SQLite transactions, preventing duplicate consumption even
with multiple local worker processes. A lease lasts the job timeout plus 30 seconds. Graceful
shutdown marks the current job `worker_interrupted`; after a crash, a worker marks expired
running jobs failed on its next claim/poll. They are not reissued automatically. Abrupt crashes
can leave unreferenced image files on disk, but these are not served. This is a single-host
demo queue using local storage. Standalone generation supports guests. The teacher draft
routes require an authenticated teacher. The queue has no per-user generation quotas.

Safe failure codes are `provider_not_configured`, `provider_authentication`,
`provider_rate_limited`, `provider_timeout`, `provider_unavailable`, `invalid_provider_output`,
`job_timeout`, `worker_interrupted`, `image_generation_failed`, and `generation_failed`.
Image failures report the panel and provider stage in worker logs and leave the job unpublished.
Upstream error bodies, keys,
model output, and private answers are excluded from public error responses and worker logs.
Worker logs can identify the Gemini response stage, HTTP status, or story validation
field and rule. Unknown field names from a model are redacted.

## Automated checks

```powershell
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m ruff format --check .
.venv\Scripts\python -m pytest
```

The default suite requires no credentials and makes no real provider calls. It covers the
original pizza demo, all supported input combinations, persistence/restarts, concurrent claims,
crash recovery, partial failures, exact answer checks, localized hints, solution-leak rejection,
HTTP provider request/response contracts, deadlines, and browser-loadable images. Deterministic
provider substitutes and `httpx.MockTransport` verify the full flow.

To run **one paid real generation** through the actual adapters and standalone worker:

```powershell
$env:RUN_LIVE_GENERATION = "1"
.venv\Scripts\python -m pytest tests/test_live_generation.py -v -s
Remove-Item Env:RUN_LIVE_GENERATION
```

This test skips if the selected provider's API key is absent. It uses an isolated temporary data directory,
verifies six image URLs, both translations, answer checking, and two hints, and prints the
artifact directory for inspection. It does not prove visual quality; review the actual PNGs.
