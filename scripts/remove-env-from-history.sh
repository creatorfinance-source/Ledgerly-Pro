#!/bin/bash
#
# SCRIPT: remove-env-from-history.sh
# PURPOSE: Remove .env files from git history using git filter-repo
# WARNING: This rewrites git history. Coordinate with your team!
#
# USAGE:
#   chmod +x scripts/remove-env-from-history.sh
#   ./scripts/remove-env-from-history.sh
#

set -e

echo "=========================================="
echo "⚠️  GIT HISTORY CLEANUP - ENV FILES"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Remove .env, .env.local, .env.production from git history"
echo "  2. Rewrite commits (non-recoverable)"
echo "  3. Require force-push to remote"
echo ""
echo "⚠️  WARNING: This affects all contributors!"
echo "  → Coordinate with your team before proceeding"
echo "  → All team members must re-clone or rebase"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo not found. Installing..."
    pip install git-filter-repo
fi

echo ""
echo "🔄 Removing .env files from history..."
git filter-repo --invert-paths --path .env --path .env.local --path .env.production

echo ""
echo "✅ History cleaned!"
echo ""
echo "📋 Next steps:"
echo "  1. Verify the cleanup: git log --all --full-history -- .env"
echo "  2. If satisfied, force-push: git push origin --force-with-lease --all"
echo "  3. Notify team to re-clone or: git fetch --all && git reset --hard origin/main"
echo ""
echo "⚠️  Back up your repo before force-pushing!"
