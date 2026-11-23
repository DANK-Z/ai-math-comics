# Account database migrations

Alembic manages accounts, classes, rewards, analytics and sign-in counters. Revision `0003`
adds published class snapshots (`assigned_comics`) and per-student hint usage
(`assignment_hints`). Comic jobs, draft ownership, and panel files stay in `COMIC_DATA_DIR`.
The semantic story cache manages its own disposable table.

Run commands from `backend/` in the backend virtual environment. Alembic uses the same `DATABASE_URL` as FastAPI. With an empty `DATABASE_URL`, it uses `accounts.sqlite3` in `COMIC_DATA_DIR`.

## New database

```powershell
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m alembic check
```

Enable `REQUIRE_ACCOUNT_MIGRATIONS=1` for the API. Its startup checks the database revision. Keep the default for a disposable local demo that creates its tables on demand.

## Existing database created by the app

Back up the account database and stop the API. First test this procedure on a copy. Revision `0001` represents the existing accounts schema with `users`, `classes`, `student_profiles`, `backpack_items`, `analytics_logs`, and `boss_results`. For a copy known to have that baseline, record that revision, run the newer migrations and check for schema drift.

```powershell
.venv\Scripts\python -m alembic stamp 0001
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m alembic check
```

If the check reports differences, resolve those on the copy before operating on the original database. After checking the original, set `REQUIRE_ACCOUNT_MIGRATIONS=1` and start the API. Run `upgrade head` on upgrades before starting the new API version.
