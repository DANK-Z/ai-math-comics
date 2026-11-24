\# AI Math Comics — Demo API



Backend: http://127.0.0.1:8000

Frontend: http://localhost:5173

Allow the frontend origin in FastAPI CORS.



\## GET /api/comics/pizza-fractions?lang=ru



Supported languages: ru, kk.

Response: {"id":"pizza-fractions","lang":"ru","title":"...",

"panels":\[{"id":1,"speaker":"...","text":"...","imageKey":"pizza-01"}],

"exercise":{"id":"pizza-share","panelId":4,"prompt":"..."}}



Return six panels. The question asks how much pizza each friend gets when

three identical pizzas are shared equally among four friends.

The frontend maps imageKey to its local illustration or placeholder.



\## POST /api/exercises/pizza-share/check



Request: {"answer":"6/8","lang":"ru"}

Response: {"status":"correct","message":"..."}



Supported statuses: correct, incorrect, invalid.

Use exact fraction arithmetic. Accept 3/4 and equivalent fractions.

Return localized feedback. A zero denominator is invalid.



\## GET /api/exercises/pizza-share/hints?lang=ru\&step=1



Supported steps: 1, 2.

Response: {"step":1,"text":"...","hasMore":true}



Return localized hints that guide the student without giving the answer.

## AI generation: POST /api/comic-jobs

Request (all fields required):

```json
{"grade":5,"topic":"fractions","lang":"ru","difficulty":"basic"}
```

Supported values: integer grades `5`, `6`; topics `fractions`, `equations`; languages `ru`, `kk`;
difficulties `basic`, `intermediate`, `advanced`. Unsupported values, extra fields,
or malformed requests return HTTP 422.

### My Story mode (optional `story`)

Add `story` to let the student shape the comic around the same trusted problem:

```json
{"grade":5,"topic":"fractions","lang":"ru","difficulty":"basic",
 "story":{"heroes":["pifik","aruna"],
          "customHeroes":[{"name":"Тришка","description":"Любит собирать шестерёнки"}],
          "style":"pixel","setting":"custom","customSetting":"На дне океана",
          "premise":"Герои нашли старую карту сокровищ."}}
```

- `heroes`: 1–3 unique cast IDs from `aldiyar`, `aruna`, `pifik`; `pifik` is required
  because he presents the exercise and gives the hints.
- `customHeroes`: 0–2 student heroes, `name` 1–24 characters, `description` up to 80.
  Names must be unique and differ from the cast names.
- `style`: `comic`, `cartoon` or `pixel`. `setting`: `school`, `space`, `forest` or
  `custom`; `customSetting` (up to 60) is required exactly when `setting` is `custom`.
- `premise`: optional, up to 280 characters. Empty means the model invents a beginning.
- Student text is normalized (spaces collapsed) and may contain only letters, spaces and
  basic punctuation: no digits, math symbols, markup or links. Violations return 422.

The comic keeps the usual six panels with the exercise on panel 4, spoken by Pifik,
and the server still owns the problem, exercise text, hints and answer. Student text is
passed to the model as data and never as instructions. In live art mode every panel is
drawn in the chosen style and setting showing only the selected cast; student heroes
are not drawn and their descriptions and the premise never reach the image model. In
prepared art mode cast speakers get their bundled portraits, and panels spoken by a
student hero have no `imageUrl` and instead carry `"placeholder":{"setting":"…"}`.
Panel `speaker` is the display name, so student heroes appear under their own names.

Return HTTP **202** immediately after persisting the job:

```json
{"jobId":"<unique-job-id>","status":"queued"}
```

Generation runs in the standalone backend worker, independently of the request.
The original pizza demo remains available without a worker or credentials.

## GET /api/comic-jobs/{jobId}

```json
{"jobId":"<unique-job-id>","status":"queued","comicId":null,"errorCode":null}
```

Statuses: `queued`, `running`, `ready`, `failed`. `comicId` is non-null only when
ready. `errorCode` is non-null only when failed. Missing jobs return HTTP 404.
New jobs also return `progress.stage`: `queued`, `storyboard`, `drawing`,
`preparing` (prepared artwork), or `ready`. Once the storyboard passes validation,
`progress.completedPanels` and `progress.totalPanels` describe the saved panels.
Live counts advance after each image is saved. Prepared panels count when the comic
is published. Failed jobs retain their last stage and counts. Older records may omit
`progress`.

