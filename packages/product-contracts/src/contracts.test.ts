import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_AUDIENCE,
  BRAIN_ONLY_DATA_DOMAINS,
  DATA_DOMAIN,
  isAppAudience,
  isBrainOnlyDataDomain,
  isDataDomain,
  isPrivacyClass,
  type DataDomain,
} from "./domain-boundaries";
import { AUDIENCE_DOMAIN_ACCESS, getDomainAccess } from "./domain-access";
import { PRISMA_MODEL_BOUNDARIES } from "./prisma-model-boundaries";

const AUDIENCES = Object.values(APP_AUDIENCE);
const DOMAINS = Object.values(DATA_DOMAIN);

describe("domain access matrix", () => {
  it("defines an access mode for every audience × domain", () => {
    for (const audience of AUDIENCES) {
      for (const domain of DOMAINS) {
        assert.equal(typeof getDomainAccess(audience, domain), "string");
      }
    }
  });

  it("keeps brain-only domains (personal_brain, admin_life) unreachable from portal and studio", () => {
    for (const domain of BRAIN_ONLY_DATA_DOMAINS) {
      // Only the brain audience may read/write; portal & studio are hard 'none'.
      assert.equal(AUDIENCE_DOMAIN_ACCESS.portal[domain], "none", `portal must not touch ${domain}`);
      assert.equal(AUDIENCE_DOMAIN_ACCESS.studio[domain], "none", `studio must not touch ${domain}`);
      assert.equal(AUDIENCE_DOMAIN_ACCESS.brain[domain], "read_write");
      // Platform may only orchestrate opaquely — never read the content.
      assert.equal(AUDIENCE_DOMAIN_ACCESS.platform[domain], "opaque_orchestration");
    }
  });

  it("never lets the brain audience read D&D or portal content directly", () => {
    for (const domain of ["dnd_world", "dnd_brain", "portal_player", "assets"] as DataDomain[]) {
      assert.equal(AUDIENCE_DOMAIN_ACCESS.brain[domain], "none");
    }
  });

  it("marks exactly personal_brain and admin_life as brain-only", () => {
    assert.deepEqual([...BRAIN_ONLY_DATA_DOMAINS].sort(), ["admin_life", "personal_brain"]);
    assert.ok(isBrainOnlyDataDomain(DATA_DOMAIN.personalBrain));
    assert.ok(isBrainOnlyDataDomain(DATA_DOMAIN.adminLife));
    assert.ok(!isBrainOnlyDataDomain(DATA_DOMAIN.dndWorld));
  });

  it("has working type guards", () => {
    assert.ok(isAppAudience("brain"));
    assert.ok(!isAppAudience("owner"));
    assert.ok(isDataDomain("personal_brain"));
    assert.ok(!isDataDomain("nope"));
    assert.ok(isPrivacyClass("owner_private_local"));
    assert.ok(!isPrivacyClass("secret"));
  });
});

describe("prisma model boundaries", () => {
  const entries = Object.entries(PRISMA_MODEL_BOUNDARIES);

  it("routes every owner_private_local model to uwe-brain.db and nothing else there", () => {
    for (const [name, b] of entries) {
      if (b.privacyClass === "owner_private_local") {
        assert.equal(b.targetDatabase, "uwe-brain.db", `${name} must live in uwe-brain.db`);
      }
      if (b.targetDatabase === "uwe-brain.db") {
        assert.equal(b.privacyClass, "owner_private_local", `${name} in uwe-brain.db must be owner_private_local`);
      }
    }
  });

  it("keeps brain-only domains and owner_private_local perfectly aligned", () => {
    for (const [name, b] of entries) {
      const brainOnly = isBrainOnlyDataDomain(b.domain);
      const local = b.privacyClass === "owner_private_local";
      assert.equal(brainOnly, local, `${name}: brain-only domain and owner_private_local must match`);
    }
  });

  it("never exposes an owner_private_local model as player_visible or public", () => {
    for (const [name, b] of entries) {
      if (b.privacyClass === "owner_private_local") {
        assert.notEqual(b.privacyClass, "player_visible", name);
        assert.notEqual(b.privacyClass, "public", name);
      }
    }
  });

  it("maps a known-good sample correctly", () => {
    assert.equal(PRISMA_MODEL_BOUNDARIES.PersonalBrainDocument.privacyClass, "owner_private_local");
    assert.equal(PRISMA_MODEL_BOUNDARIES.ContentBlock.privacyClass, "dm_only");
    assert.equal(PRISMA_MODEL_BOUNDARIES.TerraKarte.privacyClass, "player_visible");
    assert.equal(PRISMA_MODEL_BOUNDARIES.DndApiCacheEntry.privacyClass, "public");
  });
});
