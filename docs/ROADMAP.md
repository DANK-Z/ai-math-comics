# AI Math Comics roadmap

The baseline was checked against `main` at `7faa312` (2026-11-22). Sections updated in the current roadmap work also describe the changes in this branch.
Commit hashes point to the change that introduced the behavior.

| Status | Meaning |
| --- | --- |
| **Done** | Implemented on `main` or in the current roadmap branch where noted. |
| **In progress** | Part of the item is implemented; the remaining parts are listed. |
| **Planned** | Not implemented yet. |

All features keep Russian and Kazakh support.

## Already implemented

These items are not on the request list, but the planned work builds on them.

| Area | What exists | Evidence |
| --- | --- | --- |
| Comic reader | One-panel reader, exercise unlocks the ending, Pifik hints, ru/kk switching, artwork sized to the viewport | `7d2f6b3`, `48cb88b`, `8ee486c` |
| Operation: School Fair | Six bundled chapters with chapter transitions; they work without a story generator | `b51e49f` |
| Season features | Saved progress, route map, backpack collectibles, Guardian final challenge | `99eab7c`, `0e6a76e`, `895b1a3`, `9dc0af2` |
| Comic generation | Gemini or OpenAI story text; prepared or live artwork | `030c440`, `18d3a54` |
| Chapter 3 continuation | A generated library episode after Chapter 3 | `f1ab300` |
| My Comics | Browser history of generated comics with Open and Replay | `efbd962` |
| Road Guardian | Motion-problems boss: pursuit, head-on and river phases, 90 HP | `4f60846` |
| Panel-four boss fight | Every generated comic: Fraction Slime or X Master, 90 HP, three server rounds | `a964b80` |
| Equations generation | `topic: "equations"`: find x, whole-number answers, three difficulty levels | `a964b80` |
| Storyboard retries | Up to `TEXT_ATTEMPTS` model attempts, the retry names the broken rule | `a964b80` |

## Roadmap

### 1. My Story mode — Done (with known limits)

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Custom heroes | Done | Up to two student heroes speak in the comic. Prepared art uses placeholders, and live art uses their moderated descriptions to draw them. |
| Visual styles | Done for live art | Comic, cartoon and pixel styles go into the image prompt. Prepared art ignores the style. |
| Settings | Done for live art | School, space, forest or a custom place. |
| Student premise | Done | Optional; Pifik invents a beginning when it is empty. |
| Drawing custom heroes with consistent references | Done | One private custom cast reference per job, shared by all images and retained across resume. |
| Stronger moderation of student text | Done | Format checks at intake and provider classification before generation. |

### 2. Story continuations — Done

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Generate the "library cabinet key" episode after Chapter 3 | Done | `f1ab300`, `POST /api/continuation-jobs` |
| Generate episodes for the other two Chapter 3 choices ("new route note", "fair attraction ticket") | Done | Both use server-owned math and prepared artwork. |
| Free-form student choice | Done | The story job checks and moderates the student premise before generation. |

### 3. Generation quality — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Panel-by-panel progress | Done | `29e3d7c` (job `progress`, `GenerationProgress.tsx`) |
| Resume missing panels after a failed live-art job | Done | `b7fd4fe` (`POST /api/comic-jobs/{jobId}/resume`) |
| Consistent characters | In progress | Each live panel gets fixed character descriptions and the cast reference strip. There is no automated consistency check yet. |
| Consistent props | In progress | Every live panel receives the same description for the model-selected fraction resource or equation chest. Visual consistency across completed images still needs verification. |
| Clear story resolution | Done | The final panel includes a bilingual server-authored consequence of solving the story's problem. The illustration prompt does not receive this text or the answer. |
| Story-specific boss | Done | The model chooses the look and writes bilingual dialogue. The boss is drawn on the exercise panel in live artwork, with server-owned rounds. |
| Dialogue presentation | Done | Bilingual storyboard emotions drive bubble colours and character expressions. Dialogue entry and parallax respect reduced-motion settings. |
| Parallax layers | Available | An optional local segmentation model splits new live panels. The reader moves the foreground faster than the background and supports phone tilt where available. |

### 4. My Comics — Done

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Saved list with Open and Replay | Done | `efbd962`. Keep Replay. |
| Rename | Done | A custom title is saved in the browser and can be cleared to restore the original. |
| Remove from the personal list with undo | Done | The list entry can be restored from the confirmation on the same screen. |
| Search and filter | Done | Search by title and filter by comic type. |
| Continue from the last panel with saved hints | Done | Open restores the last panel, revealed hints, and whether the exercise is solved. Replay starts over. |

### 5. Navigation — Done

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Continue Season | Done | The map highlights the first unfinished chapter and links to it from a dedicated action. |
| Quick access to the last opened comic | Done | The map links to the last comic that loaded in this browser. |

### 6. Pifik hints — In progress

| Part | Status | Notes |
| --- | --- | --- |
| Visual diagrams | In progress | Chapter 3 offers a selectable map-scale diagram in Russian and Kazakh. |
| Rule reminders and guided steps | Done | Chapters 1, 2, 4, 5 and 6 have a bilingual rule reminder and a guided hint. Chapter 3 retains the selectable first step, diagram and example. |
| Similar examples | In progress | Chapter 3 offers a solved example with a different map distance. |
| Targeted feedback for common mistakes | In progress | Chapter 3 recognizes copying the map distance, using a single scale segment, and adding the operands. Other exercises still use their existing feedback. |

