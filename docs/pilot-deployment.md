# Pilot deployment

The pilot Compose stack runs Caddy, FastAPI, a standalone worker, PostgreSQL with pgvector, and Redis. Caddy serves the built frontend and proxies `/api/` on the same origin. Only Caddy publishes ports. The API and worker use the same volume for SQLite jobs, generated comics and panel files.

## Launch

1. Copy `deploy/pilot.env.example` to a file outside Git. Set the domain, matching HTTPS origin, PostgreSQL password, database URL, JWT secret and the key for the chosen provider. Keep that file private and preserve the JWT secret across restarts. Use prepared artwork for a pilot that only pays for story text.
2. Point DNS for the domain at the host and make TCP ports 80 and 443 reachable. Caddy obtains and renews its certificate automatically. Keep its data volume across deployments.
3. From the repository root, run the following commands. A one-shot service runs the account migrations before the API starts.

```sh
docker compose --env-file /path/to/pilot.env -f deploy/compose.yaml up -d --build --wait
docker compose --env-file /path/to/pilot.env -f deploy/compose.yaml ps
```

Use a fresh database for a first deployment. When moving an existing account database, follow the [account migration instructions](account-migrations.md). Import old SQLite comic data separately into the shared comic volume while API and worker are stopped. Never pass provider keys as frontend build arguments.

For a local HTTP smoke test, set `AMC_SITE=:80`, `AMC_BIND_ADDRESS=127.0.0.1`, `AMC_HTTP_PORT=8180`, `AMC_HTTPS_PORT=8443`, and `PUBLIC_BASE_URL=http://127.0.0.1:8180`. Use a separate Compose project so the test gets its own volumes. To change artwork mode, update `COMIC_ART_MODE` and rebuild so the frontend and worker agree.

## Backup and restore

On the deployment host, run `bash deploy/backup.sh /path/to/pilot.env /path/to/backups`. The script briefly stops the API and worker, writes a PostgreSQL dump and an archive of the shared comic volume, then restarts both services. It also attempts to restart the services if backup fails. Keep backups off-host in restricted storage. Use a separate secured backup for the environment file and Caddy certificate data. Redis contains a rebuildable cache.

Test restores into an isolated project with fresh volumes. Start its `db` service, stream the custom-format dump into `pg_restore -U amc -d amc --exit-on-error` with `docker compose exec -T db`, and extract `comics.tar.gz` into `/app/data` using a one-off API container with `--no-deps`. Keep the API and worker stopped while importing. Then run `up -d --build --wait` with the restored project's configuration and verify account sign-in, a known comic, and a generated panel URL. Use the original public origin for a production restore.