An image-generation failure with saved panels includes a `resumeToken`.
Send it as `{"resumeToken":"…"}` to `POST /api/comic-jobs/{jobId}/resume`.
HTTP 202 returns the existing job status. The worker reuses the saved storyboard
and images. One token resumes at most one failed attempt. Read progress with the
existing GET endpoint. Missing jobs return 404 and jobs that cannot resume return 409.
Safe error codes: `provider_not_configured`, `provider_authentication`,
`provider_rate_limited`, `provider_timeout`, `provider_unavailable`,
`invalid_provider_output`, `job_timeout`, `worker_interrupted`, `image_generation_failed`,
`generation_failed`.
Provider response bodies and secrets are never returned.

## GET /api/comics/{comicId}?lang=ru

Reuse the existing comic shape, adding `imageUrl` to each **generated** panel:

```json
{
  "id":"<comic-id>",
  "lang":"ru",
  "title":"...",
  "panels":[
    {"id":1,"speaker":"...","text":"...","imageKey":"<comic-id>-01",
     "imageUrl":"http://127.0.0.1:8000/api/comic-images/<comic-id>/1.png"}
  ],
  "exercise":{"id":"fractions-<comic-id>","panelId":4,"prompt":"..."},
  "boss":{"kind":"fraction-slime","maxHp":90,"rounds":[
    {"exerciseId":"fractions-<comic-id>","prompt":"..."},
    {"exerciseId":"fractions-<comic-id>-r2","prompt":"..."},
    {"exerciseId":"fractions-<comic-id>-r3","prompt":"..."}
  ]}
}
```

Actual responses contain six ordered panels, with the exercise in panel 4.
Each generated comic is available in both `ru` and `kk`, sharing six illustrations
and the exercise ID. `lang` defaults to `ru`; unsupported languages return 422.
Unknown/unpublished comics return 404. Image URLs are absolute backend URLs
configured by `PUBLIC_BASE_URL` and need no provider credentials. Live images are PNG files
and belong to published comics only. Live panels may include `imageAspect` for their
width-to-height ratio. Prepared-art comics include `"artwork":"prepared"`
and use the six shared JPEGs at `/api/prepared-art/{panelId}.jpg`. The original `pizza-fractions` response
continues to omit `imageUrl` and uses the existing local `imageKey` mapping.

Generated exercises reuse `POST /api/exercises/{exerciseId}/check` and
`GET /api/exercises/{exerciseId}/hints?lang=ru&step=1` with the same request/response
shapes and validation as `pizza-share`. Every generated comic has a unique
exercise ID and two progressive localized hints. Expected answers stay server-side;
equivalent fractions are checked with exact arithmetic. Unknown exercises return 404.

### Panel emotion and depth

The optional `emotion` field can be `neutral`, `happy`, `confused`, `scared`, `surprised`
or `angry`. New standalone storyboards use the same value in both translations. Missing
values render as neutral. Dialogue remains plain text.

A live-art panel may also include `layers: {backgroundUrl, foregroundUrl}`. Both URLs serve
WebP and follow the same authorization as the original artwork. The foreground has an alpha
channel. Always keep `imageUrl` as the full-image fallback.

### Topics

- `fractions`: share a resource chosen to fit the story, such as lemonade, ribbon, or water.
  The server supplies the localized exercise, operands and hints. Answers are fractions `a/b`.
- `equations`: find `x` in a linear equation chosen by the server (`x + a = b`, `x − a = b`
  for basic; `a · x = b`, `x : a = b` for intermediate; `a · x + b = c`, `a · x − b = c`
  for advanced). The answer is always a positive whole number, so the exercise and every
  boss round carry `"answerFormat":"whole-number"` and IDs start with `equations-`.
  Check reads the value of x exactly (SymPy `Rational`, no floats). All of these are the same
  answer: `3`, `3.0`, `3,0`, `x=3`, `x = 3.0`, `х = 3` (Cyrillic), `3 = x`, `6/2`; thousands
  spaces (`1 200`) and a leading minus are allowed. A different value is `incorrect`; words,
  expressions such as `2x=6` or `3+4`, and division by zero are `invalid`. Feedback for
  equations talks about x, never about pizza.

### Panel-four boss (`boss`)