### 7. Secret puzzles and stickers — Done

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Optional secret puzzle with a sticker | Done | School Store second price tag bonus (`7e838ae`). |
| Chapter collectibles in the backpack | Done | `895b1a3` |
| More optional secret puzzles and stickers | Done | Library bookmark and lemon-slice puzzles after chapters 4 and 5. They use the existing sticker sync and do not count as chapter collectibles. |

### 8. Guardian upgrades — Done

Generated comics now end in a panel-four boss fight with an animated HP bar (`a964b80`), a draft
pad and a victory screen (chest, coin burst, trophy card with stars, share with a copy fallback), and the
Road Guardian has visual phases (`4f60846`). Progress in the generated-comic boss fight is saved in the browser and can be restored from the answer log for signed-in students.

The Guardian final challenge exists (`9dc0af2`): three rounds (fractions, percentages, scale) and an HP bar.

| Part | Status | Notes |
| --- | --- | --- |
| Visual phases | Done | Each topic has a distinct panel accent and icon. |
| Guardian arena and hit feedback | Done | Pifik faces the Guardian with motion for hits, blocks and victory. The answer area shows damage and remaining HP, including with reduced motion. |
| New problem numbers on replay | Done | Replay alternates two additional sets of operands and saves the active set across reloads. |

### 9. Motion League — Done

| Part | Status |
| --- | --- |
| Pursuit problems | Done in Road Guardian (`4f60846`) |
| Head-on meeting problems | Done in Road Guardian (`4f60846`) |
| River current problems | Done in Road Guardian (`4f60846`) |
| Average speed problems | Done in Motion League |
| Practice mode | Done. Choose a topic and retry without penalties. |
| Challenge mode with optional hearts, a timer, and crystals | Done. Four tasks, with independent options for three hearts, three minutes, and a crystal per correct answer. |

### 10. Teacher features — In progress

| Part | Status |
| --- | --- |
| Student and teacher accounts (login without e-mail for students, JWT roles) | Done |
| Class codes (`KOKSH-5A-2026`) and joining a class | Done |
| Class dashboard: ranking by stars, combo, misses; error heatmap by round and skill; review recommendation | Done |
| Server-side coins and stars from boss fights; boss and season progress restored after reload / on another device | Done |
| Backpack shop and Pifik skins (glasses, yellow backpack, racer helmet) | Done |
| Personalized item stories | Done. Shop skins and earned School Fair collectibles have fictional lore and a separate, verified achievement note. |
| Power-ups for boss fights | Done for the School Fair Guardian. Students get one worked example and one solution plan per run. |
| Story cache: Redis for Express, pgvector + local embeddings for «Моя история» (fresh math every time) | Done |
| Shareable chapter assignments | Done. A teacher can choose a chapter and copy its direct student link from the class dashboard. |
| Authoring and publishing class comics | Done. A teacher generates a private six-panel draft, edits it in RU/KK, chooses the panel-four boss and publishes a snapshot to one class with an optional due date. |
| Manual problems, AI task assistance and a problem bank | Done for manual answers, curated AI selection and a demonstration bank. Adding the teaching team's problem collection remains planned. |
| Class assignment map and hint report | Done. Students see assignments on the map. The teacher can distinguish independent solutions from solutions with hints. |
| Configurable Guardian rounds for review or assessment | Done. Teachers choose topics, a number set, and whether to allow boosts, then share a link. The season unlock rule still applies. |
| Weekly class league and class battles on the board | Done. Students hit one shared boss from their phones; the server picks and checks every problem. |
| Review of weak spots | Done. A one-click battle on the recommended topic, a five-problem drill on the student's weakest skill, and a drill offer after two wrong answers in a chapter. |
| Curriculum goals | Done. Every bundled chapter shows its grade, course section and lesson goal; the class page groups chapters by section. Official objective codes are not listed. |
| Password reset, teacher-managed student accounts | Planned |
| Rate limiting of sign-in | Done. Shared counters cap attempts per IP and per login/IP. |
| Database migrations (Alembic) before a pilot | Done for the accounts database. See [migration instructions](account-migrations.md). |

Accounts are optional: guests still play with progress saved only in the browser.
Authoring and completing class assignments requires the live API and the corresponding teacher
or student account. See the [classroom walkthrough](../frontend/README.md#classroom-assignments).

### 11. New comics and exercise templates — Planned

| Part | Status | Notes |
| --- | --- | --- |
| New comics and exercise templates from the upcoming Grade 5–6 teaching materials | In progress | Generation supports grades 5–6, the `fractions` and `equations` topics (`a964b80`), and three difficulties. Bundled chapters also cover percentages, scale, proportions, and perimeter. Server templates for GCD/LCM, decimal fractions and problems on parts power class battles and review drills; comics for them still need artwork. |
| Russian and Kazakh support | Done, keep for all new content | `LANGS = ['ru', 'kk']` |
| Voice answer entry | Available with a local multilingual checkpoint | RU/KK recognition fills the boss answer field. Students review and submit through the existing checker. |

### 12. Pilot hosting — In progress

| Part | Status |
| --- | --- |
| API, worker and frontend containers, with shared comic storage | Done |
| Same-origin routing and HTTPS configuration | Done |
| Account and comic backup workflow | Done |
| External deployment and public certificate validation | Planned. Requires the pilot host and domain. |
