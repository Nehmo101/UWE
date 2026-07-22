import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAIN_AUDIENCE, brainCanAccess } from "./audience";

describe("brain audience matches the product contracts", () => {
  it("declares the brain audience", () => {
    assert.equal(BRAIN_AUDIENCE, "brain");
  });

  it("may access its own owner-private domains", () => {
    assert.ok(brainCanAccess("personal_brain"));
    assert.ok(brainCanAccess("admin_life"));
  });

  it("must not access D&D or portal domains", () => {
    assert.ok(!brainCanAccess("dnd_world"));
    assert.ok(!brainCanAccess("dnd_brain"));
    assert.ok(!brainCanAccess("portal_player"));
    assert.ok(!brainCanAccess("assets"));
  });
});