New generated comics may include `boss.character` with localized `name`, `introduction`,
and `farewell` for the requested comic language. The live illustration of the exercise panel
includes the story's challenger. `kind`, HP, exercises, and reward rules keep their existing
meaning. Older comics can omit `character`.

Each standalone generated comic has a `boss` block for the panel-four fight. `kind` is
`fraction-slime` for fractions and `x-master` («Магистр Иксов») for equations. `maxHp` is 90
and each correct round deals `maxHp / rounds.length` (30) damage. `rounds[0]` is the comic's
own exercise; rounds 2 and 3 are extra server-owned problems of the same topic, grade and
difficulty (`<exerciseId>-r2`, `<exerciseId>-r3`). Each round is checked and hinted through the
usual exercise endpoints. Rounds are generated by the server, never by the text model, and their
answers stay server-side. Teacher assignments use one round. Continuations, the static demo
and the catalog chapters omit `boss`.

## Accounts, progress and the teacher dashboard

Optional for students: guests keep playing exactly as before (progress stays in the browser).
Signed-in users send `Authorization: Bearer <token>` (HS256 JWT, 12 h by default).

| Method and path | Who | Body / result |
| --- | --- | --- |
| `POST /api/auth/students` | anyone | `{"login","password","displayName","classCode"?}` → 201 `{token,user}`. Login: 3–24 of `a-z 0-9 _ . -` (stored lowercase), password 8–72, name without digits. 409 `login_taken`, 404 `class_not_found`. |
| `POST /api/auth/teachers` | anyone | `{"email","password","displayName"}` → 201 `{token,user}`. 409 `email_taken`. |
| `POST /api/auth/login` | anyone | `{"login","password"}` (a student login or a teacher e-mail) → `{token,user}`. 401 `wrong_login_or_password`. 429 `sign_in_rate_limited` includes a `Retry-After` header in seconds. |
| `GET /api/me` | signed in | `{id, role, displayName, login?, email?, schoolClass?, profile?}`; students get `profile {coins, stars, completedChapters, stickers, items}`. |
| `POST /api/me/class` | student | `{"code":"KOKSH-5A-2026"}` → `Me` (joins the class). |
| `PUT /api/me/progress` | student | `{"completedChapters":[…],"stickers":[…]}` → `Me`. Merged as a union: progress never shrinks. |
| `GET /api/me/boss/{comicId}` | student | `{comicId, cleared, misses, result?}`: restores a boss fight after a reload. |
| `POST /api/teacher/classes` | teacher | `{"grade":5,"letter":"А","school":"KOKSH"}` → 201 class `{id, name:"5 «А»", grade, code:"KOKSH-5A-2026", students}`. Codes get `-2`, `-3` … when taken. |
| `GET /api/teacher/classes` | teacher | the teacher's classes with student counts. |
| `GET /api/teacher/classes/{id}` | teacher (owner) | Dashboard: `students` (sorted by stars, then fewer misses; `bestCombo` = longest run of correct answers; per-topic `topics`), `heatmap` cells per topic × round × skill (`mistakeRate` = students with ≥1 wrong or unreadable answer ÷ students who answered, `invalidAnswers`, `commonWrong`), and `recommendation` (the cell with the highest rate once ≥2 students answered and ≥50% slipped; the UI turns its `skill` into «Повторить тему …»). Another teacher's class is 404. |

Wrong role → 403; missing or invalid token on a private route → 401. On
`POST /api/exercises/{id}/check` a stale token is ignored (the student plays as a guest).

**Coins and stars are decided by the server.** Every checked answer of a signed-in student in a
generated comic is logged (`analytics_logs`: topic, round, skill, status, misses so far, the text
entered — at most 64 characters). When the last unsolved round of a comic's boss is answered
correctly, the check response carries
`"reward": {"coins", "stars", "misses", "totalCoins"}` once: stars 3 / 2 / 1 for 0 / 1–2 / 3+
misses before each round was solved, coins `10 + 10 × stars`.

### One-time progress coins

`PUT /api/me/progress` also pays coins once per student for ids listed in
`frontend/src/progressRewards.json` (shared by the server and the frontend): every bundled
chapter 5, every finale 10 (`fair-finale`, `roads-finale`, `lights-finale`, `museum-finale`,
`weather-finale`, `mars-finale`) and every panel secret 5 (`secret-<chapter>`). Paid keys are
stored in `progress_rewards`, so a replay, a reload or two parallel requests pay nothing more.

