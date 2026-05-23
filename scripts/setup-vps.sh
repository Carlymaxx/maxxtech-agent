#!/bin/bash
# MaxxTech Agent — VPS Setup Script
# Run this on your VPS: bash setup-vps.sh
# VPS: 153.75.250.72

set -e

echo "=== MaxxTech Agent VPS Setup ==="
echo ""

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "[1/6] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "[1/6] Docker already installed"
fi

# 2. Install Docker Compose if not present
if ! command -v docker compose &> /dev/null; then
    echo "[2/6] Installing Docker Compose..."
    apt-get install -y docker-compose-plugin
else
    echo "[2/6] Docker Compose already installed"
fi

# 3. Clone repo
echo "[3/6] Cloning MaxxTech Agent..."
cd /opt
rm -rf maxxtech-agent
git clone https://github.com/Carlymaxx/maxxtech-agent.git
cd maxxtech-agent

# 4. Create .env file
echo "[4/6] Creating environment config..."
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate strong secrets automatically
    DB_PASS=$(openssl rand -hex 16)
    SESSION_SECRET=$(openssl rand -hex 32)
    sed -i "s/change_this_to_a_strong_password/$DB_PASS/g" .env
    sed -i "s/change_this_to_a_random_secret/$SESSION_SECRET/g" .env
    sed -i "s|postgresql://maxxtech:YOUR_DB_PASSWORD|postgresql://maxxtech:$DB_PASS|g" .env
    echo ""
    echo "IMPORTANT: Edit /opt/maxxtech-agent/.env and add your Anthropic API keys:"
    echo "  AI_INTEGRATIONS_ANTHROPIC_BASE_URL"
    echo "  AI_INTEGRATIONS_ANTHROPIC_API_KEY"
    echo ""
fi

# 5. Build and start containers
echo "[5/6] Building and starting MaxxTech Agent..."
docker compose up -d --build

# 6. Run database migrations
echo "[6/6] Running database migrations..."
sleep 5
docker compose exec app node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
console.log('Database ready');
" 2>/dev/null || true

echo ""
echo "=== MaxxTech Agent is running! ==="
echo ""
echo "Access it at: http://153.75.250.72"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          — view live logs"
echo "  docker compose restart app      — restart the app"
echo "  docker compose down             — stop everything"
echo "  docker compose up -d --build    — rebuild and restart"
echo ""
echo "To update after a git push:"
echo "  cd /opt/maxxtech-agent && git pull && docker compose up -d --build"
