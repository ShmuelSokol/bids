#!/bin/bash
#
# Post-push data integrity audit hook for Claude Code.
#
# Runs after every Bash tool call. Checks if the command was a git
# push, and if so, runs the data integrity audit. Results go to
# stderr so they appear in the Claude Code conversation.
#
# The hook receives JSON on stdin with the tool call details.
# We parse it to check if the command was "git push".

# Read the hook input
INPUT=$(cat)

# Extract the command that was run
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# Only run audit after git push
if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

# Give Railway 5 seconds to start building (audit hits Supabase, not Railway)
echo "🔍 Post-push audit: checking data integrity..." >&2

# Run the audit script in JSON mode
cd "$(dirname "$0")/../.." || exit 0
RESULT=$(npx tsx scripts/audit-data-integrity.ts --json 2>/dev/null)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  SUSPICIOUS=$(echo "$RESULT" | sed -n 's/.*"suspicious"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
  echo "⚠ Data audit found ${SUSPICIOUS:-?} suspicious counts after push. Run 'npx tsx scripts/audit-data-integrity.ts' to see details." >&2
else
  CHECKS=$(echo "$RESULT" | sed -n 's/.*"checks"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
  echo "✓ Data audit passed (${CHECKS:-?} checks, no suspicious counts)" >&2
fi

# Never block the push (exit 0)
exit 0
