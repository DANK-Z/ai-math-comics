# AI Math Comics roadmap

Status was checked against the code and Git history on `main` at `576e2fa` (2026-11-22).
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

## Roadmap

### 1. My Story mode — Planned

| Part | Status | Notes |
| --- | --- | --- |
| Custom heroes | Planned | The cast is fixed to Aldiyar, Aruna, and Pifik (`backend/app/story.py`, `CHARACTERS`). |
| Visual styles | Planned | Live art uses one bright comic style. |
| Settings | Planned | Generated comics use one fixed setting, the school fair courtyard. |
| Student premise | Planned | The Create Comic form takes only grade, topic, language, and difficulty. |
| Consistent character references across panels | Planned for custom heroes | The fixed cast already uses a reference strip in every live panel (`prepared_art.live_cast_reference`). Custom heroes will need their own references. |

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

### 8. Guardian upgrades — Planned

The Guardian final challenge exists (`9dc0af2`): three fixed rounds (fractions, percentages, scale) and an HP bar.

| Part | Status | Notes |
| --- | --- | --- |
| Visual phases | Planned | |
| New problem numbers on replay | Planned | Round answers are fixed in `frontend/src/guardian.ts`. |

### 9. Motion League — Planned

| Part | Status |
| --- | --- |
| Pursuit problems | Planned |
| Head-on meeting problems | Planned |
| River current problems | Planned |
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
| New comics and exercise templates from the upcoming Grade 5–6 teaching materials | Planned | Generation supports grades 5–6, the `fractions` topic, and three difficulties. Bundled chapters also cover percentages, scale, equations, proportions, and perimeter. |
| Russian and Kazakh support | Done, keep for all new content | `LANGS = ['ru', 'kk']` |
