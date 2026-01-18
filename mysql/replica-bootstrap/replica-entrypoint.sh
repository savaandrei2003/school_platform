#!/bin/sh
set -e

echo "[replica] starting mysqld..."
docker-entrypoint.sh mysqld &
pid="$!"

echo "[replica] waiting for local mysql..."
until mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent; do
  sleep 1
done
echo "[replica] local mysql is ready"

echo "[replica] waiting for source mysql..."
until mysqladmin ping -h mysql --silent; do
  sleep 2
done
echo "[replica] source is reachable"

status="$(mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW REPLICA STATUS\G" 2>/dev/null || true)"
io="$(printf "%s" "$status" | awk -F': ' '/Replica_IO_Running:/ {print $2}')"
sql="$(printf "%s" "$status" | awk -F': ' '/Replica_SQL_Running:/ {print $2}')"

if [ "$io" = "Yes" ] && [ "$sql" = "Yes" ]; then
  echo "[replica] replication already running"
else
  echo "[replica] configuring replication..."
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "STOP REPLICA; RESET REPLICA ALL;" || true

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
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

wait "$pid"
