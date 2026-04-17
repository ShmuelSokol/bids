#!/bin/bash
# Pre-push validation — runs before every git push
# Checks for common deployment-breaking issues

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

cd "$(dirname "$0")/../.." || exit 0

echo "🔍 Pre-push validation..." >&2

FAILED=0

# 1. Check build passes
npm run build --quiet 2>/dev/null
if [ $? -ne 0 ]; then
  echo "❌ Build failed — fix errors before pushing" >&2
  FAILED=1
fi

# 2. Check for debug/console.log in staged changes
DEBUGS=$(git diff origin/master..HEAD -- '*.ts' '*.tsx' | grep '^\+.*console\.log' | grep -v 'console\.error\|console\.warn\|sync_log' | head -5)
if [ -n "$DEBUGS" ]; then
  echo "⚠ Found console.log in diff (may be intentional):" >&2
  echo "$DEBUGS" | head -3 >&2
fi

# 3. Check for .env or secrets in staged files
SECRETS=$(git diff --cached --name-only 2>/dev/null | grep -iE '\.env$|secret|credential|password' || true)
if [ -n "$SECRETS" ]; then
  echo "❌ Potentially sensitive files staged: $SECRETS" >&2
  FAILED=1
fi

if [ $FAILED -eq 0 ]; then
  echo "✓ Pre-push checks passed" >&2
fi

exit 0
