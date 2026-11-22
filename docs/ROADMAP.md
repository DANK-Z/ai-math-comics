# AI Math Comics roadmap

Status was checked against the code and Git history on `main` at `a964b80` (2026-11-22).
Commit hashes point to the change that introduced the behavior.

| Status | Meaning |
| --- | --- |
| **Done** | Implemented on `main`. |
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
| Custom heroes | Done as text | `d74bfb5`. Up to two student heroes speak in the comic. With prepared art their panels show a setting placeholder; live art draws only the cast. |
| Visual styles | Done for live art | Comic, cartoon and pixel styles go into the image prompt. Prepared art ignores the style. |
| Settings | Done for live art | School, space, forest or a custom place. |
| Student premise | Done | Optional; Pifik invents a beginning when it is empty. |
| Drawing custom heroes with consistent references | Planned | Needs per-hero reference images. |
| Stronger moderation of student text | Planned | Today: input rules + prompt instructions. |

### 2. Story continuations — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Generate the "library cabinet key" episode after Chapter 3 | Done | `f1ab300`, `POST /api/continuation-jobs` |
| Generate episodes for the other two Chapter 3 choices ("new route note", "fair attraction ticket") | Planned | They appear only as previews (`1074bcf`). The API accepts only `choiceId: "library-cabinet-key"`. |
| Free-form student choice | Planned | No free-text input. |

### 3. Generation quality — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Panel-by-panel progress | Done | `29e3d7c` (job `progress`, `GenerationProgress.tsx`) |
| Resume missing panels after a failed live-art job | Done | `b7fd4fe` (`POST /api/comic-jobs/{jobId}/resume`) |
| Consistent characters | In progress | Each live panel gets fixed character descriptions and the cast reference strip. There is no automated consistency check yet. |
| Consistent props | In progress | The courtyard, bunting, and picnic table are fixed in the prompt. Props are not tracked from panel to panel. |
| Clear story resolution | In progress | Live comics use a fixed scene order that ends with "serve" and "celebrate", and the library episode has an `ending` line. The resolution is not yet required to follow from the solved problem. |

### 4. My Comics — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Saved list with Open and Replay | Done | `efbd962`. Keep Replay. |
| Rename | Planned | |
| Remove from the personal list with undo | Planned | Removal exists only for comics that fail to load, without undo. |
| Search and filter | Planned | |
| Continue from the last panel with saved hints | Planned | Reader position, answers, and hints are not saved. Open starts at panel 1. |

### 5. Navigation — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Continue Season | In progress | The route map highlights the next unfinished chapter as «Следующая остановка» (`0e6a76e`). There is no dedicated Continue Season action. |
| Quick access to the last opened comic | Planned | |

### 6. Pifik hints — Planned

| Part | Status | Notes |
| --- | --- | --- |
| Visual diagrams | Planned | Hints are text only. |
| First-step explanations | Planned | Each exercise has two fixed text hints. |
| Similar examples | Planned | |
| Targeted feedback for common mistakes | Planned | Feedback depends only on whether the answer is correct, incorrect, or invalid. |

### 7. Secret puzzles and stickers — In progress

| Part | Status | Evidence / notes |
| --- | --- | --- |
| Optional secret puzzle with a sticker | Done | School Store second price tag bonus (`7e838ae`). |
| Chapter collectibles in the backpack | Done | `895b1a3` |
| More optional secret puzzles and stickers | Planned | |

### 8. Guardian upgrades — In progress

Generated comics now end in a panel-four boss fight with an animated HP bar (`a964b80`), and the
Road Guardian has visual phases (`4f60846`). The season's Guardian final challenge is unchanged.
Boss-fight progress is not saved: reloading restarts the fight.

The Guardian final challenge exists (`9dc0af2`): three fixed rounds (fractions, percentages, scale) and an HP bar.

| Part | Status | Notes |
| --- | --- | --- |
| Visual phases | Planned | |
| New problem numbers on replay | Planned | Round answers are fixed in `frontend/src/guardian.ts`. |

### 9. Motion League — In progress

| Part | Status |
| --- | --- |
| Pursuit problems | Done in Road Guardian (`4f60846`) |
| Head-on meeting problems | Done in Road Guardian (`4f60846`) |
| River current problems | Done in Road Guardian (`4f60846`) |
| Average speed problems | Planned |
| Practice mode | Planned |
| Challenge mode with optional hearts, a timer, and crystals | Planned |

### 10. Teacher features — Planned

| Part | Status |
| --- | --- |
| Shareable chapter assignments | Planned |
| Class progress summary | Planned |
| Configurable Guardian rounds for review or assessment | Planned |

Progress and history are saved only in the student's browser. There are no accounts or a shared server-side record yet.

### 11. New comics and exercise templates — Planned

| Part | Status | Notes |
| --- | --- | --- |
| New comics and exercise templates from the upcoming Grade 5–6 teaching materials | In progress | Generation supports grades 5–6, the `fractions` and `equations` topics (`a964b80`), and three difficulties. Bundled chapters also cover percentages, scale, proportions, and perimeter. |
| Russian and Kazakh support | Done, keep for all new content | `LANGS = ['ru', 'kk']` |
