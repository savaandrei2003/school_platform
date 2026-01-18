#!/bin/sh
set -e

MYSQL_PWD_OPT="-p$MYSQL_ROOT_PASSWORD"

mysql_cmd() {
  mysql -uroot $MYSQL_PWD_OPT "$@" 2>/dev/null || mysql -uroot "$@"
}

mysqladmin_ping() {
  mysqladmin ping -h 127.0.0.1 -uroot $MYSQL_PWD_OPT --silent 2>/dev/null || \
  mysqladmin ping -h 127.0.0.1 -uroot --silent
}

echo "[replica] starting mysqld..."
docker-entrypoint.sh mysqld --read-only=0 --super-read-only=0 &
pid="$!"

echo "[replica] waiting for local mysql..."
until mysqladmin_ping; do
  sleep 1
done
echo "[replica] local mysql is ready"

echo "[replica] waiting for source mysql..."
until mysqladmin ping -h mysql --silent; do
  sleep 2
done
echo "[replica] source is reachable"

echo "[replica] disabling read-only for bootstrap..."
mysql_cmd -e "SET GLOBAL super_read_only=OFF; SET GLOBAL read_only=OFF;" || true

echo "[replica] ensuring schooldb exists (bootstrap)..."
mysql_cmd -e "CREATE DATABASE IF NOT EXISTS schooldb;"

status="$(mysql_cmd -e "SHOW REPLICA STATUS\G" 2>/dev/null || true)"
io="$(printf "%s" "$status" | awk -F': ' '/Replica_IO_Running:/ {print $2}')"
sql="$(printf "%s" "$status" | awk -F': ' '/Replica_SQL_Running:/ {print $2}')"

if [ "$io" = "Yes" ] && [ "$sql" = "Yes" ]; then
  echo "[replica] replication already running"
else
  echo "[replica] configuring replication..."
  mysql_cmd -e "STOP REPLICA; RESET REPLICA ALL;" || true

  mysql_cmd -e "
    CHANGE REPLICATION SOURCE TO
      SOURCE_HOST='mysql',
      SOURCE_USER='repl',
      SOURCE_PASSWORD='replpass',
      SOURCE_PORT=3306,
      SOURCE_AUTO_POSITION=1,
      GET_SOURCE_PUBLIC_KEY=1;
    START REPLICA;
  "

  echo "[replica] replication started"
fi

status2="$(mysql_cmd -e "SHOW REPLICA STATUS\G" 2>/dev/null || true)"
sql2="$(printf "%s" "$status2" | awk -F': ' '/Replica_SQL_Running:/ {print $2}')"
if [ "$sql2" = "Yes" ]; then
  echo "[replica] enabling read-only..."
  mysql_cmd -e "SET GLOBAL read_only=ON; SET GLOBAL super_read_only=ON;" || true
else
  echo "[replica] NOT enabling read-only (replica SQL not running)"
fi

wait "$pid"
