#!/bin/bash
set -e

[ -z "$1" ] && echo "Usage: $0 <backup-file>" && exit 1

BACKUP_FILE=$1
BACKUP_DIR=${BACKUP_DIR:-/var/backups/stellarswipe}
RESTORE_DIR="$BACKUP_DIR/restore"
DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-stellarswipe_db}
DB_USER=${DATABASE_USER:-postgres}
DB_PASSWORD=${DATABASE_PASSWORD}
GPG_PASSPHRASE=${BACKUP_GPG_PASSPHRASE}

[ ! -f "$BACKUP_FILE" ] && echo "Error: Backup file not found: $BACKUP_FILE" && exit 1

mkdir -p "$RESTORE_DIR"

echo "Starting restore from: $BACKUP_FILE"

gpg --batch --yes --passphrase "$GPG_PASSPHRASE" --decrypt -o "$RESTORE_DIR/backup.sql.gz" "$BACKUP_FILE"
[ $? -ne 0 ] && echo "Error: Decryption failed" && exit 1

gunzip -c "$RESTORE_DIR/backup.sql.gz" > "$RESTORE_DIR/backup.sql"
[ $? -ne 0 ] && echo "Error: Decompression failed" && rm -f "$RESTORE_DIR/backup.sql.gz" && exit 1

echo "WARNING: This will overwrite the current database!"
read -p "Continue? (yes/no): " CONFIRM

[ "$CONFIRM" != "yes" ] && echo "Restore cancelled" && rm -f "$RESTORE_DIR/backup.sql.gz" "$RESTORE_DIR/backup.sql" && exit 0

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$RESTORE_DIR/backup.sql"
[ $? -ne 0 ] && echo "Error: Database restore failed" && rm -f "$RESTORE_DIR/backup.sql.gz" "$RESTORE_DIR/backup.sql" && exit 1

rm -f "$RESTORE_DIR/backup.sql.gz" "$RESTORE_DIR/backup.sql"

echo "Restore completed successfully!"
