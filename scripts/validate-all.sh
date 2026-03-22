#!/bin/bash
# PhysioRep — Full Validation Pipeline
# Runs: lint, tests, file checks, PWA manifest validation
# Exit code 0 = all pass, non-zero = failure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0
WARN=0

print_header() { echo -e "\n========================================"; echo "  $1"; echo "========================================"; }
pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN + 1)); }

# ===== 1. FILE STRUCTURE CHECK =====
print_header "1. File Structure Check"

required_files=(
  "index.html"
  "manifest.json"
  "sw.js"
  "src/app.js"
  "src/exercise-engine.js"
  "src/db.js"
  "icons/icon-192.png"
  "icons/icon-512.png"
  "package.json"
  ".eslintrc.json"
  "jest.config.js"
)

for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then
    pass "$f exists"
  else
    fail "$f MISSING"
  fi
done

# ===== 2. ESLINT =====
print_header "2. ESLint"

if npx eslint src/ --ext .js --no-error-on-unmatched-pattern 2>&1; then
  pass "ESLint: 0 errors"
else
  fail "ESLint: errors found (see above)"
fi

# ===== 3. JEST TESTS =====
print_header "3. Jest Unit Tests"

if npx jest --config jest.config.js --forceExit 2>&1; then
  pass "All tests passed"
else
  fail "Some tests failed (see above)"
fi

# ===== 4. MANIFEST VALIDATION =====
print_header "4. PWA Manifest Check"

if python3 -c "
import json, sys
with open('manifest.json') as f:
    m = json.load(f)
required = ['name', 'short_name', 'start_url', 'display', 'icons']
missing = [k for k in required if k not in m]
if missing:
    print(f'Missing fields: {missing}')
    sys.exit(1)
if not any(i.get('sizes') == '192x192' for i in m.get('icons', [])):
    print('Missing 192x192 icon')
    sys.exit(1)
if not any(i.get('sizes') == '512x512' for i in m.get('icons', [])):
    print('Missing 512x512 icon')
    sys.exit(1)
print('Manifest valid')
" 2>&1; then
  pass "manifest.json valid"
else
  fail "manifest.json invalid"
fi

# ===== 5. SERVICE WORKER CHECK =====
print_header "5. Service Worker Check"

if grep -q "self.addEventListener('install'" sw.js && \
   grep -q "self.addEventListener('fetch'" sw.js && \
   grep -q "self.addEventListener('activate'" sw.js; then
  pass "SW has install/activate/fetch handlers"
else
  fail "SW missing required event handlers"
fi

# ===== 6. HTML VALIDATION =====
print_header "6. HTML Structure Check"

if grep -q '<meta name="viewport"' index.html && \
   grep -q '<link rel="manifest"' index.html && \
   grep -q '<meta name="theme-color"' index.html; then
  pass "HTML has required meta tags"
else
  fail "HTML missing required meta tags"
fi

if grep -q 'serviceWorker' src/app.js; then
  pass "SW registration found in app.js"
else
  fail "SW registration missing from app.js"
fi

# ===== 7. ICON SIZE CHECK =====
print_header "7. Icon Validation"

for icon in icons/icon-192.png icons/icon-512.png; do
  size=$(wc -c < "$icon" 2>/dev/null || echo "0")
  if [ "$size" -gt 100 ]; then
    pass "$icon exists (${size} bytes)"
  else
    fail "$icon missing or empty"
  fi
done

# ===== SUMMARY =====
print_header "VALIDATION SUMMARY"
echo ""
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "  ⚠️  Warnings: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "  🎉 ALL CHECKS PASSED — ready to deploy"
  exit 0
else
  echo "  🚨 $FAIL CHECK(S) FAILED — fix before deploying"
  exit 1
fi
