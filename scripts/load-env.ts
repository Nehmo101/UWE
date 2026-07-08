/**
 * Side-effect module: loads a local `.env` into `process.env` if present.
 *
 * Imported first (before any module that reads `DATABASE_URL` at import time,
 * e.g. `@uwe/database` client) so the ambient environment is populated in
 * time. Uses Node's built-in `process.loadEnvFile()` (Node >= 20.12) — no
 * `dotenv` dependency, which isn't hoisted to the repo root and would throw
 * `MODULE_NOT_FOUND` here. Resilient: when there is no `.env` (e.g. CI, where
 * `DATABASE_URL` is already exported) it simply falls back to the ambient env.
 */
try {
  process.loadEnvFile();
} catch {
  // No `.env` file — rely on the ambient environment or client defaults.
}
