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

Supported values: integer grades `5`, `6`; topic `fractions`; languages `ru`, `kk`;
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
  "exercise":{"id":"fractions-<comic-id>","panelId":4,"prompt":"..."}
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

## POST /api/continuation-jobs

```json
{"sourceChapterId":"school-quest-map","choiceId":"library-cabinet-key","locale":"kk"}
```

Only this chapter and choice pair is supported. `locale` is `ru` or `kk`; each
episode is available in both. Extra fields are rejected. The server resolves the
story context and chooses the equation operands. The endpoint returns the regular
HTTP 202 job response and uses the same job status URL.

Ready episodes use the same comic endpoint. They have four panels with bundled
artwork (`imageKey` values `library-boxes-1` through `library-boxes-4`), no
`imageUrl`, and `"artwork":"prepared"`. The response includes
`continuation: { sourceChapterId, choiceId, nextChapterId }`, with
`nextChapterId` set to `library-boxes`.

The exercise is on panel 3 with `"answerFormat":"whole-number"`. It uses the
existing check and hint endpoints; the answer is still sent as a string, and
the expected answer stays on the server.

See [backend setup and provider configuration](../backend/README.md).

