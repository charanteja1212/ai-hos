#!/bin/bash
# ─── AI-HOS Production Deployment Script ─────────────────────────────
# Run on Hostinger VPS: ssh root@72.61.238.6
# Prerequisites: Docker, Docker Compose, Traefik (already running with n8n)
# ─────────────────────────────────────────────────────────────────────

set -e

DEPLOY_DIR="/docker/ai-hos"
REPO_URL="https://github.com/YOUR_USERNAME/ai-hos.git"  # Update with actual repo

echo "═══════════════════════════════════════════"
echo "  AI-HOS Deployment"
echo "═══════════════════════════════════════════"

# Step 1: Create deploy directory
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Step 2: Clone or pull latest code
if [ -d ".git" ]; then
  echo "→ Pulling latest code..."
  git pull origin main
else
  echo "→ Cloning repository..."
  git clone "$REPO_URL" .
fi

# Step 3: Create .env file if not exists
if [ ! -f ".env" ]; then
  echo "→ Creating .env from template..."
  cat > .env << 'ENVEOF'
# n8n API
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhNjc0NmUxNS1kNmM1LTQ3NzgtODljYS1iNmRiNmY5Y2JjZTgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiODg3OWNjNDktOWQ3Zi00YTY2LWE3NTMtYzgwZDVjMjU0NTdkIiwiaWF0IjoxNzcxNDc5NTAzfQ.cdPxDAPpzvB78b15Y4eGF4DbVo6qVrY4bdYdEuhuK54

# WhatsApp
WA_ACCESS_TOKEN=EAAUws627FRMBQrAUZCqbDINqBEgbzuLBK6eGu3mos7KmudquL9qjvMriHSJrXLJIffNMDCFD1waaHVWSNXrbavFI9ip229rmqR8zqtMAQYNXAZB7jctYslmHl4J8dDdfisapaq0F01J7ZAM90E0YGBEfhZCzFROcJv6r7dsK7Q9rwwXJxqfO2YnA11tiGTCnuAZDZD

# Admin
ADMIN_ALERT_PHONE=918125442376

# Supabase JWT
SUPABASE_JWT_SECRET=your-jwt-secret-here
ENVEOF
  echo "  ✓ .env created — update secrets if needed"
fi

# Step 4: Build and deploy
echo "→ Building Docker image..."
docker compose build --no-cache

echo "→ Stopping old container..."
docker compose down 2>/dev/null || true

echo "→ Starting new container..."
docker compose up -d

# Step 5: Verify
echo "→ Waiting for startup..."
sleep 5

if docker compose ps | grep -q "Up"; then
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✓ Deployment successful!"
  echo "  → App: https://app.ainewworld.in"
  echo "  → Health: https://app.ainewworld.in/api/platform?scope=health-ping"
  echo "═══════════════════════════════════════════"
else
  echo "✗ Deployment failed. Check logs:"
  echo "  docker compose logs ai-hos"
  exit 1
fi
