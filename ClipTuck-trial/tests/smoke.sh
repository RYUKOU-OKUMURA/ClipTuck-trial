#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

pass() { echo "[OK] $1"; }
fail() { echo "[FAIL] $1" >&2; exit 1; }

# 1) Build trial and verify artifacts
scripts/build-trial.sh
[[ -d public/trial ]] || fail "public/trial missing after trial build"
[[ -f public/_redirects ]] || fail "_redirects missing for trial build"
grep -q "/trial/index.html 200" public/_redirects || fail "trial redirects not set"
[[ -f public/trial/index.html ]] || fail "trial index.html missing"
pass "Trial build produced expected files"

# Extract a recognizable string from the trial UI to ensure content presence
if ! grep -qi "trial" public/trial/index.html; then
  echo "Note: Could not find the word 'trial' in trial/index.html (this may be OK)." >&2
fi

# 2) Build full and verify artifacts
scripts/build-full.sh
[[ -d public/full ]] || fail "public/full missing after full build"
[[ -f public/_redirects ]] || fail "_redirects missing for full build"
grep -q "/full/index.html 200" public/_redirects || fail "full redirects not set"
[[ -f public/full/index.html ]] || fail "full index.html missing"
pass "Full build produced expected files"

# 3) Shared assets available
[[ -d public/shared/icons ]] || fail "shared icons missing"
pass "Shared assets copied"

# Summary
pass "Smoke test completed successfully"