### Class league, class battles and review drills

| Method and path | Who | Body / result |
| --- | --- | --- |
| `GET /api/me/leaderboard` | student in a class | This week's table (Monday 00:00 Almaty): `{className, weekStart, classSize, rows:[{rank, name, stars, coins, cleanWins, me}]}`. Top 10 plus the student's own row. Names are «Имя Ф.». 404 `no_class`. |
| `GET /api/teacher/classes/{id}/leaderboard` | teacher (owner) | The same table without `me`. |
| `POST /api/teacher/classes/{id}/battles` | teacher (owner) | `{"topic","difficulty"?,"hp"}` → 201 board. `topic`: `fractions`, `equations`, `gcd`, `decimals`, `parts`; `hp`: 300, 600 or 1000. A new battle stops the class's active one. |
| `GET /api/teacher/classes/{id}/battles/current` | teacher (owner) | The active battle, or one finished in the last hour, or `null`. |
| `GET /api/teacher/battles/{battleId}` | teacher (owner) | Board: `{id, classId, className, classCode, topic, maxHp, hp, damagePerHit, status, hits, fighters, top, recent, startedAt, finishedAt}`. |
| `POST /api/teacher/battles/{battleId}/stop` | teacher (owner) | Stops the battle → board. |
| `GET /api/me/battle?lang=` | student in a class | `{id, topic, maxHp, hp, damagePerHit, status, myHits, classHits, task?}`; `task {id, prompt, answerFormat}` while active, or `null` without a battle. |
| `POST /api/me/battle/{battleId}/answer` | student in a class | `{"taskId","answer","lang"}` → `{status, message, damage, battle}`. A correct answer deals 10 damage once; three misses bring a new problem. |
| `POST /api/me/practice` | student | `{"topic","skill"?,"lang"}` → the first of five problems `{id, topic, prompt, answerFormat, number, total}`. |
| `POST /api/me/practice/answer` | student | `{"taskId","answer","lang"}` → `{status, message, solved, total, next?}`. |
| `GET /api/me/practice/weak` | student | The skill missed most in boss fights over 14 days (at least twice): `{topic, skill, mistakes}`, or `null`. |

Problems for battles and drills are chosen on the server (`backend/app/practice.py`), stored
with the task and checked there; `answerFormat` is `fraction`, `decimal` or `whole-number`.

### Fair shop and Pifik skins

| Method and path | Who | Body / result |
| --- | --- | --- |
| `GET /api/v1/shop` | student | `{coins, equippedSkin, items:[{id, type:"skin", price, owned, equipped, backpackItemId}]}` |
| `POST /api/v1/shop/buy` | student | `{"itemId":"racer-helmet"}` → 201 shop. 409 `not_enough_coins` / `already_owned`, 404 `item_not_found`. |
| `POST /api/v1/backpack/equip` | student | `{"itemId": <backpackItemId>}` or `{"itemId": null}` to take it off → shop. 404 for someone else's item. |

Catalog and prices are server-owned: `smart-glasses` 40, `yellow-backpack` 50, `racer-helmet` 60.
A purchase locks the profile row, takes the coins with a conditional `UPDATE … WHERE coins >= price`
and adds the `backpack_items` row in the same transaction. One skin is worn at a time
(`student_profiles.avatar_item_id`); `GET /api/me` lists owned items with `equipped`, and the
frontend draws the worn skin on Pifik everywhere (constructor, hints, cast card, boss fight, map).
Panel illustrations are pictures and do not change.

## POST /api/continuation-jobs

```json
{"sourceChapterId":"school-quest-map","choiceId":"library-cabinet-key","locale":"kk"}
```

The source chapter is always `school-quest-map`. Supported `choiceId` values are
`library-cabinet-key`, `new-route-note`, `fair-attraction-ticket`, and `free-premise`.
The last choice requires a student-authored `premise` of up to 280 characters;
other choices reject this field. `locale` is `ru` or `kk` and the episode is available
in both. The server chooses the exercise operands and never exposes the expected
answer. The endpoint returns the regular HTTP 202 response and uses the same job
status URL. For a free premise the worker checks the student text before requesting
story generation. A rejected premise fails with `student_text_rejected`.

