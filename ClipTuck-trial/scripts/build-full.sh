#!/usr/bin/env bash
set -euo pipefail

# Build output directory for Cloudflare Pages
rm -rf public
mkdir -p public

# Keep directory structure so existing relative paths (../shared) work
cp -R full public/full
cp -R shared public/shared

# SPA fallback: always serve the full app
cat > public/_redirects <<'REDIRECTS'
/* /full/index.html 200
REDIRECTS

echo "Built Full to ./public (serves /full)"

