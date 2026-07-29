import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { canAccessStudio } from "@uwe/auth";
import type { AreaAccess, AuthUser } from "@uwe/auth";

const libDir = dirname(fileURLToPath(import.meta.url));

/**
 * `studio-action-auth.ts` pulls in `next/headers`, so it cannot be imported in a
 * plain node:test process. These tests therefore cover the two halves that make
 * the guard correct:
 *
 *  1. the access predicate itself (pure, importable), and
 *  2. a source-level assertion that the guard actually performs the access check
 *     — the regression that B1 fixed was precisely a guard that looked complete
 *     but never resolved a user.
 *
 * The "every action calls the guard" half lives in `server-actions.test.ts`.
 */
function authUser(label: string, access: Partial<AreaAccess>): AuthUser {
  return {
    id: `u-${label}`,
    displayName: label,
    email: null,
    isOwner: false,
    access: { portal: false, studio: false, brain: false, family: false, ...access },
    aiAccess: false,
  };
}

describe("studio action access predicate", () => {
  it("admits anyone holding the Studio checkbox", () => {
    assert.equal(canAccessStudio(authUser("dm", { portal: true, studio: true })), true);
    assert.equal(canAccessStudio(authUser("studio-only", { studio: true })), true);
  });

  it("rejects accounts without it", () => {
    for (const [label, access] of [
      ["portal-only", { portal: true }],
      ["brain-only", { brain: true }],
      ["family-only", { family: true }],
      ["nothing", {}],
    ] as const) {
      assert.equal(
        canAccessStudio(authUser(label, access)),
        false,
        `${label} must not reach Studio Server Actions`,
      );
    }
  });
});

describe("studio action guard wiring", () => {
  it("resolves the session user and enforces Studio access", async () => {
    const source = await readFile(join(libDir, "studio-action-auth.ts"), "utf8");

    // Layer 1: Origin/CSRF.
    assert.match(
      source,
      /authorize\(\s*\{\s*scope:\s*"studio-action"/,
      "guard must keep the Origin/CSRF check",
    );

    // Layer 2: the access check. A guard that only calls authorize() is the exact
    // hole this test exists for — POST /api/auth/enter hands a valid session
    // cookie on the Studio origin to any active user, including Portal-only ones.
    assert.match(
      source,
      /getCurrentAuthUser\(\)/,
      "guard must resolve the session user — middleware only checks cookie presence",
    );
    assert.match(
      source,
      /canAccessStudio\(user\)/,
      "guard must enforce the Studio checkbox",
    );
    assert.match(
      source,
      /status:\s*403/,
      "an account without Studio access must be denied with 403",
    );
    assert.match(
      source,
      /status:\s*401/,
      "a missing session must be denied with 401",
    );

    // The dev bypass must stay gated on studioAuthRequired() and must not be a
    // blanket early return.
    assert.match(
      source,
      /if\s*\(!studioAuthRequired\(\)\)\s*\{\s*return;/,
      "AUTH_REQUIRED=false bypass must be explicit and narrow",
    );
  });
});
