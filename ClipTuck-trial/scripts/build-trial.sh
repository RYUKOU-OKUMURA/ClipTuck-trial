#!/usr/bin/env bash
set -euo pipefail

# Build output directory for Cloudflare Pages
rm -rf public
mkdir -p public

# Keep directory structure so existing relative paths (../shared) work
cp -R trial public/trial
cp -R shared public/shared

# SPA fallback: always serve the trial app
cat > public/_redirects <<'REDIRECTS'
/* /trial/index.html 200
REDIRECTS

echo "Built Trial to ./public (serves /trial)"

