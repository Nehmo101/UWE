import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { STUDIO_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import type { AuthUser, UweRole } from "@uwe/auth";

const libDir = dirname(fileURLToPath(import.meta.url));

/**
 * `studio-action-auth.ts` pulls in `next/headers`, so it cannot be imported in a
 * plain node:test process. These tests therefore cover the two halves that make
 * the guard correct:
 *
 *  1. the role predicate itself (pure, importable), and
 *  2. a source-level assertion that the guard actually performs the role check
 *     — the regression that B1 fixed was precisely a guard that looked complete
 *     but never resolved a user.
 *
 * The "every action calls the guard" half lives in `server-actions.test.ts`.
 */
function authUser(role: UweRole): AuthUser {
  return { id: `u-${role}`, displayName: role, email: null, role };
}

describe("studio action role predicate", () => {
  it("admits the three Studio operator roles", () => {
    for (const role of ["owner", "admin", "dm"] as const) {
      assert.equal(
        hasAnyRole(authUser(role), STUDIO_ACCESS_ROLES),
        true,
        `${role} must keep Studio action access`,
      );
    }
  });

  it("rejects portal-only and anonymous roles", () => {
    for (const role of ["player", "readonly", "guest"] as const) {
      assert.equal(
        hasAnyRole(authUser(role), STUDIO_ACCESS_ROLES),
        false,
        `${role} must not reach Studio Server Actions`,
      );
    }
  });
});

describe("studio action guard wiring", () => {
  it("resolves the session user and enforces a Studio role", async () => {
    const source = await readFile(join(libDir, "studio-action-auth.ts"), "utf8");

    // Layer 1: Origin/CSRF.
    assert.match(
      source,
      /authorize\(\s*\{\s*scope:\s*"studio-action"/,
      "guard must keep the Origin/CSRF check",
    );

    // Layer 2: the role check. A guard that only calls authorize() is the exact
    // hole this test exists for — POST /api/auth/enter hands a valid session
    // cookie on the Studio origin to any active user, including role "player".
    assert.match(
      source,
      /getCurrentAuthUser\(\)/,
      "guard must resolve the session user — middleware only checks cookie presence",
    );
    assert.match(
      source,
      /hasAnyRole\([^)]*STUDIO_ACCESS_ROLES\)/,
      "guard must enforce STUDIO_ACCESS_ROLES",
    );
    assert.match(
      source,
      /status:\s*403/,
      "a non-Studio role must be denied with 403",
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
