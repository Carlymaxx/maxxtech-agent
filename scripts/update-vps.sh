#!/bin/bash
# MaxxTech Agent — Update script (run on VPS after a git push)
set -e

echo "Pulling latest code..."
cd /opt/maxxtech-agent
git pull origin main

echo "Rebuilding and restarting..."
docker compose up -d --build

echo "Done! MaxxTech Agent updated at http://153.75.250.72"
