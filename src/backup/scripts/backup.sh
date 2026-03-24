#!/bin/bash
set -e

BACKUP_TYPE=${1:-daily}
TIMESTAMP=$(date +%Y-%m-%d)
BACKUP_DIR=${BACKUP_DIR:-/var/backups/stellarswipe}
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-stellarswipe_db}
DB_USER=${DATABASE_USER:-postgres}
DB_PASSWORD=${DATABASE_PASSWORD}
GPG_PASSPHRASE=${BACKUP_GPG_PASSPHRASE}

FILENAME="stellarswipe-db-${BACKUP_TYPE}-${TIMESTAMP}.sql"
GZ_FILENAME="${FILENAME}.gz"
ENCRYPTED_FILENAME="${GZ_FILENAME}.gpg"

mkdir -p "$BACKUP_DIR"

echo "Starting ${BACKUP_TYPE} backup..."

PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "$BACKUP_DIR/$FILENAME"
[ $? -ne 0 ] && echo "Error: Database dump failed" && exit 1

gzip -c "$BACKUP_DIR/$FILENAME" > "$BACKUP_DIR/$GZ_FILENAME"
[ $? -ne 0 ] && echo "Error: Compression failed" && rm -f "$BACKUP_DIR/$FILENAME" && exit 1

gpg --batch --yes --passphrase "$GPG_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$BACKUP_DIR/$ENCRYPTED_FILENAME" "$BACKUP_DIR/$GZ_FILENAME"
[ $? -ne 0 ] && echo "Error: Encryption failed" && rm -f "$BACKUP_DIR/$FILENAME" "$BACKUP_DIR/$GZ_FILENAME" && exit 1

BACKUP_SIZE=$(stat -f%z "$BACKUP_DIR/$ENCRYPTED_FILENAME" 2>/dev/null || stat -c%s "$BACKUP_DIR/$ENCRYPTED_FILENAME")
[ "$BACKUP_SIZE" -eq 0 ] && echo "Error: Backup file is empty" && exit 1

rm -f "$BACKUP_DIR/$FILENAME" "$BACKUP_DIR/$GZ_FILENAME"

echo "Backup completed successfully: $ENCRYPTED_FILENAME"
echo "Size: $(echo "scale=2; $BACKUP_SIZE / 1024 / 1024" | bc) MB"
