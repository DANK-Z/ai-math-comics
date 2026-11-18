# AI Math Comics backend

FastAPI demo implementing [the API contract](../docs/api-contract.md). Requires Python 3.10+.
All commands below run from `backend/`.

## Install and start

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On macOS/Linux use `.venv/bin/python` instead of `.venv\Scripts\python`.
For a runtime-only installation, install `requirements.txt`.

The API runs at `http://127.0.0.1:8000`; interactive API documentation is at
`http://127.0.0.1:8000/docs`. CORS allows the frontend at `http://localhost:5173`.
No API keys, database, external services, or image downloads are required.
The frontend supplies illustrations for `pizza-01` through `pizza-06`.

## Requests

- `GET /api/comics/pizza-fractions?lang=ru` returns six panels and the exercise at panel 4.
- `POST /api/exercises/pizza-share/check` with JSON `{"answer":"6/8","lang":"kk"}`
  returns `{"status":"correct","message":"Дұрыс! Әр досқа пиццаның тең үлесі тиеді. Жарайсың!"}`.
- `GET /api/exercises/pizza-share/hints?lang=kk&step=1` returns a hint and `hasMore`.
  Step 2 is the last hint; neither hint states the answer.

`lang` defaults to `ru` and supports only `ru` and `kk`. Hint `step` defaults to 1
and supports only 1 and 2. Unsupported parameters or malformed request bodies return
HTTP 422. Answers must be strings of at most 256 characters in integer fraction form
(`a/b`); surrounding whitespace, spaces around `/`, and integer signs are accepted.
Exact arithmetic accepts `3/4`, `6/8`, and all equivalent fractions, including large
integers. Valid but unequal fractions return `incorrect`; malformed fraction strings,
decimal strings, and zero denominators return `invalid`. These exercise outcomes all
use HTTP 200 with localized feedback; numeric JSON answers are rejected with HTTP 422.

## Backend checks

```powershell
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m ruff format --check .
.venv\Scripts\python -m pytest
```