Ready episodes use the same comic endpoint. They have four panels and
`"artwork":"prepared"`. The library and map choices use the corresponding bundled
chapter panels in the reader. The ticket and free choices reuse prepared cast
portraits through `imageUrl`. No image provider is called for continuations.
The response includes
`continuation: { sourceChapterId, choiceId, nextChapterId }`, with
`nextChapterId` set to `library-boxes`.

The exercise is on panel 3 with `"answerFormat":"whole-number"`. It uses the
existing check and hint endpoints; the answer is still sent as a string, and
the expected answer stays on the server.

For `POST /api/comic-jobs` with My Story inputs, the worker checks the student text
before story or artwork generation. Live artwork uses one private reference sheet
for the custom and selected characters and applies it to all six panels. An image
resume reuses that sheet. Prepared artwork still uses placeholders for custom heroes.

See [backend setup and provider configuration](../backend/README.md).

## Teacher-authored class assignments

| Endpoint | Access | Contract |
| --- | --- | --- |
| `POST /api/teacher/comic-drafts` | Teacher | Regular generation input with required `story`. Returns the usual 202 job; the author can use the standard status and image-resume APIs. |
| `GET /api/teacher/comic-drafts?lang=ru` | Teacher | Author's jobs with localized `title` when ready and `publicationStatus: draft\|published`. |
| `GET /api/teacher/comic-drafts/{comicId}` | Author | `{ru: Comic, kk: Comic, task: {boss, answer, ru, kk}}`. Each localized task contains `prompt`, `hint1`, and `hint2`. Only the author can read the expected answer. |
| `GET /api/teacher/problem-bank` | Teacher | Seed demonstration tasks in the same task format. |
| `POST /api/teacher/comic-task` | Teacher | Regular grade, locale, topic and difficulty. The server computes candidate problems and their answers. The text provider selects a candidate and writes two validated hints per language. |
| `POST /api/teacher/comic-drafts/{comicId}/publish` | Author and class owner | `{classId, dueDate?, task, ru: {title, panels}, kk: {title, panels}}`. Each `panels` array holds six dialogue strings. `dueDate` is `YYYY-MM-DD` or null. Returns 201 and `{id, title, dueDate, completed}`. Retrying for the same class returns the original ID. Publishing the same draft to a different class returns 409 `draft_already_published`. |
| `GET /api/me/assigned-comics?lang=ru` | Student | Current class assignments with localized titles and the student's completion state. |
| `GET /api/teacher/classes/{classId}/assigned-comics?lang=ru` | Class owner | Each assignment plus `students: [{id, name, completed, hints}]`. For completed assignments, hint steps reflect usage through the first correct submission. |

A published assignment is a snapshot with a new ID and one boss round on panel 4.
Students in the class use that ID with the existing comic, answer, hint and boss-state
endpoints. The source draft stays private, and out-of-class requests for the published comic
or its exercise return 404. The class owner can also retrieve the published comic. Manual
answers use the exact parser in `answers.py`, with an integer required for the equation
boss. An unparseable or disallowed teacher answer returns 422 `invalid_teacher_answer`.
The teacher is responsible
for verifying that an authored problem and its answer agree.

The SQLite queue stores author ownership alongside jobs. The accounts database
(PostgreSQL in a deployed setup) stores the snapshots and hint events.
Run `alembic upgrade head` before starting a migration-enforced API.

## Voice answers and item lore

| Endpoint | Contract |
| --- | --- |
| `GET /api/voice` | `{enabled}` indicates whether a local checkpoint is configured. |
| `POST /api/voice/{lang}?kind=equation` | `lang` is `ru` or `kk`. `kind` is `equation` or `fraction`. The raw body is 16-bit mono PCM WAV at 16 kHz, at most eight seconds. Returns `{answer}` for review before checking. |
| `POST /api/v1/items/{itemKey}/lore?lang=ru` | Student-only. Accepts shop skin IDs and `collectible-<id>` for earned School Fair collectibles. Returns `{story, source, student, owned, acquiredAt, victoryAt, perfect, combo}`. Dates can be null and `source` is `generated` or `prepared`. |

The voice API rejects unsupported content (415), oversize clips (413), malformed or unrecognized
audio (422), a busy recognizer (429) and unavailable or timed-out recognition (503 or 504).
It does not record an exercise attempt. Item fiction is generated on request and cached per
student and language. The achievement refers to the latest verified boss victory and does not
imply the item was won in that fight.

