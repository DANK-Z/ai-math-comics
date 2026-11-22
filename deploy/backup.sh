#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: bash deploy/backup.sh /path/to/pilot.env /path/to/backups\n' >&2
  exit 2
fi

umask 077
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
compose=(docker compose --env-file "$1" -f "$script_dir/compose.yaml")
running=$("${compose[@]}" ps --status running --services)
for service in api worker db; do
  if ! grep -Fxq "$service" <<< "$running"; then
    printf 'Expected running service %s\n' "$service" >&2
    exit 1
  fi
done

mkdir -p -- "$2"
temp_backup=$(mktemp -d "$2/.amc-backup-XXXXXXXX")
restart=0
finish() {
  local result=$?
  if [[ $restart == 1 ]]; then
    "${compose[@]}" start api worker >&2 || result=1
  fi
  if [[ -n $temp_backup ]]; then
    rm -f -- "$temp_backup/accounts.dump" "$temp_backup/comics.tar.gz"
    rmdir -- "$temp_backup"
  fi
  exit "$result"
}
trap finish EXIT

# The accounts database and comic files must represent the same point in time.
restart=1
"${compose[@]}" stop worker api >&2
"${compose[@]}" exec -T db pg_dump -U amc -Fc amc > "$temp_backup/accounts.dump"
"${compose[@]}" run --rm --no-deps -T api tar -C ../data -czf - . > "$temp_backup/comics.tar.gz"
test -s "$temp_backup/accounts.dump"
tar -tzf "$temp_backup/comics.tar.gz" >/dev/null

destination="$2/amc-$(date -u +%Y%m%dT%H%M%SZ)-${temp_backup##*-}"
mv -- "$temp_backup" "$destination"
temp_backup=''
printf '%s\n' "$destination"
