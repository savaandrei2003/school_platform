#!/bin/sh
set -e

echo "DB migrator: waiting for MySQL..."
until nc -z mysql 3306; do
  echo "MySQL not up yet, sleeping 2s..."
  sleep 2
done

echo "MySQL is up. Running prisma migrate deploy..."
npx prisma migrate deploy
echo "Done."
