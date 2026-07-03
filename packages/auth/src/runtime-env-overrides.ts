/**
 * Runtime environment overrides — lets the owner change deployment/routing/security
 * configuration from the website (stored in the database) without editing the host
 * `.env` and redeploying.
 *
 * The database layer resolves the stored overrides into a plain key→value record and
 * installs it here via {@link setRuntimeEnvOverrides}. The pure runtime-config helpers
 * in this package then overlay the record on top of `process.env` (overrides win) so
 * every Node server context — login, cookie options, link generation, Turnstile —
 * observes the effective configuration immediately.
 *
 * Deliberately a no-op until an override record is installed: when nothing is set
 * (the default, and always in the Edge middleware runtime, which never loads the DB),
 * {@link withRuntimeEnvOverrides} returns the passed env untouched. Edge/middleware and
 * unit tests that pass an explicit env therefore keep their exact pre-existing behaviour.
 */

let overrides: Readonly<Record<string, string>> | null = null;

/**
 * Installs (or clears) the effective runtime env overrides. Pass `null` or an empty
 * record to clear. A frozen shallow copy is stored so later mutations of the caller's
 * object cannot leak in.
 */
export function setRuntimeEnvOverrides(next: Record<string, string> | null | undefined): void {
  if (!next || Object.keys(next).length === 0) {
    overrides = null;
    return;
  }
  overrides = Object.freeze({ ...next });
}

/** Current override record, or `null` when none is installed. */
export function getRuntimeEnvOverrides(): Readonly<Record<string, string>> | null {
  return overrides;
}

/**
 * Overlays the installed overrides on top of `env` (overrides win). Returns `env`
 * unchanged — same reference — when no overrides are installed, so the common path
 * allocates nothing and behaviour is identical to reading `process.env` directly.
 */
export function withRuntimeEnvOverrides(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (!overrides) {
    return env;
  }
  return { ...env, ...overrides };
}
