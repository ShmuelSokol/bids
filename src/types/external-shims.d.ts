// Type shims for native packages that we install with `npm install --no-save`
// (kept out of package.json per CLAUDE.md to avoid Railway Linux build failures
// on native compilation). Next.js type-checks all of src/ during build, so it
// needs *some* declaration to satisfy the import statements in src/lib/ll-laz.ts.
//
// At runtime these modules are only used by the worker (scripts/) running on
// GLOVE, never by Railway-hosted Next.js code, so the loose typing here is fine.

declare module "archiver";
declare module "ssh2-sftp-client";
