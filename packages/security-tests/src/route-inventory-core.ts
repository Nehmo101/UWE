import fs from "node:fs";
import path from "node:path";

/**
 * Shared, surface-agnostic building blocks for Next.js API route auth inventories.
 *
 * Both the Studio inventory (`studio-route-inventory.ts`) and the Portal
 * inventory (`portal-route-inventory.ts`) are parameterizations of the same
 * idea: enumerate every `route.ts` under an app's `app/api` tree and assert it
 * is protected by a recognized guard, delegates to a guard helper, or is
 * explicitly allowlisted as public. Keeping the mechanism here means both
 * surfaces stay in lockstep and neither can silently regress.
 */

/** Recursively lists all `route.ts` files under an API root, relative to that root. */
export function listApiRouteFiles(apiRoot: string): string[] {
  return collectRouteFiles(apiRoot).sort();
}

function collectRouteFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(full, relative));
      continue;
    }

    if (entry.name === "route.ts") {
      files.push(relative);
    }
  }

  return files;
}

/** Routes whose auth guard lives in a shared helper module rather than the route file. */
export interface DelegatedGuardConfig {
  /** Relative route files (e.g. `auth/two-factor/route.ts`) that delegate. */
  routes: ReadonlySet<string>;
  /** Absolute path to the helper module the routes delegate to. */
  helperPath: string;
}

/** Declarative policy describing how one API surface must guard its routes. */
export interface RouteProtectionPolicy {
  /** Regex matching any accepted auth/authz guard reference for this surface. */
  guardPattern: RegExp;
  /** Routes intentionally public — must NOT reference a guard. */
  publicAllowlist: ReadonlySet<string>;
  /** Optional set of routes that delegate their guard to a shared helper module. */
  delegated?: DelegatedGuardConfig;
}

/**
 * Asserts a single API route file is either protected by a recognized guard,
 * delegates to a guard helper module, or is explicitly allowlisted as public.
 * Throws with a descriptive message otherwise. `apiRoot` is the absolute path
 * to the surface's `app/api` directory; `relativeRoute` is relative to it.
 */
export function assertRouteProtected(
  apiRoot: string,
  relativeRoute: string,
  policy: RouteProtectionPolicy,
): void {
  const content = fs.readFileSync(path.join(apiRoot, relativeRoute), "utf8");

  if (policy.publicAllowlist.has(relativeRoute)) {
    if (policy.guardPattern.test(content)) {
      throw new Error(`${relativeRoute} is public allowlist — must not import auth guard`);
    }
    return;
  }

  if (policy.delegated?.routes.has(relativeRoute)) {
    const helperContent = fs.readFileSync(policy.delegated.helperPath, "utf8");
    if (!policy.guardPattern.test(helperContent)) {
      throw new Error(
        `${relativeRoute} delegates to ${path.basename(policy.delegated.helperPath)} which must call an auth guard`,
      );
    }
    return;
  }

  if (!policy.guardPattern.test(content)) {
    throw new Error(`${relativeRoute} must call an auth guard`);
  }
}
