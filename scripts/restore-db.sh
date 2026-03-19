#!/bin/bash
# ============================================================================
# Database Restore Script for AI-HOS
# Usage: ./scripts/restore-db.sh [backup_file]
# ============================================================================

set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:Tejas%40%233478@db.pbevoxnglfbtxwgbbncp.supabase.co:5432/postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ $# -eq 0 ]; then
  echo "Available backups:"
  ls -lh "${BACKUP_DIR}"/ai-hos_*.sql.gz 2>/dev/null || echo "No backups found"
  echo ""
  echo "Usage: $0 <backup_file>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "File not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will restore from ${BACKUP_FILE}"
echo "This will overwrite the current database!"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring database..."
gunzip -c "${BACKUP_FILE}" | psql "${DB_URL}" 2>&1 | tail -5

echo "Restore complete!"
