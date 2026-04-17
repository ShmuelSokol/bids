## Bug Fix Workflow

Follow these steps in order. Do NOT skip steps.

1. **Read the error/bug description carefully.** Understand what the user expects vs what's happening.

2. **Identify the root cause file(s) using Grep** — do NOT guess. Search for the error message, function name, or component in the codebase. Read the actual code.

3. **Check all imports and references** to the functions/variables you plan to modify across the entire codebase. Use `Grep` to find every caller. List them.

4. **Explain the root cause** to the user in 2-3 sentences before making any changes. Get confirmation.

5. **Make the minimal fix needed.** Don't refactor surrounding code. Don't add features. Just fix the bug.

6. **Check for cascading effects.** After editing, grep for any other file that imports or references what you changed. Fix those too.

7. **Run `npm run build`** to verify no type errors were introduced.

8. **Test with Playwright** if the fix affects a UI page — verify the page loads and shows correct data.

9. **Only then commit and push.** Include the bug description and root cause in the commit message.

10. **Update docs** if the bug revealed a gotcha or rule that should be documented (gotchas.md, CLAUDE.md, wiki).

### If the fix doesn't work after 3 attempts:
STOP. Do not try a 4th approach. Instead:
- Explain what you've tried and why each failed
- Show the relevant code
- Ask the user for direction
