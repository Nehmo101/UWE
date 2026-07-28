import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { canReadWorld } from "@uwe/auth";
import type { AreaAccess, AuthUser, WorldMembership } from "@uwe/auth";

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

function authUser(label: string, access: Partial<AreaAccess>, id = "u-1"): AuthUser {
  return {
    id,
    displayName: label,
    email: null,
    isOwner: false,
    access: { portal: false, studio: false, brain: false, family: false, ...access },
  };
}

const player = (id = "u-1") => authUser("player", { portal: true }, id);
const dm = () => authUser("dm", { portal: true, studio: true }, "u-dm");

function membership(userId: string): WorldMembership {
  return { userId, worldId: WORLD_ID, characterName: null };
}

function target(options: { membership?: WorldMembership | null } = {}) {
  return { id: WORLD_ID, membership: options.membership ?? null };
}

/**
 * The gate `getAccessContextForWorld` applies before returning a context.
 * These cases pin the property that B2 fixed: a logged-in player must not reach
 * a world they are not assigned to just by guessing its slug.
 */
describe("portal world read gate", () => {
  it("denies a Portal user without a world assignment", () => {
    assert.equal(canReadWorld(player(), target()), false);
  });

  it("denies an anonymous visitor — guest mode is gone", () => {
    assert.equal(canReadWorld(null, target()), false);
    assert.equal(canReadWorld(null, target({ membership: membership("u-1") })), false);
  });

  it("allows a player who is assigned to that world", () => {
    assert.equal(canReadWorld(player(), target({ membership: membership("u-1") })), true);
  });

  it("ignores an assignment that belongs to a different user", () => {
    assert.equal(
      canReadWorld(player("u-1"), target({ membership: membership("someone-else") })),
      false,
    );
  });

  it("keeps Studio access to every world (DM preview must not break)", () => {
    assert.equal(canReadWorld(dm(), target()), true);
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
      "the world-assignment check must live in the shared access-context helper, " +
        "because a Next.js layout does not re-run for every navigation in its segment",
    );
    assert.match(gate, /isSandbox/, "sandbox worlds must stay out of the Portal");
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
