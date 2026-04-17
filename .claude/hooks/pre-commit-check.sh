#!/bin/bash
# Pre-commit hook: syntax check Python files + TypeScript typecheck
# Only runs when the Bash command is "git commit"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

cd "$(dirname "$0")/../.." || exit 0

# Check Python files staged for commit
PY_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep '\.py$' || true)
if [ -n "$PY_FILES" ]; then
  for f in $PY_FILES; do
    if [ -f "$f" ]; then
      python -m py_compile "$f" 2>/dev/null
      if [ $? -ne 0 ]; then
        echo "⚠ Python syntax error in $f" >&2
      fi
    fi
  done
fi

# TypeScript typecheck (non-blocking)
npm run build --dry-run 2>/dev/null || true

exit 0
