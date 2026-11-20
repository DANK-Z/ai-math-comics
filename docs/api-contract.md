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
Safe error codes: `provider_not_configured`, `provider_authentication`,
`provider_rate_limited`, `provider_timeout`, `provider_unavailable`,
`invalid_provider_output`, `job_timeout`, `worker_interrupted`, `generation_failed`.
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
and belong to published comics only. Prepared-art comics include `"artwork":"prepared"`
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

