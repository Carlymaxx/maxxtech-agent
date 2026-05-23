#!/bin/bash
# MaxxTech Agent — Push to GitHub
# Run this from the Replit Shell tab: bash scripts/push-to-github.sh

set -e

GITHUB_TOKEN="$1"
GITHUB_USER="Carlymaxx"
REPO_NAME="maxxtech-agent"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Usage: bash scripts/push-to-github.sh <YOUR_GITHUB_TOKEN>"
  exit 1
fi

echo "Setting up GitHub remote..."
git remote remove github 2>/dev/null || true
git remote add github "https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "Pushing to GitHub..."
git push github main --force

echo ""
echo "Done! Your code is live at:"
echo "https://github.com/${GITHUB_USER}/${REPO_NAME}"
