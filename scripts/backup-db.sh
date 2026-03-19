#!/bin/bash
# ============================================================================
# Database Backup Script for AI-HOS
# Usage: ./scripts/backup-db.sh
# Requires: pg_dump, gzip
# ============================================================================

set -euo pipefail

# Configuration
DB_URL="${DATABASE_URL:-postgresql://postgres:Tejas%40%233478@db.pbevoxnglfbtxwgbbncp.supabase.co:5432/postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ai-hos_${TIMESTAMP}.sql.gz"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI-HOS Database Backup"
echo "  Timestamp: ${TIMESTAMP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Run pg_dump with compression
echo "Backing up database..."
if pg_dump "${DB_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  2>/dev/null | gzip > "${BACKUP_FILE}"; then

  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo -e "${GREEN}Backup complete: ${BACKUP_FILE} (${SIZE})${NC}"
else
  echo -e "${RED}Backup FAILED${NC}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Clean old backups
echo "Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "ai-hos_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "Deleted ${DELETED} old backup(s)"

# List recent backups
echo ""
echo "Recent backups:"
ls -lh "${BACKUP_DIR}"/ai-hos_*.sql.gz 2>/dev/null | tail -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
