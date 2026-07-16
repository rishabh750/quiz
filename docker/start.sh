#!/bin/bash
set -e

PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
export PGDATA=/var/lib/postgresql/data
SOCKET_DIR=/var/run/postgresql
: "${SECRET_DIR:=/data}"
APP_ROLE=interviewprep
APP_DB=interviewprep
APP_PASSWORD=interviewprep

mkdir -p "$PGDATA" "$SOCKET_DIR" "$SECRET_DIR"
chown -R postgres:postgres "$PGDATA" "$SOCKET_DIR"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[start] initializing PostgreSQL data directory (superuser: $APP_ROLE)"
  su postgres -c "$PGBIN/initdb -D $PGDATA -U $APP_ROLE --auth-local=trust --auth-host=trust"
fi

rm -f "$PGDATA/postmaster.pid"

echo "[start] starting PostgreSQL"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -w -t 60 \
  -o '-c listen_addresses=127.0.0.1 -p 5432 -c unix_socket_directories=$SOCKET_DIR' start"

PSQL="$PGBIN/psql -h $SOCKET_DIR -U $APP_ROLE -d postgres"

echo "[start] ensuring database and credentials"
su postgres -c "$PSQL -tAc \"SELECT 1 FROM pg_database WHERE datname='$APP_DB'\"" | grep -q 1 \
  || su postgres -c "$PGBIN/createdb -h $SOCKET_DIR -U $APP_ROLE -O $APP_ROLE $APP_DB"
su postgres -c "$PSQL -c \"ALTER ROLE $APP_ROLE WITH LOGIN PASSWORD '$APP_PASSWORD'\"" >/dev/null

export DATABASE_URL="${DATABASE_URL:-postgresql://$APP_ROLE:$APP_PASSWORD@127.0.0.1:5432/$APP_DB}"

echo "[start] launching InterviewPrep on port ${PORT:-8000}"
exec java -jar /srv/app.jar
