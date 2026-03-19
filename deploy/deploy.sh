#!/bin/bash
# ============================================================================
# Deploy AI-HOS to VPS
# Usage: ./deploy/deploy.sh
# ============================================================================

set -euo pipefail

VPS_HOST="${VPS_HOST:-72.61.238.6}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="/opt/ai-hos"

echo "━━━ AI-HOS Deploy ━━━"
echo "Target: ${VPS_USER}@${VPS_HOST}:${APP_DIR}"

# Build Docker image
echo "Building Docker image..."
docker build -t ai-hos:latest .

# Save and transfer
echo "Saving image..."
docker save ai-hos:latest | gzip > /tmp/ai-hos.tar.gz

echo "Transferring to VPS..."
scp /tmp/ai-hos.tar.gz "${VPS_USER}@${VPS_HOST}:/tmp/"

echo "Deploying on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" << 'REMOTE'
  cd /opt/ai-hos || exit 1

  # Load new image
  docker load < /tmp/ai-hos.tar.gz
  rm -f /tmp/ai-hos.tar.gz

  # Restart with new image
  docker compose down
  docker compose up -d

  # Wait for health check
  echo "Waiting for health check..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
      echo "Health check passed!"
      exit 0
    fi
    sleep 2
  done

  echo "WARNING: Health check not passing after 60s"
  docker compose logs --tail 20
REMOTE

echo "Deploy complete!"
