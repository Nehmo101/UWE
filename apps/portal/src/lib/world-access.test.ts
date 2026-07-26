import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { canReadWorld } from "@uwe/auth";
import type { AuthUser, UweRole, WorldMembership } from "@uwe/auth";

const libDir = dirname(fileURLToPath(import.meta.url));
const portalRoot = dirname(libDir);
const worldLayout = join(
  portalRoot,
  "..",
  "app",
  "auth",
  "worlds",
  "[worldSlug]",
  "layout.tsx",
);

const WORLD_ID = "world-1";

function authUser(role: UweRole, id = "u-1"): AuthUser {
  return { id, displayName: role, email: null, role };
}

function membership(userId: string, role: WorldMembership["role"] = "player"): WorldMembership {
  return { userId, worldId: WORLD_ID, role, characterName: null };
}

function target(options: { guestModeEnabled?: boolean; membership?: WorldMembership | null } = {}) {
  return {
    id: WORLD_ID,
    guestModeEnabled: options.guestModeEnabled ?? false,
    membership: options.membership ?? null,
  };
}

/**
 * The gate `getAccessContextForWorld` applies before returning a context.
 * These cases pin the property that B2 fixed: a logged-in player must not reach
 * a world they are not a member of just by guessing its slug.
 */
describe("portal world read gate", () => {
  it("denies a player without membership when guest mode is off", () => {
    assert.equal(canReadWorld(authUser("player"), target()), false);
  });

  it("denies a readonly user without membership", () => {
    assert.equal(canReadWorld(authUser("readonly"), target()), false);
  });

  it("denies an anonymous visitor when guest mode is off", () => {
    assert.equal(canReadWorld(null, target()), false);
  });

  it("allows a player who holds a membership in that world", () => {
    assert.equal(
      canReadWorld(authUser("player"), target({ membership: membership("u-1") })),
      true,
    );
  });

  it("ignores a membership that belongs to a different user", () => {
    assert.equal(
      canReadWorld(authUser("player", "u-1"), target({ membership: membership("someone-else") })),
      false,
    );
  });

  it("allows any viewer once guest mode is enabled for the world", () => {
    assert.equal(canReadWorld(authUser("player"), target({ guestModeEnabled: true })), true);
    assert.equal(canReadWorld(null, target({ guestModeEnabled: true })), true);
  });

  it("keeps owner/admin/dm access to every world (DM preview must not break)", () => {
    for (const role of ["owner", "admin", "dm"] as const) {
      assert.equal(
        canReadWorld(authUser(role), target()),
        true,
        `${role} must keep cross-world read access`,
      );
    }
  });
});

describe("portal world gate wiring", () => {
  it("enforces the gate inside getAccessContextForWorld, not only in the layout", async () => {
    const source = await readFile(join(libDir, "auth.ts"), "utf8");

    const gateStart = source.indexOf("export const getAccessContextForWorld");
    assert.ok(gateStart > -1, "getAccessContextForWorld must exist");
    const gateEnd = source.indexOf("export type ReadableWorld", gateStart);
    const gate = source.slice(gateStart, gateEnd > -1 ? gateEnd : undefined);

    assert.match(
      gate,
      /canReadWorld\(/,
      "the world-membership check must live in the shared access-context helper, " +
        "because a Next.js layout does not re-run for every navigation in its segment",
    );
    assert.match(gate, /isSandbox/, "sandbox worlds must stay out of the Portal");
    assert.match(
      gate,
      /ctx\.guestModeEnabled/,
      "use the settings-aware guest flag from the context, not the raw world column",
    );
  });

  it("gates the world layout so a foreign world name is not disclosed", async () => {
    const source = await readFile(worldLayout, "utf8");

    assert.match(source, /loadReadableWorld\(/, "layout must resolve the world through the gate");
    assert.match(source, /notFound\(\)/, "layout must 404 instead of rendering foreign chrome");
    assert.doesNotMatch(
      source,
      /world\.findUnique/,
      "layout must not query the world directly — that bypasses the gate",
    );
  });
});
